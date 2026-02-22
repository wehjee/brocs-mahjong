import type { GameState, Player, Tile, TileDefinition, SeatWind, Meld } from '../types/game';
import { generateTileSet } from '../types/game';

let tileIdCounter = 0;

function createTile(def: TileDefinition, faceUp = false): Tile {
  return {
    id: `tile-${tileIdCounter++}`,
    definition: def,
    faceUp,
  };
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createMockGameState(): GameState {
  tileIdCounter = 0;
  const allDefs = shuffle(generateTileSet());

  // Deal 13 tiles to each player, 14th for East
  const hands: Tile[][] = [[], [], [], []];
  let idx = 0;

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 13; j++) {
      hands[i].push(createTile(allDefs[idx++], true));
    }
  }
  // East (player 0) draws 14th tile
  hands[0].push(createTile(allDefs[idx++], true));

  // Sort each hand
  for (const hand of hands) {
    hand.sort(compareTiles);
  }

  // Remaining tiles form the wall
  const wall: Tile[] = [];
  while (idx < allDefs.length) {
    wall.push(createTile(allDefs[idx++]));
  }

  // Create some mock discards for visual interest
  const discards: Tile[][] = [[], [], [], []];
  for (let i = 0; i < 4; i++) {
    const numDiscards = Math.floor(Math.random() * 6) + 2;
    for (let j = 0; j < numDiscards && hands[i].length > 13; j++) {
      const discarded = hands[i].pop()!;
      discarded.faceUp = true;
      discards[i].push(discarded);
    }
  }

  // Create a mock meld for player 2 (visual variety)
  const mockMelds: Meld[][] = [[], [], [], []];
  if (hands[2].length >= 16) {
    const meldTiles = hands[2].splice(0, 3);
    mockMelds[2].push({ type: 'pong', tiles: meldTiles });
  }

  const seatWinds: SeatWind[] = ['east', 'south', 'west', 'north'];
  const names = ['You', 'Player 2', 'Player 3', 'Player 4'];
  const avatars = ['🥦', '🍄', '🌽', '🥕'];

  const players: Player[] = seatWinds.map((wind, i) => ({
    id: `player-${i}`,
    name: names[i],
    avatar: avatars[i],
    seatWind: wind,
    hand: hands[i],
    discards: discards[i],
    melds: mockMelds[i],
    revealedBonuses: [],
    isCurrentTurn: i === 0,
    score: 0,
    isReady: true,
    isConnected: true,
  }));

  return {
    id: 'game-1',
    phase: 'playing',
    players,
    wall,
    currentPlayerIndex: 0,
    roundWind: 'east',
    roundNumber: 1,
    turnNumber: 8,
    lastDiscard: discards[3]?.[discards[3].length - 1] ?? null,
    lastDiscardPlayer: 3,
    tilesRemaining: wall.length,
  };
}

function compareTiles(a: Tile, b: Tile): number {
  const order = tileOrder(a.definition);
  const orderB = tileOrder(b.definition);
  return order - orderB;
}

function tileOrder(def: TileDefinition): number {
  switch (def.type) {
    case 'suit': {
      const suitIdx = def.suit === 'character' ? 0 : def.suit === 'bamboo' ? 1 : 2;
      return suitIdx * 10 + def.value;
    }
    case 'wind': {
      const windIdx = { east: 0, south: 1, west: 2, north: 3 }[def.direction];
      return 30 + windIdx;
    }
    case 'dragon': {
      const dragonIdx = { red: 0, green: 1, white: 2 }[def.color];
      return 40 + dragonIdx;
    }
    case 'bonus':
      return 50 + (def.bonusType === 'flower' ? 0 : 4) + def.value;
  }
}
