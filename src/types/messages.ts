// WebSocket message protocol for Brocs Mahjong multiplayer
import type { ActionType, Tile, Meld, SeatWind, WindDirection, GamePhase } from './game';
import type { TaiResult, PaymentResult } from '../engine/gameEngine';

// ── Client → Server ────────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'join'; playerName: string; avatar: string; reconnectToken?: string }
  | { type: 'ready'; isReady: boolean }
  | { type: 'start-game' }
  | { type: 'action'; action: ActionType; tileId?: string; chiIndex?: number }
  | { type: 'next-round' }
  | { type: 'leave' };

// ── Server → Client ────────────────────────────────────────────────────

export type ServerMessage =
  | { type: 'room-state'; room: ClientRoom }
  | { type: 'game-start'; state: ClientGameState }
  | { type: 'game-state'; state: ClientGameState }
  | { type: 'claim-window'; timeout: number; availableActions: ActionType[] }
  | { type: 'your-turn'; phase: 'human-needs-draw' | 'human-needs-discard'; availableActions: ActionType[] }
  | { type: 'round-over'; winnerIndex: number | null; taiResult: TaiResult | null; paymentResult: PaymentResult | null; message: string }
  | { type: 'game-event'; event: GameEvent }
  | { type: 'chi-options'; options: Tile[][] }
  | { type: 'error'; message: string }
  | { type: 'player-disconnected'; playerIndex: number }
  | { type: 'player-reconnected'; playerIndex: number };

// ── Room / Lobby ────────────────────────────────────────────────────────

export interface ClientRoom {
  code: string;
  players: ClientLobbyPlayer[];
  status: 'waiting' | 'starting' | 'in-game';
  hostIndex: number;
}

export interface ClientLobbyPlayer {
  id: string;
  name: string;
  avatar: string;
  isReady: boolean;
  isHost: boolean;
  isAI: boolean;
}

// ── Filtered game state sent to each client ─────────────────────────────

export interface ClientGameState {
  players: ClientPlayer[];
  currentPlayerIndex: number;
  roundWind: WindDirection;
  roundNumber: number;
  turnNumber: number;
  lastDiscard: Tile | null;
  lastDiscardPlayer: number | null;
  tilesRemaining: number;
  phase: GamePhase;
  myIndex: number;
}

export interface ClientPlayer {
  id: string;
  name: string;
  avatar: string;
  seatWind: SeatWind;
  hand: Tile[];          // face-up only for myIndex; empty for others
  handCount: number;     // tile count for hidden hands
  discards: Tile[];
  melds: Meld[];
  revealedBonuses: Tile[];
  isCurrentTurn: boolean;
  score: number;
  isReady: boolean;
  isConnected: boolean;
  isAI: boolean;
}

// ── Game events for animation/messages ──────────────────────────────────

export type GameEvent =
  | { event: 'tile-drawn'; playerIndex: number }
  | { event: 'tile-discarded'; playerIndex: number; tile: Tile }
  | { event: 'claim-pong'; playerIndex: number; meld: Meld }
  | { event: 'claim-chi'; playerIndex: number; meld: Meld }
  | { event: 'claim-kong'; playerIndex: number; meld: Meld }
  | { event: 'self-kong'; playerIndex: number; meld: Meld }
  | { event: 'bonus-revealed'; playerIndex: number; tiles: Tile[] }
  | { event: 'ai-action'; playerIndex: number; description: string };
