// Mahjong Tile Types — Singapore Style
// 144 tiles total: 108 Suits (36×3) + 16 Winds + 12 Dragons + 4 Flowers + 4 Animals

export type Suit = 'bamboo' | 'character' | 'dot';
export type WindDirection = 'east' | 'south' | 'west' | 'north';
export type DragonColor = 'red' | 'green' | 'white';
export type BonusType = 'flower' | 'animal';
export type AnimalName = 'cat' | 'mouse' | 'rooster' | 'centipede';

export interface SuitTile {
  type: 'suit';
  suit: Suit;
  value: number; // 1-9
}

export interface WindTile {
  type: 'wind';
  direction: WindDirection;
}

export interface DragonTile {
  type: 'dragon';
  color: DragonColor;
}

export interface BonusTile {
  type: 'bonus';
  bonusType: BonusType;
  value: number; // 1-4 (flowers: 1=梅 2=蘭 3=竹 4=菊, animals: 1=cat 2=mouse 3=rooster 4=centipede)
}

export type TileDefinition = SuitTile | WindTile | DragonTile | BonusTile;

export interface Tile {
  id: string;
  definition: TileDefinition;
  faceUp: boolean;
}

export type SeatWind = 'east' | 'south' | 'west' | 'north';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  seatWind: SeatWind;
  hand: Tile[];
  discards: Tile[];
  melds: Meld[];
  revealedBonuses: Tile[]; // Singapore: flowers & animals auto-revealed on draw
  isCurrentTurn: boolean;
  score: number;
  isReady: boolean;
  isConnected: boolean;
}

export type MeldType = 'chi' | 'pong' | 'kong' | 'concealed-kong';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
}

export type GamePhase = 'waiting' | 'playing' | 'scoring' | 'finished';

export interface GameState {
  id: string;
  phase: GamePhase;
  players: Player[];
  wall: Tile[];
  currentPlayerIndex: number;
  roundWind: WindDirection;
  roundNumber: number;
  turnNumber: number;
  lastDiscard: Tile | null;
  lastDiscardPlayer: number | null;
  tilesRemaining: number;
}

export type ActionType = 'draw' | 'discard' | 'chi' | 'pong' | 'kong' | 'win' | 'pass';

export interface GameAction {
  type: ActionType;
  playerId: string;
  tile?: Tile;
  tiles?: Tile[]; // for chi/pong/kong
}

// Room / Lobby types
export interface Room {
  id: string;
  code: string;
  host: string;
  players: LobbyPlayer[];
  maxPlayers: 4;
  status: 'waiting' | 'starting' | 'in-game';
  settings: GameSettings;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  avatar: string;
  isReady: boolean;
  isHost: boolean;
}

export interface GameSettings {
  timePerTurn: number; // seconds
  enableHints: boolean;
  minTai: number; // minimum tai to win (Singapore style, typically 1)
}

// Helper to generate all 148 tiles (Singapore Mahjong)
// 136 regular + 4 flowers + 4 animals + 4 extra animal tiles = 148
// Actually standard Singapore set: 136 regular + 8 bonus (4 flowers + 4 animals) = 144 tiles
export function generateTileSet(): TileDefinition[] {
  const tiles: TileDefinition[] = [];

  // Suit tiles: 4 copies each of 1-9 for each suit
  const suits: Suit[] = ['bamboo', 'character', 'dot'];
  for (const suit of suits) {
    for (let value = 1; value <= 9; value++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push({ type: 'suit', suit, value });
      }
    }
  }

  // Wind tiles: 4 copies each
  const winds: WindDirection[] = ['east', 'south', 'west', 'north'];
  for (const direction of winds) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ type: 'wind', direction });
    }
  }

  // Dragon tiles: 4 copies each
  const dragons: DragonColor[] = ['red', 'green', 'white'];
  for (const color of dragons) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ type: 'dragon', color });
    }
  }

  // Bonus tiles (Singapore): 4 flowers + 4 animals
  // Flowers: 1=梅(Plum) 2=蘭(Orchid) 3=竹(Bamboo) 4=菊(Chrysanthemum)
  // Animals: 1=Cat 2=Mouse 3=Rooster 4=Centipede
  for (let value = 1; value <= 4; value++) {
    tiles.push({ type: 'bonus', bonusType: 'flower', value });
    tiles.push({ type: 'bonus', bonusType: 'animal', value });
  }

  return tiles;
}
