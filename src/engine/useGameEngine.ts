import { useState, useCallback, useRef, useEffect } from 'react';
import type { GameState, Tile, ActionType, TileDefinition, SeatWind } from '../types/game';
import { generateTileSet } from '../types/game';
import {
  drawTile,
  discardTile,
  advanceTurn,
  checkWin,
  checkWinWithTile,
  aiChooseDiscard,
  aiShouldPong,
  aiShouldKong,
  aiShouldChi,
  aiShouldSelfKong,
  canPong,
  canKong,
  canChi,
  canSelfKong,
  doPong,
  doChi,
  doKong,
  doSelfKong,
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

function createInitialState(humanName: string, dealerIndex = 0): GameState {
  _tileId = 0;
  const defs = shuffle(generateTileSet());

  const hands: Tile[][] = [[], [], [], []];
  let idx = 0;
  for (let p = 0; p < 4; p++) {
    for (let t = 0; t < 13; t++) {
      hands[p].push(makeTile(defs[idx++], true));
    }
  }
  // Dealer (East) draws 14th tile
  hands[dealerIndex].push(makeTile(defs[idx++], true));

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
      isCurrentTurn: i === dealerIndex,
      score: 0,
      isReady: true,
      isConnected: true,
    })),
    wall,
    currentPlayerIndex: dealerIndex,
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
  startNextRound: () => void;
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
        setTurnPhase('claim-window');
        scheduleAiClaimCheck(after);
        break;
      }
      case 'chi': {
        if (turnPhase !== 'claim-window' || !gs.lastDiscard) return;
        const discarderIdx = gs.lastDiscardPlayer!;
        const chiTiles = canChi(gs.players[humanIdx].hand, gs.lastDiscard.definition, humanIdx, discarderIdx);
        if (chiTiles) {
          const result = doChi(gs, humanIdx, chiTiles);
          setGameState(result);
          setTurnPhase('human-needs-discard');
          setMessage('Chi! Now discard a tile.');
        }
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
      case 'kong': {
        if (turnPhase === 'human-needs-discard') {
          // Self-kong: concealed kong or promote pong
          const result = doSelfKong(gs, humanIdx);
          if (result !== gs) {
            setGameState(result);
            const p = result.players[humanIdx];
            if (checkWin(p.hand, p.melds)) {
              setMessage('Kong! You can win!');
            } else {
              setMessage('Kong! Now discard a tile.');
            }
          }
        } else if (turnPhase === 'claim-window' && gs.lastDiscard) {
          // Exposed kong: claim discard when you have 3 matching tiles
          const result = doKong(gs, humanIdx);
          if (result !== gs) {
            setGameState(result);
            const p = result.players[humanIdx];
            if (checkWin(p.hand, p.melds)) {
              setMessage('Kong! You can win!');
            } else {
              setMessage('Kong! Now discard a tile.');
            }
            setTurnPhase('human-needs-discard');
          }
        }
        break;
      }
      case 'win': {
        const p = gs.players[humanIdx];
        if (turnPhase === 'human-needs-discard') {
          // Self-draw win
          if (checkWin(p.hand, p.melds)) {
            endRound(humanIdx, true);
          }
        } else if (turnPhase === 'claim-window' && gs.lastDiscard) {
          // Win off discard
          if (checkWinWithTile(p.hand, p.melds, gs.lastDiscard)) {
            // Add discard to hand first
            const newHand = [...p.hand, gs.lastDiscard];
            const discarderIdx = gs.lastDiscardPlayer!;
            const updatedPlayers = gs.players.map((pl, i) => {
              if (i === humanIdx) return { ...pl, hand: newHand };
              if (i === discarderIdx) return { ...pl, discards: pl.discards.filter(t => t.id !== gs.lastDiscard!.id) };
              return pl;
            });
            setGameState({ ...gs, players: updatedPlayers, lastDiscard: null, lastDiscardPlayer: null });
            endRound(humanIdx, false);
          }
        }
        break;
      }
      case 'pass': {
        if (turnPhase === 'claim-window') {
          setMessage(null);
          if (gs.lastDiscardPlayer !== null && gs.lastDiscardPlayer !== humanIdx) {
            setTurnPhase('ai-thinking');
            aiClaimCheckAfterAi(gs, gs.lastDiscardPlayer);
          } else {
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
      const discard = gs.lastDiscard;
      if (!discard) {
        advanceToNextPlayer(gs);
        return;
      }
      const discarderIdx = gs.lastDiscardPlayer!;

      // Priority: Win > Kong > Pong > Chi (chi only for next player)
      // Check all AIs for win first
      for (let i = 1; i <= 3; i++) {
        const player = gs.players[i];
        if (checkWinWithTile(player.hand, player.melds, discard)) {
          // AI wins off the discard
          const newHand = [...player.hand, discard];
          const updatedPlayers = gs.players.map((p, pi) => {
            if (pi === i) return { ...p, hand: newHand };
            if (pi === discarderIdx) return { ...p, discards: p.discards.filter(t => t.id !== discard.id) };
            return p;
          });
          const updatedGs = { ...gs, players: updatedPlayers, lastDiscard: null, lastDiscardPlayer: null };
          setGameState(updatedGs);
          timerRef.current = setTimeout(() => {
            endRound(i, false);
          }, AI_DELAY);
          return;
        }
      }

      // Check kong (any AI)
      for (let i = 1; i <= 3; i++) {
        if (i === discarderIdx) continue;
        const player = gs.players[i];
        if (aiShouldKong(player, discard)) {
          const result = doKong(gs, i);
          if (result !== gs) {
            setMessage(`${player.name} Kong!`);
            setGameState(result);
            const p = result.players[i];
            if (checkWin(p.hand, p.melds)) {
              timerRef.current = setTimeout(() => endRound(i, true), AI_DELAY);
              return;
            }
            timerRef.current = setTimeout(() => runAiDiscard(result, i), AI_DELAY);
            return;
          }
        }
      }

      // Check pong (any AI)
      for (let i = 1; i <= 3; i++) {
        if (i === discarderIdx) continue;
        const player = gs.players[i];
        if (aiShouldPong(player, discard)) {
          const pongResult = doPong(gs, i);
          if (pongResult !== gs) {
            setMessage(`${player.name} Pong!`);
            setGameState(pongResult);
            timerRef.current = setTimeout(() => runAiDiscard(pongResult, i), AI_DELAY);
            return;
          }
        }
      }

      // Check chi (only next player after discarder)
      const chiPlayer = (discarderIdx + 1) % 4;
      if (chiPlayer !== 0) { // Only AI chi
        const player = gs.players[chiPlayer];
        const chiTiles = aiShouldChi(player, discard, discarderIdx, chiPlayer);
        if (chiTiles) {
          const result = doChi(gs, chiPlayer, chiTiles);
          if (result !== gs) {
            setMessage(`${player.name} Chi!`);
            setGameState(result);
            timerRef.current = setTimeout(() => runAiDiscard(result, chiPlayer), AI_DELAY);
            return;
          }
        }
      }

      // No claims, advance normally
      advanceToNextPlayer(gs);
    }, 600);
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
          endRound(idx, true);
        }, AI_DELAY);
        return;
      }

      // Check if AI can self-kong
      if (aiShouldSelfKong(player)) {
        const kongInfo = canSelfKong(player);
        if (kongInfo && kongInfo.type === 'promote') {
          // Robbing the kong: check if anyone can win off the promoted tile
          const promotedTileDef = kongInfo.tile.definition;
          // Check human first
          const humanPlayer = afterDraw.players[0];
          const fakeDiscard: Tile = { id: 'rob-kong', definition: promotedTileDef, faceUp: true };
          if (checkWinWithTile(humanPlayer.hand, humanPlayer.melds, fakeDiscard)) {
            setMessage(`${player.name} promotes Kong — You can rob the Kong!`);
            // Store the promoted tile info in gameState for the claim
            const gsWithKongInfo = {
              ...afterDraw,
              lastDiscard: kongInfo.tile,
              lastDiscardPlayer: idx,
            };
            setGameState(gsWithKongInfo);
            setTurnPhase('claim-window');
            return;
          }
          // Check other AIs
          for (let j = 1; j <= 3; j++) {
            if (j === idx) continue;
            if (checkWinWithTile(afterDraw.players[j].hand, afterDraw.players[j].melds, fakeDiscard)) {
              // AI robs the kong
              const newHand = [...afterDraw.players[j].hand, kongInfo.tile];
              const updatedPlayers = afterDraw.players.map((p, pi) => {
                if (pi === j) return { ...p, hand: newHand };
                return p;
              });
              setGameState({ ...afterDraw, players: updatedPlayers });
              timerRef.current = setTimeout(() => endRound(j, false), AI_DELAY);
              setMessage(`${afterDraw.players[j].name} robs ${player.name}'s Kong!`);
              return;
            }
          }
        }

        const afterKong = doSelfKong(afterDraw, idx);
        if (afterKong !== afterDraw) {
          setMessage(`${player.name} Kong!`);
          setGameState(afterKong);
          const pAfterKong = afterKong.players[idx];
          if (checkWin(pAfterKong.hand, pAfterKong.melds)) {
            timerRef.current = setTimeout(() => endRound(idx, true), AI_DELAY);
            return;
          }
          timerRef.current = setTimeout(() => runAiDiscard(afterKong, idx), AI_DELAY);
          return;
        }
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

    // Check if human can claim (win > kong > pong > chi)
    const discard = afterDiscard.lastDiscard;
    if (discard) {
      const humanPlayer = afterDiscard.players[0];
      const humanCanWin = checkWinWithTile(humanPlayer.hand, humanPlayer.melds, discard);
      const humanCanKong = canKong(humanPlayer.hand, discard.definition) !== null;
      const humanCanPong = canPong(humanPlayer.hand, discard.definition) !== null;
      const humanCanChi = canChi(humanPlayer.hand, discard.definition, 0, idx) !== null;

      if (humanCanWin || humanCanKong || humanCanPong || humanCanChi) {
        setTurnPhase('claim-window');
        if (humanCanWin) {
          setMessage(`${player.name} discarded — You can Win!`);
        } else if (humanCanKong) {
          setMessage(`${player.name} discarded — You can Kong!`);
        } else if (humanCanPong) {
          setMessage(`${player.name} discarded — You can Pong!`);
        } else {
          setMessage(`${player.name} discarded — You can Chi!`);
        }
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

    // Priority: Win > Kong > Pong > Chi
    // Check wins first
    for (let i = 1; i <= 3; i++) {
      if (i === discarderIdx) continue;
      const player = gs.players[i];
      if (checkWinWithTile(player.hand, player.melds, discard)) {
        const newHand = [...player.hand, discard];
        const updatedPlayers = gs.players.map((p, pi) => {
          if (pi === i) return { ...p, hand: newHand };
          if (pi === discarderIdx) return { ...p, discards: p.discards.filter(t => t.id !== discard.id) };
          return p;
        });
        const updatedGs = { ...gs, players: updatedPlayers, lastDiscard: null, lastDiscardPlayer: null };
        setGameState(updatedGs);
        timerRef.current = setTimeout(() => endRound(i, false), AI_DELAY);
        return;
      }
    }

    // Check kong
    for (let i = 1; i <= 3; i++) {
      if (i === discarderIdx) continue;
      const player = gs.players[i];
      if (aiShouldKong(player, discard)) {
        const result = doKong(gs, i);
        if (result !== gs) {
          setMessage(`${player.name} Kong!`);
          setGameState(result);
          const p = result.players[i];
          if (checkWin(p.hand, p.melds)) {
            timerRef.current = setTimeout(() => endRound(i, true), AI_DELAY);
            return;
          }
          timerRef.current = setTimeout(() => runAiDiscard(result, i), AI_DELAY);
          return;
        }
      }
    }

    // Check pong
    for (let i = 1; i <= 3; i++) {
      if (i === discarderIdx) continue;
      const player = gs.players[i];
      if (aiShouldPong(player, discard)) {
        const pongResult = doPong(gs, i);
        if (pongResult !== gs) {
          setMessage(`${player.name} Pong!`);
          setGameState(pongResult);
          timerRef.current = setTimeout(() => runAiDiscard(pongResult, i), AI_DELAY);
          return;
        }
      }
    }

    // Check chi (only next player after discarder in anti-clockwise order)
    const chiPlayer = (discarderIdx + 3) % 4;
    if (chiPlayer !== 0) {
      const player = gs.players[chiPlayer];
      const chiTiles = aiShouldChi(player, discard, discarderIdx, chiPlayer);
      if (chiTiles) {
        const result = doChi(gs, chiPlayer, chiTiles);
        if (result !== gs) {
          setMessage(`${player.name} Chi!`);
          setGameState(result);
          timerRef.current = setTimeout(() => runAiDiscard(result, chiPlayer), AI_DELAY);
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

  // ── Next round with wind progression ──────────────────────────────────
  const startNextRound = useCallback(() => {
    const prevGs = stateRef.current;
    const prevScores = prevGs.players.map(p => p.score);
    const prevRoundNumber = prevGs.roundNumber;
    const prevRoundWind = prevGs.roundWind;

    // Wind progression: rotate dealer (East moves to next player)
    // After 4 rounds in a wind, advance to next wind
    // East→South→West→North, then game ends after North round
    const windOrder: SeatWind[] = ['east', 'south', 'west', 'north'];
    let nextRoundNumber = prevRoundNumber + 1;
    let nextRoundWind = prevRoundWind;

    // Every 4 rounds, advance the round wind
    if (nextRoundNumber > 4) {
      const windIdx = windOrder.indexOf(prevRoundWind as SeatWind);
      if (windIdx < 3) {
        nextRoundWind = windOrder[windIdx + 1];
        nextRoundNumber = 1;
      } else {
        // Game complete (after North round 4) — restart from East
        nextRoundWind = 'east';
        nextRoundNumber = 1;
      }
    }

    // Rotate seat winds: dealer shifts each round
    const seatRotation: SeatWind[] = ['east', 'south', 'west', 'north'];
    const newSeatWinds = prevGs.players.map((p) => {
      const prevSeatIdx = seatRotation.indexOf(p.seatWind);
      return seatRotation[(prevSeatIdx + 1) % 4];
    });

    // Find who will be East (dealer) — they get 14 tiles and start
    const eastIdx = newSeatWinds.indexOf('east');

    // Create fresh game state with correct dealer
    const newGs = createInitialState(prevGs.players[0].name, eastIdx);

    // Apply rotated seat winds and preserved scores
    const finalPlayers = newGs.players.map((p, i) => ({
      ...p,
      score: prevScores[i],
      seatWind: newSeatWinds[i],
      isCurrentTurn: i === eastIdx,
    }));

    const finalGs: GameState = {
      ...newGs,
      players: finalPlayers,
      currentPlayerIndex: eastIdx,
      roundWind: nextRoundWind,
      roundNumber: nextRoundNumber,
    };

    setGameState(finalGs);
    setWinner(null);
    setMessage(null);
    setTaiResult(null);
    setPaymentResult(null);
    setSelectedTileId(null);

    if (eastIdx === 0) {
      // Human is East — starts with 14 tiles, needs to discard
      setTurnPhase('human-needs-discard');
    } else {
      // AI is East — human waits for their turn
      setTurnPhase('ai-thinking');
      // East already has 14 tiles, so they start with discard
      timerRef.current = setTimeout(() => {
        runAiDiscard(finalGs, eastIdx);
      }, AI_DELAY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    startNextRound,
  };
}
