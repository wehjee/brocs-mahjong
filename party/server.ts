import type * as Party from 'partykit/server';
import type { GameState, Tile, TileDefinition, SeatWind, ActionType, Player, WindDirection } from '../src/types/game';
import type { ClientMessage, ServerMessage, ClientGameState, ClientPlayer, ClientRoom, ClientLobbyPlayer } from '../src/types/messages';
import { generateTileSet } from '../src/types/game';
import {
  drawTile, discardTile, advanceTurn,
  checkWin, checkWinWithTile,
  canPong, canKong, canChi, canAllChi, canSelfKong,
  doPong, doChi, doKong, doSelfKong,
  aiChooseDiscard, aiShouldPong, aiShouldKong, aiShouldChi, aiShouldSelfKong,
  calculateTai, calculatePayments, tileOrder,
  canWinWithSufficientTai,
} from '../src/engine/gameEngine';
import type { TaiResult, PaymentResult } from '../src/engine/gameEngine';

// ── Types ────────────────────────────────────────────────────────────────

interface LobbyPlayer {
  connectionId: string;
  name: string;
  avatar: string;
  isReady: boolean;
  isHost: boolean;
  reconnectToken: string;
}

const AI_DELAY = 800;
const CLAIM_TIMEOUT = 15000; // 15 seconds for human claims
const DISCONNECT_GRACE = 60000; // 60 seconds before replacing with AI

const AI_AVATARS = ['🍄', '🌽', '🥕', '🎲'];
const AI_NAMES = ['BrocBot', 'TileKing', 'MahJane'];

// ── Server ───────────────────────────────────────────────────────────────

export default class MahjongRoom implements Party.Server {
  room: Party.Room;

  // Lobby state
  lobbyPlayers: LobbyPlayer[] = [];
  status: 'waiting' | 'starting' | 'in-game' = 'waiting';

  // Game state
  gameState: GameState | null = null;
  aiPlayerIndices: Set<number> = new Set();
  humanConnections: Map<number, string> = new Map(); // playerIndex -> connectionId
  connectionToPlayer: Map<string, number> = new Map(); // connectionId -> playerIndex
  reconnectTokens: Map<string, number> = new Map(); // token -> playerIndex

  // Claim window
  claimResponses: Map<number, { action: ActionType; tileId?: string; chiIndex?: number } | null> = new Map();
  claimTimer: ReturnType<typeof setTimeout> | null = null;

  // AI timer
  aiTimer: ReturnType<typeof setTimeout> | null = null;

  // Disconnect timers
  disconnectTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();

  constructor(room: Party.Room) {
    this.room = room;
  }

  // ── Connection lifecycle ─────────────────────────────────────────────

  onConnect(connection: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const name = url.searchParams.get('name') || 'Player';
    const avatar = url.searchParams.get('avatar') || '🥦';
    const reconnectToken = url.searchParams.get('reconnectToken') || '';

    // Check for reconnection
    if (reconnectToken && this.reconnectTokens.has(reconnectToken)) {
      const playerIdx = this.reconnectTokens.get(reconnectToken)!;
      this.handleReconnect(connection, playerIdx, reconnectToken);
      return;
    }

    // New player joining lobby
    if (this.status !== 'waiting') {
      this.sendTo(connection, { type: 'error', message: 'Game already in progress' });
      return;
    }

    if (this.lobbyPlayers.length >= 4) {
      this.sendTo(connection, { type: 'error', message: 'Room is full' });
      return;
    }

    const isHost = this.lobbyPlayers.length === 0;
    const player: LobbyPlayer = {
      connectionId: connection.id,
      name,
      avatar,
      isReady: false,
      isHost,
      reconnectToken: reconnectToken || crypto.randomUUID(),
    };

    this.lobbyPlayers.push(player);
    this.broadcastRoomState();
  }

  onClose(connection: Party.Connection) {
    if (this.status === 'waiting') {
      // Remove from lobby
      const idx = this.lobbyPlayers.findIndex(p => p.connectionId === connection.id);
      if (idx !== -1) {
        this.lobbyPlayers.splice(idx, 1);
        // Reassign host if needed
        if (this.lobbyPlayers.length > 0 && !this.lobbyPlayers.some(p => p.isHost)) {
          this.lobbyPlayers[0].isHost = true;
        }
        this.broadcastRoomState();
      }
      return;
    }

    // In-game disconnection
    const playerIdx = this.connectionToPlayer.get(connection.id);
    if (playerIdx === undefined) return;

    this.humanConnections.delete(playerIdx);
    this.connectionToPlayer.delete(connection.id);

    // Notify others
    this.broadcast({ type: 'player-disconnected', playerIndex: playerIdx });

    // If it's this player's turn, take AI action after a short delay
    if (this.gameState && this.gameState.currentPlayerIndex === playerIdx) {
      this.aiPlayerIndices.add(playerIdx);
      this.scheduleAi(() => this.runAiTurn());
    }

    // Also handle if this player needs to respond in a claim window
    if (this.claimResponses.has(playerIdx) && !this.claimResponses.get(playerIdx)) {
      this.claimResponses.set(playerIdx, { action: 'pass' });
      // Check if all responses are in
      if ([...this.claimResponses.values()].every(v => v !== null)) {
        this.resolveClaimWindow();
      }
    }

    // Start grace period to fully replace with AI
    const timer = setTimeout(() => {
      this.aiPlayerIndices.add(playerIdx);
      this.disconnectTimers.delete(playerIdx);
    }, DISCONNECT_GRACE);

    this.disconnectTimers.set(playerIdx, timer);
  }

  handleReconnect(connection: Party.Connection, playerIdx: number, token: string) {
    // Cancel disconnect timer
    const timer = this.disconnectTimers.get(playerIdx);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerIdx);
    }

    // Restore connection
    this.aiPlayerIndices.delete(playerIdx);
    this.humanConnections.set(playerIdx, connection.id);
    this.connectionToPlayer.set(connection.id, playerIdx);

    // Notify others
    this.broadcast({ type: 'player-reconnected', playerIndex: playerIdx });

    // Send current game state
    if (this.gameState) {
      this.sendTo(connection, {
        type: 'game-state',
        state: this.filterStateForPlayer(this.gameState, playerIdx),
      });
    }
  }

  // ── Message handling ─────────────────────────────────────────────────

  onMessage(rawMessage: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(rawMessage);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'ready':
        this.handleReady(sender, msg.isReady);
        break;
      case 'start-game':
        this.handleStartGame(sender);
        break;
      case 'action':
        this.handleAction(sender, msg.action, msg.tileId, msg.chiIndex);
        break;
      case 'next-round':
        this.handleNextRound();
        break;
      case 'leave':
        this.onClose(sender);
        break;
    }
  }

  // ── Lobby handlers ───────────────────────────────────────────────────

  handleReady(sender: Party.Connection, isReady: boolean) {
    const player = this.lobbyPlayers.find(p => p.connectionId === sender.id);
    if (!player) return;
    player.isReady = isReady;
    this.broadcastRoomState();
  }

  handleStartGame(sender: Party.Connection) {
    const host = this.lobbyPlayers.find(p => p.connectionId === sender.id);
    if (!host?.isHost) return;

    this.status = 'starting';

    // Fill empty seats with AI
    const humanCount = this.lobbyPlayers.length;
    let aiNameIdx = 0;
    while (this.lobbyPlayers.length < 4) {
      this.lobbyPlayers.push({
        connectionId: `ai-${this.lobbyPlayers.length}`,
        name: AI_NAMES[aiNameIdx++] || `Bot${aiNameIdx}`,
        avatar: AI_AVATARS[aiNameIdx] || '🤖',
        isReady: true,
        isHost: false,
        reconnectToken: '',
      });
    }

    // Track which players are AI and map connections
    for (let i = 0; i < 4; i++) {
      const lp = this.lobbyPlayers[i];
      if (i >= humanCount) {
        this.aiPlayerIndices.add(i);
      } else {
        this.humanConnections.set(i, lp.connectionId);
        this.connectionToPlayer.set(lp.connectionId, i);
        this.reconnectTokens.set(lp.reconnectToken, i);
      }
    }

    // Create game state
    this.gameState = this.createGameState();
    this.status = 'in-game';

    // Send initial state to each human player
    this.broadcastRoomState();
    for (const [playerIdx, connId] of this.humanConnections) {
      const conn = this.room.getConnection(connId);
      if (conn) {
        this.sendTo(conn, {
          type: 'game-start',
          state: this.filterStateForPlayer(this.gameState!, playerIdx),
        });
      }
    }

    // Start the game — East (dealer = player 0) has 14 tiles, needs to discard
    const dealerIdx = 0;
    if (this.aiPlayerIndices.has(dealerIdx)) {
      // AI is dealer, schedule AI discard
      this.scheduleAi(() => this.runAiDiscard(dealerIdx));
    } else {
      // Human is dealer, tell them to discard
      this.sendTurnNotification(dealerIdx, 'human-needs-discard');
    }
  }

  // ── Game state creation ──────────────────────────────────────────────

  createGameState(): GameState {
    const defs = this.shuffle(generateTileSet());
    let tileId = 0;
    const makeTile = (def: TileDefinition, faceUp = false): Tile => ({
      id: `t${tileId++}`,
      definition: def,
      faceUp,
    });

    const hands: Tile[][] = [[], [], [], []];
    let idx = 0;
    for (let p = 0; p < 4; p++) {
      for (let t = 0; t < 13; t++) {
        hands[p].push(makeTile(defs[idx++], true));
      }
    }
    // Dealer (East = index 0) draws 14th tile
    hands[0].push(makeTile(defs[idx++], true));

    const wall: Tile[] = [];
    while (idx < defs.length) wall.push(makeTile(defs[idx++]));

    // Replace bonus tiles
    const bonuses: Tile[][] = [[], [], [], []];
    for (let p = 0; p < 4; p++) {
      let changed = true;
      while (changed) {
        changed = false;
        for (let t = hands[p].length - 1; t >= 0; t--) {
          if (hands[p][t].definition.type === 'bonus') {
            const bonus = hands[p].splice(t, 1)[0];
            bonuses[p].push(bonus);
            if (wall.length > 0) {
              const replacement = wall.pop()!;
              replacement.faceUp = true;
              hands[p].push(replacement);
              changed = true;
            }
          }
        }
      }
    }

    for (const h of hands) h.sort((a, b) => tileOrder(a.definition) - tileOrder(b.definition));

    const winds: SeatWind[] = ['east', 'south', 'west', 'north'];

    return {
      id: `game-${Date.now().toString(36)}`,
      phase: 'playing',
      players: this.lobbyPlayers.map((lp, i) => ({
        id: `player-${i}`,
        name: lp.name,
        avatar: lp.avatar,
        seatWind: winds[i],
        hand: hands[i],
        discards: [],
        melds: [],
        revealedBonuses: bonuses[i],
        isCurrentTurn: i === 0,
        score: 0,
        isReady: true,
        isConnected: !this.aiPlayerIndices.has(i),
      })),
      wall,
      currentPlayerIndex: 0,
      roundWind: 'east' as WindDirection,
      roundNumber: 1,
      turnNumber: 1,
      lastDiscard: null,
      lastDiscardPlayer: null,
      tilesRemaining: wall.length,
    };
  }

  // ── Action handling ──────────────────────────────────────────────────

  handleAction(sender: Party.Connection, action: ActionType, tileId?: string, chiIndex?: number) {
    const gs = this.gameState;
    if (!gs) return;

    const playerIdx = this.connectionToPlayer.get(sender.id);
    if (playerIdx === undefined) return;

    switch (action) {
      case 'draw':
        this.handleDraw(playerIdx);
        break;
      case 'discard':
        if (tileId) this.handleDiscard(playerIdx, tileId);
        break;
      case 'chi':
        this.handleChi(playerIdx, chiIndex);
        break;
      case 'pong':
        this.handlePong(playerIdx);
        break;
      case 'kong':
        this.handleKong(playerIdx);
        break;
      case 'win':
        this.handleWin(playerIdx);
        break;
      case 'pass':
        this.handlePass(playerIdx);
        break;
    }
  }

  handleDraw(playerIdx: number) {
    const gs = this.gameState!;
    if (gs.currentPlayerIndex !== playerIdx) return;

    if (gs.wall.length === 0) {
      this.endRound(null);
      return;
    }

    const after = drawTile(gs, playerIdx);
    this.gameState = after;

    const p = after.players[playerIdx];
    if (checkWin(p.hand, p.melds)) {
      // Player can win — let them know
      this.broadcastGameState();
      this.sendTurnNotification(playerIdx, 'human-needs-discard');
      return;
    }

    this.broadcastGameState();

    // Check for self-kong
    if (canSelfKong(p)) {
      this.sendTurnNotification(playerIdx, 'human-needs-discard');
    } else {
      this.sendTurnNotification(playerIdx, 'human-needs-discard');
    }
  }

  handleDiscard(playerIdx: number, tileId: string) {
    const gs = this.gameState!;
    if (gs.currentPlayerIndex !== playerIdx) return;

    const after = discardTile(gs, playerIdx, tileId);
    this.gameState = after;
    this.broadcastGameState();

    // Open claim window
    this.openClaimWindow(after, playerIdx);
  }

  handleChi(playerIdx: number, chiIndex?: number) {
    const gs = this.gameState!;
    if (!gs.lastDiscard) return;

    const discarderIdx = gs.lastDiscardPlayer!;
    const allOptions = canAllChi(gs.players[playerIdx].hand, gs.lastDiscard.definition, playerIdx, discarderIdx);

    if (allOptions.length === 0) return;

    if (allOptions.length > 1 && chiIndex === undefined) {
      // Send chi options to player
      const conn = this.getConnectionForPlayer(playerIdx);
      if (conn) {
        this.sendTo(conn, { type: 'chi-options', options: allOptions });
      }
      return;
    }

    const chosen = allOptions[chiIndex ?? 0];
    if (!chosen) return;

    // Record claim response
    this.claimResponses.set(playerIdx, { action: 'chi', chiIndex: chiIndex ?? 0 });
    this.tryResolveClaimWindow();
  }

  handlePong(playerIdx: number) {
    this.claimResponses.set(playerIdx, { action: 'pong' });
    this.tryResolveClaimWindow();
  }

  handleKong(playerIdx: number) {
    const gs = this.gameState!;

    // Self-kong (during discard phase)
    if (gs.currentPlayerIndex === playerIdx && !gs.lastDiscard) {
      const result = doSelfKong(gs, playerIdx);
      if (result !== gs) {
        this.gameState = result;

        // Check for robbing the kong
        const kongInfo = canSelfKong(gs.players[playerIdx]);
        if (kongInfo && kongInfo.type === 'promote') {
          // Check if anyone can rob
          for (let i = 0; i < 4; i++) {
            if (i === playerIdx) continue;
            const fakeDiscard: Tile = { id: 'rob-kong', definition: kongInfo.tile.definition, faceUp: true };
            if (checkWinWithTile(result.players[i].hand, result.players[i].melds, fakeDiscard)) {
              // Someone can rob — open claim window
              this.gameState = {
                ...result,
                lastDiscard: kongInfo.tile,
                lastDiscardPlayer: playerIdx,
              };
              this.broadcastGameState();
              this.openClaimWindow(this.gameState!, playerIdx);
              return;
            }
          }
        }

        this.broadcastGameState();
        const p = result.players[playerIdx];
        if (checkWin(p.hand, p.melds)) {
          if (this.aiPlayerIndices.has(playerIdx)) {
            this.endRound(playerIdx, true);
          } else {
            this.sendTurnNotification(playerIdx, 'human-needs-discard');
          }
        } else {
          if (this.aiPlayerIndices.has(playerIdx)) {
            this.scheduleAi(() => this.runAiDiscard(playerIdx));
          } else {
            this.sendTurnNotification(playerIdx, 'human-needs-discard');
          }
        }
      }
      return;
    }

    // Exposed kong (from claim window)
    this.claimResponses.set(playerIdx, { action: 'kong' });
    this.tryResolveClaimWindow();
  }

  handleWin(playerIdx: number) {
    const gs = this.gameState!;

    // Self-draw win
    if (gs.currentPlayerIndex === playerIdx && !gs.lastDiscard) {
      const p = gs.players[playerIdx];
      if (checkWin(p.hand, p.melds)) {
        const { allowed } = canWinWithSufficientTai(p, true, gs.roundWind);
        if (!allowed) {
          const conn = this.getConnectionForPlayer(playerIdx);
          if (conn) this.sendTo(conn, { type: 'error', message: 'Not enough tai to win!' });
          return;
        }
        this.endRound(playerIdx, true);
        return;
      }
    }

    // Win from discard (claim window)
    this.claimResponses.set(playerIdx, { action: 'win' });
    this.tryResolveClaimWindow();
  }

  handlePass(playerIdx: number) {
    this.claimResponses.set(playerIdx, null);
    this.tryResolveClaimWindow();
  }

  // ── Claim window ─────────────────────────────────────────────────────

  openClaimWindow(gs: GameState, discarderIdx: number) {
    const discard = gs.lastDiscard;
    if (!discard) {
      this.advanceToNextPlayer();
      return;
    }

    this.claimResponses.clear();

    // Check each player for available claims
    let anyHumanCanClaim = false;

    for (let i = 0; i < 4; i++) {
      if (i === discarderIdx) continue;

      const player = gs.players[i];
      const canWinFromDiscard = checkWinWithTile(player.hand, player.melds, discard);
      const canKongFromDiscard = canKong(player.hand, discard.definition) !== null;
      const canPongFromDiscard = canPong(player.hand, discard.definition) !== null;
      const canChiFromDiscard = canChi(player.hand, discard.definition, i, discarderIdx) !== null;

      if (!canWinFromDiscard && !canKongFromDiscard && !canPongFromDiscard && !canChiFromDiscard) {
        // This player can't claim — auto-pass
        this.claimResponses.set(i, null);
        continue;
      }

      if (this.aiPlayerIndices.has(i)) {
        // AI decides immediately
        this.resolveAiClaim(i, gs, discard, discarderIdx);
      } else {
        // Human gets a claim window
        anyHumanCanClaim = true;
        const availableActions: ActionType[] = [];
        if (canWinFromDiscard) availableActions.push('win');
        if (canKongFromDiscard) availableActions.push('kong');
        if (canPongFromDiscard) availableActions.push('pong');
        if (canChiFromDiscard) availableActions.push('chi');
        availableActions.push('pass');

        const conn = this.getConnectionForPlayer(i);
        if (conn) {
          this.sendTo(conn, {
            type: 'claim-window',
            timeout: CLAIM_TIMEOUT,
            availableActions,
          });
        }
      }
    }

    if (!anyHumanCanClaim) {
      // All responses are in (AI + auto-passes)
      this.resolveClaimWindow();
    } else {
      // Set timeout for human responses
      this.claimTimer = setTimeout(() => {
        // Auto-pass any humans who haven't responded
        for (let i = 0; i < 4; i++) {
          if (!this.claimResponses.has(i) && i !== discarderIdx) {
            this.claimResponses.set(i, null);
          }
        }
        this.resolveClaimWindow();
      }, CLAIM_TIMEOUT);
    }
  }

  resolveAiClaim(aiIdx: number, gs: GameState, discard: Tile, discarderIdx: number) {
    const player = gs.players[aiIdx];

    // Priority: Win > Kong > Pong > Chi
    if (checkWinWithTile(player.hand, player.melds, discard)) {
      const testPlayer = { ...player, hand: [...player.hand, discard] };
      const { allowed } = canWinWithSufficientTai(testPlayer, false, gs.roundWind);
      if (allowed) {
        this.claimResponses.set(aiIdx, { action: 'win' });
        return;
      }
    }
    if (aiShouldKong(player, discard)) {
      this.claimResponses.set(aiIdx, { action: 'kong' });
      return;
    }
    if (aiShouldPong(player, discard)) {
      this.claimResponses.set(aiIdx, { action: 'pong' });
      return;
    }
    const chiTiles = aiShouldChi(player, discard, discarderIdx, aiIdx);
    if (chiTiles) {
      this.claimResponses.set(aiIdx, { action: 'chi' });
      return;
    }
    // No claim
    this.claimResponses.set(aiIdx, null);
  }

  tryResolveClaimWindow() {
    const gs = this.gameState!;
    const discarderIdx = gs.lastDiscardPlayer!;

    // Check if all non-discarders have responded
    for (let i = 0; i < 4; i++) {
      if (i === discarderIdx) continue;
      if (!this.claimResponses.has(i)) return; // still waiting
    }

    // All responses in — clear timeout and resolve
    if (this.claimTimer) {
      clearTimeout(this.claimTimer);
      this.claimTimer = null;
    }

    this.resolveClaimWindow();
  }

  resolveClaimWindow() {
    const gs = this.gameState!;
    const discarderIdx = gs.lastDiscardPlayer!;
    const discard = gs.lastDiscard!;

    // Resolve by priority: Win > Kong > Pong > Chi
    // Win — must have sufficient tai
    for (let i = 0; i < 4; i++) {
      if (i === discarderIdx) continue;
      const resp = this.claimResponses.get(i);
      if (resp?.action === 'win') {
        const testPlayer = { ...gs.players[i], hand: [...gs.players[i].hand, discard] };
        const { allowed } = canWinWithSufficientTai(testPlayer, false, gs.roundWind);
        if (!allowed) {
          const conn = this.getConnectionForPlayer(i);
          if (conn) this.sendTo(conn, { type: 'error', message: 'Not enough tai to win!' });
          continue; // Skip to next player
        }
        // Execute win
        const newHand = [...gs.players[i].hand, discard];
        const updatedPlayers = gs.players.map((p, pi) => {
          if (pi === i) return { ...p, hand: newHand };
          if (pi === discarderIdx) return { ...p, discards: p.discards.filter(t => t.id !== discard.id) };
          return p;
        });
        this.gameState = { ...gs, players: updatedPlayers, lastDiscard: null, lastDiscardPlayer: null };
        this.endRound(i, false);
        return;
      }
    }

    // Kong
    for (let i = 0; i < 4; i++) {
      if (i === discarderIdx) continue;
      const resp = this.claimResponses.get(i);
      if (resp?.action === 'kong') {
        const result = doKong(gs, i);
        if (result !== gs) {
          this.gameState = result;
          this.broadcastGameState();
          const p = result.players[i];
          if (checkWin(p.hand, p.melds)) {
            this.endRound(i, true);
            return;
          }
          if (this.aiPlayerIndices.has(i)) {
            this.scheduleAi(() => this.runAiDiscard(i));
          } else {
            this.sendTurnNotification(i, 'human-needs-discard');
          }
          return;
        }
      }
    }

    // Pong
    for (let i = 0; i < 4; i++) {
      if (i === discarderIdx) continue;
      const resp = this.claimResponses.get(i);
      if (resp?.action === 'pong') {
        const result = doPong(gs, i);
        if (result !== gs) {
          this.gameState = result;
          this.broadcastGameState();
          if (this.aiPlayerIndices.has(i)) {
            this.scheduleAi(() => this.runAiDiscard(i));
          } else {
            this.sendTurnNotification(i, 'human-needs-discard');
          }
          return;
        }
      }
    }

    // Chi (only next player after discarder)
    const chiPlayer = (discarderIdx + 1) % 4;
    if (chiPlayer !== discarderIdx) {
      const resp = this.claimResponses.get(chiPlayer);
      if (resp?.action === 'chi') {
        const allOptions = canAllChi(gs.players[chiPlayer].hand, discard.definition, chiPlayer, discarderIdx);
        const chosen = allOptions[resp.chiIndex ?? 0] ?? allOptions[0];
        if (chosen) {
          const result = doChi(gs, chiPlayer, chosen);
          if (result !== gs) {
            this.gameState = result;
            this.broadcastGameState();
            if (this.aiPlayerIndices.has(chiPlayer)) {
              this.scheduleAi(() => this.runAiDiscard(chiPlayer));
            } else {
              this.sendTurnNotification(chiPlayer, 'human-needs-discard');
            }
            return;
          }
        }
      }
    }

    // No claims — advance to next player
    this.advanceToNextPlayer();
  }

  // ── Turn progression ─────────────────────────────────────────────────

  advanceToNextPlayer() {
    const gs = this.gameState!;
    const after = advanceTurn(gs);
    this.gameState = after;
    this.broadcastGameState();

    const nextIdx = after.currentPlayerIndex;
    if (this.aiPlayerIndices.has(nextIdx)) {
      this.scheduleAi(() => this.runAiTurn());
    } else {
      this.sendTurnNotification(nextIdx, 'human-needs-draw');
    }
  }

  // ── AI logic ─────────────────────────────────────────────────────────

  scheduleAi(fn: () => void) {
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.aiTimer = setTimeout(fn, AI_DELAY);
  }

  runAiTurn() {
    const gs = this.gameState!;
    const idx = gs.currentPlayerIndex;

    if (!this.aiPlayerIndices.has(idx)) return;

    // Draw
    if (gs.wall.length === 0) {
      this.endRound(null);
      return;
    }

    const afterDraw = drawTile(gs, idx);
    this.gameState = afterDraw;
    this.broadcastGameState();

    const player = afterDraw.players[idx];

    // Check self-draw win
    if (checkWin(player.hand, player.melds)) {
      const { allowed } = canWinWithSufficientTai(player, true, afterDraw.roundWind);
      if (allowed) {
        this.scheduleAi(() => this.endRound(idx, true));
        return;
      }
    }

    // Check self-kong
    if (aiShouldSelfKong(player)) {
      const kongInfo = canSelfKong(player);
      if (kongInfo && kongInfo.type === 'promote') {
        // Check for robbing
        for (let j = 0; j < 4; j++) {
          if (j === idx) continue;
          const fakeDiscard: Tile = { id: 'rob-kong', definition: kongInfo.tile.definition, faceUp: true };
          if (checkWinWithTile(afterDraw.players[j].hand, afterDraw.players[j].melds, fakeDiscard)) {
            if (this.aiPlayerIndices.has(j)) {
              // AI robs the kong — check tai first
              const newHand = [...afterDraw.players[j].hand, kongInfo.tile];
              const testPlayer = { ...afterDraw.players[j], hand: newHand };
              const { allowed } = canWinWithSufficientTai(testPlayer, false, afterDraw.roundWind);
              if (allowed) {
                const updatedPlayers = afterDraw.players.map((p, pi) => {
                  if (pi === j) return { ...p, hand: newHand };
                  return p;
                });
                this.gameState = { ...afterDraw, players: updatedPlayers };
                this.scheduleAi(() => this.endRound(j, false));
                return;
              }
            } else {
              // Human can rob — open claim window
              this.gameState = {
                ...afterDraw,
                lastDiscard: kongInfo.tile,
                lastDiscardPlayer: idx,
              };
              this.broadcastGameState();
              this.openClaimWindow(this.gameState, idx);
              return;
            }
          }
        }
      }

      const afterKong = doSelfKong(afterDraw, idx);
      if (afterKong !== afterDraw) {
        this.gameState = afterKong;
        this.broadcastGameState();
        const pAfterKong = afterKong.players[idx];
        if (checkWin(pAfterKong.hand, pAfterKong.melds)) {
          const { allowed } = canWinWithSufficientTai(pAfterKong, true, afterKong.roundWind);
          if (allowed) {
            this.scheduleAi(() => this.endRound(idx, true));
            return;
          }
        }
        this.scheduleAi(() => this.runAiDiscard(idx));
        return;
      }
    }

    // Discard
    this.scheduleAi(() => this.runAiDiscard(idx));
  }

  runAiDiscard(idx: number) {
    const gs = this.gameState!;
    const player = gs.players[idx];
    const discardId = aiChooseDiscard(player);
    if (!discardId) {
      this.advanceToNextPlayer();
      return;
    }

    const afterDiscard = discardTile(gs, idx, discardId);
    this.gameState = afterDiscard;
    this.broadcastGameState();

    // Open claim window
    this.openClaimWindow(afterDiscard, idx);
  }

  // ── Round end ────────────────────────────────────────────────────────

  endRound(winnerIdx: number | null, isSelfDraw = false) {
    const gs = this.gameState!;
    let taiResult: TaiResult | null = null;
    let paymentResult: PaymentResult | null = null;
    let msg: string;

    if (winnerIdx !== null) {
      const winnerPlayer = gs.players[winnerIdx];
      taiResult = calculateTai(winnerPlayer, isSelfDraw, gs.roundWind);
      const shooterIdx = isSelfDraw ? null : gs.lastDiscardPlayer;
      paymentResult = calculatePayments(winnerIdx, shooterIdx, taiResult.basePoints);

      // Apply scores
      const updatedPlayers = gs.players.map((p, i) => {
        const pay = paymentResult!.payments.find(pp => pp.playerIndex === i);
        return { ...p, score: p.score + (pay?.amount ?? 0) };
      });
      this.gameState = { ...gs, players: updatedPlayers, phase: 'finished' as const };
      msg = `🏆 ${winnerPlayer.name} wins with ${taiResult.tai} tai!`;
    } else {
      this.gameState = { ...gs, phase: 'finished' as const };
      msg = 'Draw — wall exhausted!';
    }

    this.broadcast({
      type: 'round-over',
      winnerIndex: winnerIdx,
      taiResult,
      paymentResult,
      message: msg,
    });
    this.broadcastGameState();
  }

  // ── Next round ───────────────────────────────────────────────────────

  handleNextRound() {
    const gs = this.gameState!;
    const prevScores = gs.players.map(p => p.score);
    const windOrder: SeatWind[] = ['east', 'south', 'west', 'north'];

    // Check if banker won (East stays)
    const eastPlayerIdx = gs.players.findIndex(p => p.seatWind === 'east');
    const lastWinner = gs.phase === 'finished' ? this.findLastWinner(gs) : null;
    const bankerWon = lastWinner === eastPlayerIdx;

    let nextRoundNumber = gs.roundNumber;
    let nextRoundWind: WindDirection = gs.roundWind;
    let newSeatWinds: SeatWind[];

    if (bankerWon) {
      newSeatWinds = gs.players.map(p => p.seatWind);
    } else {
      nextRoundNumber = gs.roundNumber + 1;
      if (nextRoundNumber > 4) {
        const windIdx = windOrder.indexOf(gs.roundWind);
        if (windIdx < 3) {
          nextRoundWind = windOrder[windIdx + 1];
          nextRoundNumber = 1;
        } else {
          nextRoundWind = 'east';
          nextRoundNumber = 1;
        }
      }
      const seatRotation: SeatWind[] = ['east', 'south', 'west', 'north'];
      newSeatWinds = gs.players.map((p) => {
        const prevSeatIdx = seatRotation.indexOf(p.seatWind);
        return seatRotation[(prevSeatIdx + 1) % 4];
      });
    }

    const eastIdx = newSeatWinds.indexOf('east');

    // Create fresh game state
    const defs = this.shuffle(generateTileSet());
    let tileId = 0;
    const makeTile = (def: TileDefinition, faceUp = false): Tile => ({
      id: `t${tileId++}`,
      definition: def,
      faceUp,
    });

    const hands: Tile[][] = [[], [], [], []];
    let idx = 0;
    for (let p = 0; p < 4; p++) {
      for (let t = 0; t < 13; t++) {
        hands[p].push(makeTile(defs[idx++], true));
      }
    }
    hands[eastIdx].push(makeTile(defs[idx++], true));

    const wall: Tile[] = [];
    while (idx < defs.length) wall.push(makeTile(defs[idx++]));

    const bonuses: Tile[][] = [[], [], [], []];
    for (let p = 0; p < 4; p++) {
      let changed = true;
      while (changed) {
        changed = false;
        for (let t = hands[p].length - 1; t >= 0; t--) {
          if (hands[p][t].definition.type === 'bonus') {
            const bonus = hands[p].splice(t, 1)[0];
            bonuses[p].push(bonus);
            if (wall.length > 0) {
              const replacement = wall.pop()!;
              replacement.faceUp = true;
              hands[p].push(replacement);
              changed = true;
            }
          }
        }
      }
    }

    for (const h of hands) h.sort((a, b) => tileOrder(a.definition) - tileOrder(b.definition));

    this.gameState = {
      id: `game-${Date.now().toString(36)}`,
      phase: 'playing',
      players: gs.players.map((p, i) => ({
        ...p,
        seatWind: newSeatWinds[i],
        hand: hands[i],
        discards: [],
        melds: [],
        revealedBonuses: bonuses[i],
        isCurrentTurn: i === eastIdx,
        score: prevScores[i],
        isReady: true,
      })),
      wall,
      currentPlayerIndex: eastIdx,
      roundWind: nextRoundWind,
      roundNumber: nextRoundNumber,
      turnNumber: 1,
      lastDiscard: null,
      lastDiscardPlayer: null,
      tilesRemaining: wall.length,
    };

    this.broadcastGameState();

    // Start the round
    if (this.aiPlayerIndices.has(eastIdx)) {
      this.scheduleAi(() => this.runAiDiscard(eastIdx));
    } else {
      this.sendTurnNotification(eastIdx, 'human-needs-discard');
    }
  }

  findLastWinner(gs: GameState): number | null {
    // Infer winner from score changes — whoever has the highest positive change
    // For simplicity, check who has the most recent winning hand
    for (let i = 0; i < 4; i++) {
      if (checkWin(gs.players[i].hand, gs.players[i].melds)) return i;
    }
    return null;
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  filterStateForPlayer(gs: GameState, playerIdx: number): ClientGameState {
    return {
      players: gs.players.map((p, i): ClientPlayer => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        seatWind: p.seatWind,
        hand: i === playerIdx ? p.hand : [],
        handCount: p.hand.length,
        discards: p.discards,
        melds: p.melds,
        revealedBonuses: p.revealedBonuses,
        isCurrentTurn: p.isCurrentTurn,
        score: p.score,
        isReady: p.isReady,
        isConnected: p.isConnected,
        isAI: this.aiPlayerIndices.has(i),
      })),
      currentPlayerIndex: gs.currentPlayerIndex,
      roundWind: gs.roundWind,
      roundNumber: gs.roundNumber,
      turnNumber: gs.turnNumber,
      lastDiscard: gs.lastDiscard,
      lastDiscardPlayer: gs.lastDiscardPlayer,
      tilesRemaining: gs.tilesRemaining,
      phase: gs.phase,
      myIndex: playerIdx,
    };
  }

  sendTurnNotification(playerIdx: number, phase: 'human-needs-draw' | 'human-needs-discard') {
    const gs = this.gameState!;
    const player = gs.players[playerIdx];
    const availableActions: ActionType[] = [];

    if (phase === 'human-needs-draw') {
      availableActions.push('draw');
    } else if (phase === 'human-needs-discard') {
      if (canSelfKong(player)) availableActions.push('kong');
      availableActions.push('discard');
      if (checkWin(player.hand, player.melds)) availableActions.push('win');
    }

    const conn = this.getConnectionForPlayer(playerIdx);
    if (conn) {
      this.sendTo(conn, {
        type: 'your-turn',
        phase,
        availableActions,
      });
    }
  }

  getConnectionForPlayer(playerIdx: number): Party.Connection | undefined {
    const connId = this.humanConnections.get(playerIdx);
    if (!connId) return undefined;
    return this.room.getConnection(connId) ?? undefined;
  }

  broadcastRoomState() {
    const room: ClientRoom = {
      code: this.room.id.toUpperCase().slice(0, 6),
      players: this.lobbyPlayers.map((p): ClientLobbyPlayer => ({
        id: p.connectionId,
        name: p.name,
        avatar: p.avatar,
        isReady: p.isReady,
        isHost: p.isHost,
        isAI: p.connectionId.startsWith('ai-'),
      })),
      status: this.status,
      hostIndex: this.lobbyPlayers.findIndex(p => p.isHost),
    };

    this.broadcast({ type: 'room-state', room });
  }

  broadcastGameState() {
    if (!this.gameState) return;
    for (const [playerIdx, connId] of this.humanConnections) {
      const conn = this.room.getConnection(connId);
      if (conn) {
        this.sendTo(conn, {
          type: 'game-state',
          state: this.filterStateForPlayer(this.gameState, playerIdx),
        });
      }
    }
  }

  broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    for (const conn of this.room.getConnections()) {
      conn.send(data);
    }
  }

  sendTo(connection: Party.Connection, msg: ServerMessage) {
    connection.send(JSON.stringify(msg));
  }
}

// PartyKit requires a default export
MahjongRoom satisfies Party.Worker;
