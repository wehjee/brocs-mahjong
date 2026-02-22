import { useState, useCallback, useRef, useEffect } from 'react';
import type { GameState, Tile, ActionType, TileDefinition, SeatWind } from '../types/game';
import { generateTileSet } from '../types/game';
import {
  drawTile,
  discardTile,
  advanceTurn,
  checkWin,
  aiChooseDiscard,
  aiShouldPong,
  canPong,
  doPong,
  tileOrder,
  calculateTai,
  calculatePayments,
} from './gameEngine';
import type { TaiResult, PaymentResult } from './gameEngine';

// ── Create a fresh game ─────────────────────────────────────────────────

let _tileId = 0;
function makeTile(def: TileDefinition, faceUp = false): Tile {
  return { id: `t${_tileId++}`, definition: def, faceUp };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createInitialState(humanName: string): GameState {
  _tileId = 0;
  const defs = shuffle(generateTileSet());

  const hands: Tile[][] = [[], [], [], []];
  let idx = 0;
  for (let p = 0; p < 4; p++) {
    for (let t = 0; t < 13; t++) {
      hands[p].push(makeTile(defs[idx++], true));
    }
  }
  // East draws 14th
  hands[0].push(makeTile(defs[idx++], true));

  const wall: Tile[] = [];
  while (idx < defs.length) wall.push(makeTile(defs[idx++]));

  // Singapore rule: replace bonus tiles in initial hands with tiles from wall tail
  const bonuses: Tile[][] = [[], [], [], []];
  for (let p = 0; p < 4; p++) {
    let changed = true;
    while (changed) {
      changed = false;
      for (let t = hands[p].length - 1; t >= 0; t--) {
        if (hands[p][t].definition.type === 'bonus') {
          const bonus = hands[p].splice(t, 1)[0];
          bonuses[p].push(bonus);
          // Draw replacement from wall tail
          if (wall.length > 0) {
            const replacement = wall.pop()!;
            replacement.faceUp = true;
            hands[p].push(replacement);
            changed = true; // check again in case replacement is also bonus
          }
        }
      }
    }
  }

  for (const h of hands) h.sort((a, b) => tileOrder(a.definition) - tileOrder(b.definition));

  const winds: SeatWind[] = ['east', 'south', 'west', 'north'];
  const names = [humanName, 'BrocBot', 'TileKing', 'MahJane'];
  const avatars = ['🥦', '🍄', '🌽', '🥕'];

  return {
    id: `game-${Date.now().toString(36)}`,
    phase: 'playing',
    players: winds.map((w, i) => ({
      id: `player-${i}`,
      name: names[i],
      avatar: avatars[i],
      seatWind: w,
      hand: hands[i],
      discards: [],
      melds: [],
      revealedBonuses: bonuses[i],
      isCurrentTurn: i === 0,
      score: 0,
      isReady: true,
      isConnected: true,
    })),
    wall,
    currentPlayerIndex: 0,
    roundWind: 'east',
    roundNumber: 1,
    turnNumber: 1,
    lastDiscard: null,
    lastDiscardPlayer: null,
    tilesRemaining: wall.length,
  };
}

// ── Turn phases ─────────────────────────────────────────────────────────

type TurnPhase =
  | 'human-needs-draw'     // human's turn, hasn't drawn yet
  | 'human-needs-discard'  // human drew, must select + discard
  | 'claim-window'         // a tile was discarded, others can claim
  | 'ai-thinking'          // AI is processing
  | 'round-over';          // someone won or wall exhausted

export interface GameEngine {
  gameState: GameState;
  turnPhase: TurnPhase;
  selectedTileId: string | null;
  winner: number | null;
  message: string | null;
  taiResult: TaiResult | null;
  paymentResult: PaymentResult | null;
  selectTile: (tileId: string) => void;
  performAction: (action: ActionType) => void;
}

const AI_DELAY = 800; // ms between AI actions

export function useGameEngine(humanName: string): GameEngine {
  const [gameState, setGameState] = useState<GameState>(() => createInitialState(humanName));
  // East starts with 14 tiles — go straight to discard phase
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('human-needs-discard');
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [taiResult, setTaiResult] = useState<TaiResult | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(gameState);
  stateRef.current = gameState;

  // Clean up timers on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // ── Human actions ───────────────────────────────────────────────────

  const selectTile = useCallback((tileId: string) => {
    if (turnPhase !== 'human-needs-discard') return;
    setSelectedTileId(prev => prev === tileId ? null : tileId);
  }, [turnPhase]);

  const performAction = useCallback((action: ActionType) => {
    const gs = stateRef.current;
    const humanIdx = 0;

    switch (action) {
      case 'draw': {
        if (turnPhase !== 'human-needs-draw') return;
        if (gs.wall.length === 0) {
          endRound(null);
          return;
        }
        const after = drawTile(gs, humanIdx);
        // Check self-draw win
        const p = after.players[humanIdx];
        if (checkWin(p.hand, p.melds)) {
          setMessage('You can win! Click Win to declare.');
        }
        setGameState(after);
        setTurnPhase('human-needs-discard');
        break;
      }
      case 'discard': {
        if (turnPhase !== 'human-needs-discard' || !selectedTileId) return;
        const after = discardTile(gs, humanIdx, selectedTileId);
        setSelectedTileId(null);
        setMessage(null);
        setGameState(after);
        // Open claim window briefly, then advance to next AI
        setTurnPhase('claim-window');
        scheduleAiClaimCheck(after);
        break;
      }
      case 'pong': {
        if (turnPhase !== 'claim-window' || !gs.lastDiscard) return;
        const pongResult = doPong(gs, humanIdx);
        if (pongResult !== gs) {
          setGameState(pongResult);
          setTurnPhase('human-needs-discard');
          setMessage('Pong! Now discard a tile.');
        }
        break;
      }
      case 'win': {
        const p = gs.players[humanIdx];
        if (checkWin(p.hand, p.melds)) {
          // Self-draw if it's discard phase (just drew), not claim window (off someone's discard)
          const selfDraw = turnPhase === 'human-needs-discard';
          endRound(humanIdx, selfDraw);
        }
        break;
      }
      case 'pass': {
        if (turnPhase === 'claim-window') {
          setMessage(null);
          // Human passed — check if any AI wants to claim, then advance
          if (gs.lastDiscardPlayer !== null && gs.lastDiscardPlayer !== humanIdx) {
            // AI discarded, human passed — let other AIs try to claim, then advance
            setTurnPhase('ai-thinking');
            aiClaimCheckAfterAi(gs, gs.lastDiscardPlayer);
          } else {
            // Human discarded earlier, this was their own claim window — just advance
            const after = advanceTurn(gs);
            setGameState(after);
            setTurnPhase('ai-thinking');
            scheduleAiTurn(after);
          }
        }
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnPhase, selectedTileId]);

  // ── AI turn loop ────────────────────────────────────────────────────

  function scheduleAiClaimCheck(gs: GameState) {
    timerRef.current = setTimeout(() => {
      // Check if any AI wants to pong
      const discard = gs.lastDiscard;
      if (!discard) {
        advanceToNextPlayer(gs);
        return;
      }

      for (let i = 1; i <= 3; i++) {
        const player = gs.players[i];
        if (aiShouldPong(player, discard)) {
          const pongResult = doPong(gs, i);
          if (pongResult !== gs) {
            setMessage(`${player.name} Pong!`);
            setGameState(pongResult);
            // That AI now needs to discard
            timerRef.current = setTimeout(() => {
              runAiDiscard(pongResult, i);
            }, AI_DELAY);
            return;
          }
        }
      }

      // No claims, advance normally
      advanceToNextPlayer(gs);
    }, 600); // brief claim window
  }

  function advanceToNextPlayer(gs: GameState) {
    const after = advanceTurn(gs);
    setGameState(after);

    if (after.currentPlayerIndex === 0) {
      // Back to human
      setTurnPhase('human-needs-draw');
      setMessage(null);
    } else {
      setTurnPhase('ai-thinking');
      scheduleAiTurn(after);
    }
  }

  function scheduleAiTurn(gs: GameState) {
    timerRef.current = setTimeout(() => {
      const idx = gs.currentPlayerIndex;
      if (idx === 0) {
        setTurnPhase('human-needs-draw');
        return;
      }

      // AI draws
      if (gs.wall.length === 0) {
        endRound(null);
        return;
      }
      const afterDraw = drawTile(gs, idx);
      setGameState(afterDraw);

      const player = afterDraw.players[idx];

      // Check if AI won (self-draw)
      if (checkWin(player.hand, player.melds)) {
        timerRef.current = setTimeout(() => {
          endRound(idx, true); // self-draw
        }, AI_DELAY);
        return;
      }

      // AI discards after a delay
      timerRef.current = setTimeout(() => {
        runAiDiscard(afterDraw, idx);
      }, AI_DELAY);
    }, AI_DELAY);
  }

  function runAiDiscard(gs: GameState, idx: number) {
    const player = gs.players[idx];
    const discardId = aiChooseDiscard(player);
    if (!discardId) {
      advanceToNextPlayer(gs);
      return;
    }

    const afterDiscard = discardTile(gs, idx, discardId);
    setGameState(afterDiscard);
    setMessage(`${player.name} discarded a tile`);

    // Check if human can pong
    const discard = afterDiscard.lastDiscard;
    if (discard) {
      const humanHand = afterDiscard.players[0].hand;
      const humanCanPong = canPong(humanHand, discard.definition);
      if (humanCanPong) {
        setTurnPhase('claim-window');
        setMessage(`${player.name} discarded — You can Pong!`);
        // No timer — wait for human to explicitly Pong or Pass
        return;
      }
    }

    // Check if other AIs want to claim
    timerRef.current = setTimeout(() => {
      aiClaimCheckAfterAi(afterDiscard, idx);
    }, 400);
  }

  function aiClaimCheckAfterAi(gs: GameState, discarderIdx: number) {
    const discard = gs.lastDiscard;
    if (!discard) {
      advanceAfterAiDiscard(gs, discarderIdx);
      return;
    }

    // Check other AIs for pong
    for (let i = 1; i <= 3; i++) {
      if (i === discarderIdx) continue;
      const player = gs.players[i];
      if (aiShouldPong(player, discard)) {
        const pongResult = doPong(gs, i);
        if (pongResult !== gs) {
          setMessage(`${player.name} Pong!`);
          setGameState(pongResult);
          timerRef.current = setTimeout(() => {
            runAiDiscard(pongResult, i);
          }, AI_DELAY);
          return;
        }
      }
    }

    advanceAfterAiDiscard(gs, discarderIdx);
  }

  function advanceAfterAiDiscard(gs: GameState, _discarderIdx: number) {
    const after = advanceTurn(gs);
    setGameState(after);

    if (after.currentPlayerIndex === 0) {
      setTurnPhase('human-needs-draw');
      setMessage(null);
    } else {
      setTurnPhase('ai-thinking');
      scheduleAiTurn(after);
    }
  }

  function endRound(winnerIdx: number | null, isSelfDraw = false) {
    setWinner(winnerIdx);
    setTurnPhase('round-over');
    const gs = stateRef.current;

    if (winnerIdx !== null) {
      const winnerPlayer = gs.players[winnerIdx];
      const tai = calculateTai(winnerPlayer, isSelfDraw, gs.roundWind);
      setTaiResult(tai);

      const shooterIdx = isSelfDraw ? null : gs.lastDiscardPlayer;
      const payment = calculatePayments(winnerIdx, shooterIdx, tai.basePoints);
      setPaymentResult(payment);

      // Apply score changes
      setGameState(prev => ({
        ...prev,
        phase: 'finished',
        players: prev.players.map((p, i) => {
          const pay = payment.payments.find(pp => pp.playerIndex === i);
          return { ...p, score: p.score + (pay?.amount ?? 0) };
        }),
      }));

      setMessage(`🏆 ${winnerPlayer.name} wins with ${tai.tai} tai!`);
    } else {
      setTaiResult(null);
      setPaymentResult(null);
      setGameState(prev => ({ ...prev, phase: 'finished' }));
      setMessage('Draw — wall exhausted!');
    }
  }

  // Start AI turns if game begins and it's not human's turn (shouldn't happen, but safety)
  useEffect(() => {
    if (gameState.phase === 'playing' && gameState.currentPlayerIndex === 0 && turnPhase === 'human-needs-draw') {
      // It's human's turn to draw — do nothing, wait for input
    }
  }, [gameState.phase, gameState.currentPlayerIndex, turnPhase]);

  return {
    gameState,
    turnPhase,
    selectedTileId,
    winner,
    message,
    taiResult,
    paymentResult,
    selectTile,
    performAction,
  };
}
