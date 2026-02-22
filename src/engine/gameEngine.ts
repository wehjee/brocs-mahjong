import type { GameState, Tile, TileDefinition, Meld, Player } from '../types/game';

// ── Tile comparison helpers ──────────────────────────────────────────────

export function tilesMatch(a: TileDefinition, b: TileDefinition): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'suit':
      return b.type === 'suit' && a.suit === b.suit && a.value === b.value;
    case 'wind':
      return b.type === 'wind' && a.direction === b.direction;
    case 'dragon':
      return b.type === 'dragon' && a.color === b.color;
    case 'bonus':
      return b.type === 'bonus' && a.bonusType === b.bonusType && a.value === b.value;
  }
}

export function tileOrder(def: TileDefinition): number {
  switch (def.type) {
    case 'suit': {
      const suitIdx = def.suit === 'character' ? 0 : def.suit === 'bamboo' ? 1 : 2;
      return suitIdx * 10 + def.value;
    }
    case 'wind':
      return 30 + { east: 0, south: 1, west: 2, north: 3 }[def.direction];
    case 'dragon':
      return 40 + { red: 0, green: 1, white: 2 }[def.color];
    case 'bonus':
      return 50 + (def.bonusType === 'flower' ? 0 : 4) + def.value;
  }
}

export function sortHand(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => tileOrder(a.definition) - tileOrder(b.definition));
}

// ── Core game operations ────────────────────────────────────────────────

export function drawTile(state: GameState, playerIndex: number): GameState {
  if (state.wall.length === 0) {
    return { ...state, phase: 'finished' };
  }

  const wall = [...state.wall];
  const drawn = wall.shift()!;
  drawn.faceUp = true;

  // Singapore rule: if drawn tile is a bonus (flower/animal),
  // auto-reveal it and draw replacement from the TAIL of the wall.
  // This can chain if the replacement is also a bonus tile.
  const revealedBonuses: Tile[] = [];
  let currentTile = drawn;

  while (currentTile.definition.type === 'bonus') {
    revealedBonuses.push(currentTile);
    if (wall.length === 0) break;
    // Draw replacement from the tail (back) of the wall
    const replacement = wall.pop()!;
    replacement.faceUp = true;
    currentTile = replacement;
  }

  // If we revealed bonuses and ran out of wall, currentTile is the last bonus
  const finalTileIsBonus = currentTile.definition.type === 'bonus';

  const players = state.players.map((p, i) => {
    if (i !== playerIndex) return p;
    return {
      ...p,
      hand: finalTileIsBonus ? [...p.hand] : [...p.hand, currentTile],
      revealedBonuses: [...p.revealedBonuses, ...revealedBonuses],
    };
  });

  return {
    ...state,
    wall,
    players,
    tilesRemaining: wall.length,
    // If wall exhausted during bonus replacement, game ends
    phase: wall.length === 0 && finalTileIsBonus ? 'finished' : state.phase,
  };
}

export function discardTile(state: GameState, playerIndex: number, tileId: string): GameState {
  const player = state.players[playerIndex];
  const tileIdx = player.hand.findIndex(t => t.id === tileId);
  if (tileIdx === -1) return state;

  const newHand = [...player.hand];
  const [discarded] = newHand.splice(tileIdx, 1);
  discarded.faceUp = true;

  const players = state.players.map((p, i) => {
    if (i !== playerIndex) return { ...p, isCurrentTurn: false };
    return {
      ...p,
      hand: sortHand(newHand),
      discards: [...p.discards, discarded],
      isCurrentTurn: false,
    };
  });

  return {
    ...state,
    players,
    lastDiscard: discarded,
    lastDiscardPlayer: playerIndex,
    turnNumber: state.turnNumber + 1,
  };
}

export function advanceTurn(state: GameState): GameState {
  const next = (state.currentPlayerIndex + 1) % 4;

  const players = state.players.map((p, i) => ({
    ...p,
    isCurrentTurn: i === next,
  }));

  return {
    ...state,
    currentPlayerIndex: next,
    players,
  };
}

// ── Claim checks ────────────────────────────────────────────────────────

export function canPong(hand: Tile[], discardDef: TileDefinition): Tile[] | null {
  const matching = hand.filter(t => tilesMatch(t.definition, discardDef));
  return matching.length >= 2 ? matching.slice(0, 2) : null;
}

export function canKong(hand: Tile[], discardDef: TileDefinition): Tile[] | null {
  const matching = hand.filter(t => tilesMatch(t.definition, discardDef));
  return matching.length >= 3 ? matching.slice(0, 3) : null;
}

export function canChi(hand: Tile[], discardDef: TileDefinition, claimerIndex: number, discarderIndex: number): Tile[] | null {
  // Chi can only be claimed from the player to your left (previous player)
  if ((discarderIndex + 1) % 4 !== claimerIndex) return null;
  if (discardDef.type !== 'suit') return null;

  const suit = discardDef.suit;
  const val = discardDef.value;
  const suitTiles = hand.filter(t => t.definition.type === 'suit' && t.definition.suit === suit);

  // Check all 3 possible sequences containing this tile
  const sequences: [number, number][] = [
    [val - 2, val - 1], // tile is the high end
    [val - 1, val + 1], // tile is the middle
    [val + 1, val + 2], // tile is the low end
  ];

  for (const [v1, v2] of sequences) {
    if (v1 < 1 || v1 > 9 || v2 < 1 || v2 > 9) continue;
    const t1 = suitTiles.find(t => t.definition.type === 'suit' && t.definition.value === v1);
    const t2 = suitTiles.find(t => t.definition.type === 'suit' && t.definition.value === v2 && t.id !== t1?.id);
    if (t1 && t2) return [t1, t2];
  }

  return null;
}

export function doPong(state: GameState, claimerIndex: number): GameState {
  const discard = state.lastDiscard;
  if (!discard) return state;

  const claimer = state.players[claimerIndex];
  const pongTiles = canPong(claimer.hand, discard.definition);
  if (!pongTiles) return state;

  // Remove pong tiles from hand
  const pongIds = new Set(pongTiles.map(t => t.id));
  const newHand = claimer.hand.filter(t => !pongIds.has(t.id));

  // Remove discard from discarder's pile
  const discarderIdx = state.lastDiscardPlayer!;

  const meld: Meld = {
    type: 'pong',
    tiles: [...pongTiles, discard],
  };

  const players = state.players.map((p, i) => {
    if (i === claimerIndex) {
      return {
        ...p,
        hand: sortHand(newHand),
        melds: [...p.melds, meld],
        isCurrentTurn: true,
      };
    }
    if (i === discarderIdx) {
      return {
        ...p,
        discards: p.discards.filter(t => t.id !== discard.id),
        isCurrentTurn: false,
      };
    }
    return { ...p, isCurrentTurn: false };
  });

  return {
    ...state,
    players,
    currentPlayerIndex: claimerIndex,
    lastDiscard: null,
    lastDiscardPlayer: null,
  };
}

// ── Win check (simplified: 4 sets + 1 pair) ────────────────────────────

export function checkWin(hand: Tile[], melds: Meld[]): boolean {
  // Total tiles needed: 14 = melds*3 + hand tiles
  // With n melds revealed, hand should have 14 - n*3 tiles
  const handSize = hand.length;
  const expectedHand = 14 - melds.length * 3;
  if (handSize !== expectedHand) return false;

  // Group hand tiles by their definition
  const groups = groupTiles(hand);
  return canFormSetsAndPair(groups);
}

function tileKey(def: TileDefinition): string {
  switch (def.type) {
    case 'suit': return `${def.suit}-${def.value}`;
    case 'wind': return `wind-${def.direction}`;
    case 'dragon': return `dragon-${def.color}`;
    case 'bonus': return `bonus-${def.bonusType}-${def.value}`;
  }
}

function groupTiles(tiles: Tile[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of tiles) {
    const key = tileKey(t.definition);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function canFormSetsAndPair(groups: Map<string, number>): boolean {
  const total = Array.from(groups.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return true;
  if (total === 2) {
    // Must be a pair
    return Array.from(groups.values()).some(v => v >= 2);
  }

  // Try each group as the pair
  for (const [key, count] of groups) {
    if (count >= 2) {
      const copy = new Map(groups);
      copy.set(key, count - 2);
      if (count - 2 === 0) copy.delete(key);
      if (canFormSets(copy)) return true;
    }
  }
  return false;
}

function canFormSets(groups: Map<string, number>): boolean {
  const total = Array.from(groups.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return true;
  if (total % 3 !== 0) return false;

  // Try triplet (pong) first, then sequence (chi)
  for (const [key, count] of groups) {
    if (count <= 0) continue;

    // Try triplet
    if (count >= 3) {
      const copy = new Map(groups);
      copy.set(key, count - 3);
      if (count - 3 === 0) copy.delete(key);
      if (canFormSets(copy)) return true;
    }

    // Try sequence (only for suit tiles)
    const parts = key.split('-');
    if (['bamboo', 'character', 'dot'].includes(parts[0])) {
      const suit = parts[0];
      const val = parseInt(parts[1]);
      if (val <= 7) {
        const k1 = `${suit}-${val}`;
        const k2 = `${suit}-${val + 1}`;
        const k3 = `${suit}-${val + 2}`;
        const c1 = groups.get(k1) ?? 0;
        const c2 = groups.get(k2) ?? 0;
        const c3 = groups.get(k3) ?? 0;
        if (c1 > 0 && c2 > 0 && c3 > 0) {
          const copy = new Map(groups);
          copy.set(k1, c1 - 1); if (c1 - 1 === 0) copy.delete(k1);
          copy.set(k2, c2 - 1); if (c2 - 1 === 0) copy.delete(k2);
          copy.set(k3, c3 - 1); if (c3 - 1 === 0) copy.delete(k3);
          if (canFormSets(copy)) return true;
        }
      }
    }

    // If we tried all possibilities for the first non-zero key and none worked, fail
    return false;
  }
  return false;
}

// ── Singapore Tai Scoring ────────────────────────────────────────────────

export interface TaiResult {
  tai: number;
  breakdown: { name: string; tai: number }[];
  basePoints: number;
}

export function calculateTai(
  player: Player,
  isSelfDraw: boolean,
  roundWind: string,
): TaiResult {
  const breakdown: { name: string; tai: number }[] = [];
  const hand = player.hand;
  const melds = player.melds;
  const bonuses = player.revealedBonuses;

  // ─ Bonus tile scoring ─
  // Each flower = 1 tai
  const flowers = bonuses.filter(t => t.definition.type === 'bonus' && t.definition.bonusType === 'flower');
  if (flowers.length > 0) {
    breakdown.push({ name: `Flowers (${flowers.length})`, tai: flowers.length });
  }

  // Each animal = 1 tai
  const animals = bonuses.filter(t => t.definition.type === 'bonus' && t.definition.bonusType === 'animal');
  if (animals.length > 0) {
    breakdown.push({ name: `Animals (${animals.length})`, tai: animals.length });
  }

  // All 4 flowers = extra 1 tai bonus
  if (flowers.length === 4) {
    breakdown.push({ name: 'All Flowers', tai: 1 });
  }

  // All 4 animals = extra 1 tai bonus
  if (animals.length === 4) {
    breakdown.push({ name: 'All Animals', tai: 1 });
  }

  // Animal pairs bonus: Cat+Mouse or Rooster+Centipede
  const animalValues = animals.map(t => t.definition.type === 'bonus' ? t.definition.value : 0);
  const hasCat = animalValues.includes(1);
  const hasMouse = animalValues.includes(2);
  const hasRooster = animalValues.includes(3);
  const hasCentipede = animalValues.includes(4);
  if (hasCat && hasMouse) {
    breakdown.push({ name: 'Cat & Mouse', tai: 1 });
  }
  if (hasRooster && hasCentipede) {
    breakdown.push({ name: 'Rooster & Centipede', tai: 1 });
  }

  // ─ Hand-based scoring ─
  const allTiles = [...hand, ...melds.flatMap(m => m.tiles)];
  const allDefs = allTiles.map(t => t.definition);

  // Self-draw = 1 tai
  if (isSelfDraw) {
    breakdown.push({ name: 'Self-drawn', tai: 1 });
  }

  // No flowers/animals = 1 tai (bare hand)
  if (bonuses.length === 0) {
    breakdown.push({ name: 'No Bonus Tiles', tai: 1 });
  }

  // Concealed hand (no open melds) = 1 tai
  const hasOpenMelds = melds.some(m => m.type !== 'concealed-kong');
  if (!hasOpenMelds) {
    breakdown.push({ name: 'Concealed Hand', tai: 1 });
  }

  // All Pongs (no chi melds, all sets are pongs/kongs) = 2 tai
  const allSetsArePongs = melds.every(m => m.type === 'pong' || m.type === 'kong' || m.type === 'concealed-kong');
  // Also check hand tiles form pongs
  if (allSetsArePongs && melds.length > 0) {
    breakdown.push({ name: 'All Pongs', tai: 2 });
  }

  // Dragon Pong/Kong = 1 tai each
  for (const meld of melds) {
    if ((meld.type === 'pong' || meld.type === 'kong') && meld.tiles[0].definition.type === 'dragon') {
      const dragonName = meld.tiles[0].definition.color;
      breakdown.push({ name: `Dragon ${dragonName} Pong`, tai: 1 });
    }
  }

  // Seat wind Pong = 1 tai
  for (const meld of melds) {
    if ((meld.type === 'pong' || meld.type === 'kong') && meld.tiles[0].definition.type === 'wind') {
      const windDir = meld.tiles[0].definition.direction;
      if (windDir === player.seatWind) {
        breakdown.push({ name: `Seat Wind (${windDir})`, tai: 1 });
      }
      if (windDir === roundWind) {
        breakdown.push({ name: `Round Wind (${windDir})`, tai: 1 });
      }
    }
  }

  // Half flush (mix of one suit + honors) = 2 tai
  // Full flush (one suit only) = 4 tai
  const suitTypes = new Set<string>();
  let hasHonors = false;
  for (const def of allDefs) {
    if (def.type === 'suit') suitTypes.add(def.suit);
    if (def.type === 'wind' || def.type === 'dragon') hasHonors = true;
  }
  if (suitTypes.size === 1 && !hasHonors) {
    breakdown.push({ name: 'Full Flush', tai: 4 });
  } else if (suitTypes.size === 1 && hasHonors) {
    breakdown.push({ name: 'Half Flush', tai: 2 });
  }

  const tai = breakdown.reduce((sum, b) => sum + b.tai, 0);
  // Minimum 1 tai for a valid win
  const finalTai = Math.max(tai, 1);
  // Base points: 2^tai (Singapore table stake calculation)
  const basePoints = Math.pow(2, finalTai);

  return { tai: finalTai, breakdown, basePoints };
}

// ── Payment calculation (Singapore style) ────────────────────────────────
// All players pay the winner. If there was a discarder (shooter), they pay double.

export interface PaymentResult {
  payments: { playerIndex: number; amount: number }[];
  winnerReceives: number;
}

export function calculatePayments(
  winnerIndex: number,
  shooterIndex: number | null, // null = self-draw
  basePoints: number,
): PaymentResult {
  const payments: { playerIndex: number; amount: number }[] = [];
  let total = 0;

  for (let i = 0; i < 4; i++) {
    if (i === winnerIndex) continue;
    // Shooter pays double
    const amount = (i === shooterIndex) ? basePoints * 2 : basePoints;
    payments.push({ playerIndex: i, amount: -amount });
    total += amount;
  }

  payments.push({ playerIndex: winnerIndex, amount: total });
  return { payments, winnerReceives: total };
}

// ── AI Logic ────────────────────────────────────────────────────────────

export function aiChooseDiscard(player: Player): string {
  // Strategy: discard the most "isolated" tile
  // Isolated = no adjacent tiles in same suit, not part of a pair/triplet
  const hand = player.hand;
  if (hand.length === 0) return '';

  let bestTileId = hand[hand.length - 1].id;
  let bestScore = -Infinity;

  for (const tile of hand) {
    const score = isolationScore(tile, hand);
    if (score > bestScore) {
      bestScore = score;
      bestTileId = tile.id;
    }
  }

  return bestTileId;
}

function isolationScore(tile: Tile, hand: Tile[]): number {
  const def = tile.definition;
  let score = 0;

  // Bonus tiles should never be in hand (auto-revealed in Singapore rules) — safety fallback
  if (def.type === 'bonus') return 1000;

  // Count matching tiles (pair/triplet potential)
  const matchCount = hand.filter(t => t.id !== tile.id && tilesMatch(t.definition, def)).length;
  score -= matchCount * 30; // pairs/triplets are valuable, keep them

  // For suit tiles, check adjacency (sequence potential)
  if (def.type === 'suit') {
    const adjacent = hand.filter(t =>
      t.id !== tile.id &&
      t.definition.type === 'suit' &&
      t.definition.suit === def.suit &&
      Math.abs(t.definition.value - def.value) <= 2
    ).length;
    score -= adjacent * 15;

    // Terminals (1 and 9) are slightly less useful for sequences
    if (def.value === 1 || def.value === 9) score += 5;
  }

  // Winds/dragons without pairs are less useful
  if ((def.type === 'wind' || def.type === 'dragon') && matchCount === 0) {
    score += 10;
  }

  return score;
}

export function aiShouldPong(player: Player, discard: Tile): boolean {
  const pongTiles = canPong(player.hand, discard.definition);
  if (!pongTiles) return false;

  // Simple heuristic: pong if it's a dragon, wind matching seat, or terminal pair
  const def = discard.definition;
  if (def.type === 'dragon') return true;
  if (def.type === 'wind' && def.direction === player.seatWind) return true;

  // 30% chance to pong other things for variety
  return Math.random() < 0.3;
}
