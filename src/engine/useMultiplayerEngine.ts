import { useState, useCallback, useEffect, useRef } from 'react';
import PartySocket from 'partysocket';
import type { GameEngine, TurnPhase } from './useGameEngine';
import type { ActionType, Tile, GameState, SeatWind } from '../types/game';
import type { ServerMessage, ClientMessage, ClientGameState, ClientRoom } from '../types/messages';
import type { TaiResult, PaymentResult } from './gameEngine';

// ── Config ───────────────────────────────────────────────────────────────

export interface MultiplayerConfig {
  host: string;
  roomCode: string;
  playerName: string;
  avatar: string;
}

// ── Extra multiplayer methods ────────────────────────────────────────────

export interface MultiplayerExtras {
  roomState: ClientRoom | null;
  isConnected: boolean;
  sendReady: (ready: boolean) => void;
  sendStartGame: () => void;
  sendLeave: () => void;
}

// ── Convert server state to GameState for GameBoard ──────────────────────

function clientToGameState(cs: ClientGameState): GameState {
  return {
    id: 'mp-game',
    phase: cs.phase,
    players: cs.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      seatWind: p.seatWind,
      hand: i === cs.myIndex
        ? p.hand
        : Array.from({ length: p.handCount }, (_, j) => ({
            id: `hidden-${i}-${j}`,
            definition: { type: 'suit' as const, suit: 'bamboo' as const, value: 1 },
            faceUp: false,
          })),
      discards: p.discards,
      melds: p.melds,
      revealedBonuses: p.revealedBonuses,
      isCurrentTurn: p.isCurrentTurn,
      score: p.score,
      isReady: p.isReady,
      isConnected: p.isConnected,
    })),
    wall: [],
    currentPlayerIndex: cs.currentPlayerIndex,
    roundWind: cs.roundWind,
    roundNumber: cs.roundNumber,
    turnNumber: cs.turnNumber,
    lastDiscard: cs.lastDiscard,
    lastDiscardPlayer: cs.lastDiscardPlayer,
    tilesRemaining: cs.tilesRemaining,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useMultiplayerEngine(config: MultiplayerConfig): GameEngine & MultiplayerExtras {
  const [roomState, setRoomState] = useState<ClientRoom | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myIndex, setMyIndex] = useState(0);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('ai-thinking');
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [taiResult, setTaiResult] = useState<TaiResult | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [chiOptions, setChiOptions] = useState<Tile[][] | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<PartySocket | null>(null);
  const reconnectTokenRef = useRef<string>('');

  // Get or create reconnect token
  useEffect(() => {
    const key = `brocs-mj-token-${config.roomCode}`;
    let token = sessionStorage.getItem(key);
    if (!token) {
      token = crypto.randomUUID();
      sessionStorage.setItem(key, token);
    }
    reconnectTokenRef.current = token;
  }, [config.roomCode]);

  // ── WebSocket connection ────────────────────────────────────────────

  useEffect(() => {
    const ws = new PartySocket({
      host: config.host,
      room: config.roomCode,
      query: {
        name: config.playerName,
        avatar: config.avatar,
        reconnectToken: reconnectTokenRef.current,
      },
    });

    wsRef.current = ws;

    ws.addEventListener('open', () => {
      setIsConnected(true);
    });

    ws.addEventListener('close', () => {
      setIsConnected(false);
    });

    ws.addEventListener('message', (event) => {
      const msg: ServerMessage = JSON.parse(event.data);
      handleServerMessage(msg);
    });

    // Send leave on page unload so server knows immediately
    const handleBeforeUnload = () => {
      ws.send(JSON.stringify({ type: 'leave' }));
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      ws.close();
      wsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.host, config.roomCode, config.playerName]);

  // ── Message handler ─────────────────────────────────────────────────

  function handleServerMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'room-state':
        setRoomState(msg.room);
        break;

      case 'game-start':
      case 'game-state': {
        const cs = msg.state;
        setMyIndex(cs.myIndex);
        setGameState(clientToGameState(cs));

        // If phase is finished, keep round-over; otherwise track from server
        if (cs.phase === 'finished') {
          setTurnPhase('round-over');
        } else if (cs.currentPlayerIndex === cs.myIndex) {
          // Our turn — wait for your-turn message to set phase
        } else {
          setTurnPhase('ai-thinking');
          setMessage(null);
        }
        break;
      }

      case 'your-turn':
        setTurnPhase(msg.phase as TurnPhase);
        setChiOptions(null);
        if (msg.phase === 'human-needs-draw') {
          setMessage('Your turn — Draw a tile');
        } else if (msg.phase === 'human-needs-discard') {
          setMessage('Select a tile to discard');
        }
        break;

      case 'claim-window':
        setTurnPhase('claim-window');
        setMessage('Claim or Pass');
        break;

      case 'chi-options':
        setChiOptions(msg.options);
        setMessage('Choose which tiles to Chi with:');
        break;

      case 'round-over':
        setTurnPhase('round-over');
        setWinner(msg.winnerIndex);
        setTaiResult(msg.taiResult);
        setPaymentResult(msg.paymentResult);
        setMessage(msg.message);
        break;

      case 'error':
        setMessage(`Error: ${msg.message}`);
        break;

      case 'player-disconnected':
        setMessage(`Player ${msg.playerIndex} disconnected`);
        break;

      case 'player-reconnected':
        setMessage(null);
        break;
    }
  }

  // ── Send helpers ────────────────────────────────────────────────────

  const send = useCallback((msg: ClientMessage) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  // ── GameEngine interface methods ────────────────────────────────────

  const selectTile = useCallback((tileId: string) => {
    setSelectedTileId(prev => prev === tileId ? null : tileId);
  }, []);

  const performAction = useCallback((action: ActionType) => {
    const msg: ClientMessage = { type: 'action', action };
    if (action === 'discard') {
      if (!selectedTileId) return;
      msg.tileId = selectedTileId;
      setSelectedTileId(null);
    }
    send(msg);

    // Optimistic UI: clear state
    if (action === 'pass') {
      setTurnPhase('ai-thinking');
      setMessage(null);
    } else if (action === 'draw') {
      setMessage(null);
    }
  }, [send, selectedTileId]);

  const selectChi = useCallback((index: number) => {
    send({ type: 'action', action: 'chi', chiIndex: index });
    setChiOptions(null);
  }, [send]);

  const startNextRound = useCallback(() => {
    setWinner(null);
    setTaiResult(null);
    setPaymentResult(null);
    setMessage(null);
    send({ type: 'next-round' });
  }, [send]);

  // ── Multiplayer-specific methods ────────────────────────────────────

  const sendReady = useCallback((ready: boolean) => {
    send({ type: 'ready', isReady: ready });
  }, [send]);

  const sendStartGame = useCallback(() => {
    send({ type: 'start-game' });
  }, [send]);

  const sendLeave = useCallback(() => {
    send({ type: 'leave' });
  }, [send]);

  // ── Fallback game state for before game starts ──────────────────────

  const defaultGameState: GameState = {
    id: 'waiting',
    phase: 'waiting',
    players: Array.from({ length: 4 }, (_, i) => ({
      id: `player-${i}`,
      name: i === 0 ? config.playerName : `Waiting...`,
      avatar: ['🥦', '🍄', '🌽', '🥕'][i],
      seatWind: (['east', 'south', 'west', 'north'] as SeatWind[])[i],
      hand: [],
      discards: [],
      melds: [],
      revealedBonuses: [],
      isCurrentTurn: false,
      score: 0,
      isReady: false,
      isConnected: false,
    })),
    wall: [],
    currentPlayerIndex: 0,
    roundWind: 'east',
    roundNumber: 1,
    turnNumber: 0,
    lastDiscard: null,
    lastDiscardPlayer: null,
    tilesRemaining: 0,
  };

  return {
    // GameEngine interface
    myIndex,
    gameState: gameState ?? defaultGameState,
    turnPhase,
    selectedTileId,
    winner,
    message,
    taiResult,
    paymentResult,
    chiOptions,
    selectTile,
    performAction,
    selectChi,
    startNextRound,

    // Multiplayer extras
    roomState,
    isConnected,
    sendReady,
    sendStartGame,
    sendLeave,
  };
}
