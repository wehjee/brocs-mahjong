import { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Tile, ActionType, Player } from '../types/game';
import type { GameEngine } from '../engine/useGameEngine';
import { checkWin, checkWinWithTile, canPong, canKong, canChi, canSelfKong } from '../engine/gameEngine';
import PlayerHand from './PlayerHand';
import DiscardPool from './DiscardPool';
import PlayerInfo from './PlayerInfo';
import ActionBar from './ActionBar';
import MahjongTile from './MahjongTile';
import WinScreen from './WinScreen';

interface GameBoardProps {
  engine: GameEngine;
  onPlayAgain: () => void;
}

// Small display for revealed bonus tiles (flowers/animals)
function BonusTileDisplay({ player }: { player: Player }) {
  if (player.revealedBonuses.length === 0) return null;
  return (
    <div style={{
      display: 'flex',
      gap: 2,
      padding: '3px 6px',
      background: 'rgba(251, 191, 36, 0.1)',
      border: '1px solid rgba(251, 191, 36, 0.2)',
      borderRadius: 6,
    }}>
      {player.revealedBonuses.map((tile) => (
        <MahjongTile key={tile.id} tile={tile} faceUp size="small" />
      ))}
    </div>
  );
}

// Display revealed melds (pong/chi/kong) for any player
function MeldDisplay({ player }: { player: Player }) {
  if (player.melds.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {player.melds.map((meld, mi) => (
        <div key={`meld-${mi}`} style={{
          display: 'flex',
          gap: 1,
          padding: '2px 4px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 4,
        }}>
          {meld.tiles.map((tile) => (
            <MahjongTile key={tile.id} tile={tile} faceUp size="small" />
          ))}
        </div>
      ))}
    </div>
  );
}

const HOTKEY_MAP: Record<string, ActionType> = {
  'd': 'draw',
  'x': 'discard',
  'c': 'chi',
  'p': 'pong',
  'k': 'kong',
  'w': 'win',
  ' ': 'pass',
};

export default function GameBoard({ engine, onPlayAgain }: GameBoardProps) {
  const {
    gameState,
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
  } = engine;

  const myIndex = engine.myIndex;
  const getRelativePlayer = (offset: number) =>
    gameState.players[(myIndex + offset) % 4];

  const me = getRelativePlayer(0);        // bottom
  const right = getRelativePlayer(1);      // right
  const across = getRelativePlayer(2);     // top
  const left = getRelativePlayer(3);       // left

  const handleTileClick = (tile: Tile) => {
    selectTile(tile.id);
  };

  const handleAction = useCallback((action: ActionType) => {
    performAction(action);
  }, [performAction]);

  // Only show buttons when the action is actually available
  const canWinSelfDraw = checkWin(me.hand, me.melds) && me.hand.length === 14 - me.melds.length * 3;
  const lastDiscard = gameState.lastDiscard;
  const lastDiscarder = gameState.lastDiscardPlayer;

  const availableActions: ActionType[] = (() => {
    switch (turnPhase) {
      case 'human-needs-draw':
        return ['draw' as ActionType];
      case 'human-needs-discard': {
        const actions: ActionType[] = [];
        if (canSelfKong(me)) actions.push('kong');
        if (selectedTileId) actions.push('discard');
        if (canWinSelfDraw) actions.push('win');
        return actions;
      }
      case 'claim-window': {
        if (!lastDiscard || lastDiscarder === null) return ['pass' as ActionType];
        const actions: ActionType[] = [];
        const canWinFromDiscard = checkWinWithTile(me.hand, me.melds, lastDiscard);
        if (canWinFromDiscard) actions.push('win');
        if (canKong(me.hand, lastDiscard.definition)) actions.push('kong');
        if (canPong(me.hand, lastDiscard.definition)) actions.push('pong');
        if (canChi(me.hand, lastDiscard.definition, 0, lastDiscarder)) actions.push('chi');
        actions.push('pass');
        return actions;
      }
      default:
        return [];
    }
  })();

  // ── Keyboard shortcuts ──────────────────────────────────────────────
  // Use refs to always access the latest values in the keydown handler
  // without needing to teardown/re-register the listener on every render.
  const availableActionsRef = useRef(availableActions);
  availableActionsRef.current = availableActions;
  const handleActionRef = useRef(handleAction);
  handleActionRef.current = handleAction;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const action = HOTKEY_MAP[e.key.toLowerCase()];
      if (action && availableActionsRef.current.includes(action)) {
        e.preventDefault();
        handleActionRef.current(action);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const phaseLabel = (() => {
    switch (turnPhase) {
      case 'human-needs-draw': return 'Your turn — Draw a tile';
      case 'human-needs-discard': return 'Select a tile to discard';
      case 'claim-window': return 'Claim or Pass';
      case 'ai-thinking': return 'Opponents playing...';
      default: return '';
    }
  })();

  const isMyTurnToDiscard = turnPhase === 'human-needs-discard';
  const lastDiscardId = gameState.lastDiscard?.id;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-deep)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background felt */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, var(--felt-color) 0%, var(--felt-dark) 60%, var(--bg-deep) 100%)',
        opacity: 0.9,
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='6' height='6' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='1' height='1' fill='%23ffffff' opacity='0.02'/%3E%3C/svg%3E")`,
        backgroundSize: '6px 6px',
      }} />

      {/* Main layout — absolute positioned player zones facing inward */}
      <div style={{ position: 'relative', flex: 1, zIndex: 1 }}>

        {/* Center: Round wind indicator */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          pointerEvents: 'none', zIndex: 0,
        }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 60, ease: 'linear' }}
            style={{
              position: 'absolute', width: 200, height: 200, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          />
          <div style={{
            fontFamily: "'Noto Sans SC', sans-serif", fontSize: 36, fontWeight: 700,
            color: 'rgba(255,255,255,0.1)', lineHeight: 1,
          }}>
            {gameState.roundWind === 'east' ? '東' : gameState.roundWind === 'south' ? '南' : gameState.roundWind === 'west' ? '西' : '北'}
          </div>
          <div style={{
            fontFamily: "'Press Start 2P', cursive", fontSize: 7,
            color: 'rgba(255,255,255,0.07)', letterSpacing: 2,
          }}>
            ROUND {gameState.roundNumber}
          </div>
        </div>

        {/* ═══ TOP PLAYER (across): hand at top, discards below ═══ */}
        <div style={{
          position: 'absolute',
          top: 8, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <PlayerInfo player={across} isCurrentTurn={across.isCurrentTurn} position="top" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MeldDisplay player={across} />
            <div style={{ display: 'flex', gap: 1 }}>
              {across.hand.map((tile, idx) => (
                <MahjongTile key={tile.id} tile={tile} faceUp={false} size="small" index={idx} />
              ))}
            </div>
          </div>
          <BonusTileDisplay player={across} />
          {/* Discards in front of them */}
          <DiscardPool tiles={across.discards} lastDiscardId={
            gameState.lastDiscardPlayer === (myIndex + 2) % 4 ? lastDiscardId : undefined
          } />
        </div>

        {/* ═══ LEFT PLAYER: hand at left, discards to the right ═══ */}
        <div style={{
          position: 'absolute',
          left: 8, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 6,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <PlayerInfo player={left} isCurrentTurn={left.isCurrentTurn} position="left" />
            <MeldDisplay player={left} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {left.hand.slice(0, 13).map((tile, idx) => (
                <MahjongTile key={tile.id} tile={tile} faceUp={false} size="small" orientation="horizontal" index={idx} />
              ))}
            </div>
            <BonusTileDisplay player={left} />
          </div>
          {/* Discards in front of them */}
          <div style={{ maxWidth: 180 }}>
            <DiscardPool tiles={left.discards} lastDiscardId={
              gameState.lastDiscardPlayer === (myIndex + 3) % 4 ? lastDiscardId : undefined
            } />
          </div>
        </div>

        {/* ═══ RIGHT PLAYER: hand at right, discards to the left ═══ */}
        <div style={{
          position: 'absolute',
          right: 8, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <PlayerInfo player={right} isCurrentTurn={right.isCurrentTurn} position="right" />
            <MeldDisplay player={right} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {right.hand.slice(0, 13).map((tile, idx) => (
                <MahjongTile key={tile.id} tile={tile} faceUp={false} size="small" orientation="horizontal" index={idx} />
              ))}
            </div>
            <BonusTileDisplay player={right} />
          </div>
          {/* Discards in front of them */}
          <div style={{ maxWidth: 180 }}>
            <DiscardPool tiles={right.discards} lastDiscardId={
              gameState.lastDiscardPlayer === (myIndex + 1) % 4 ? lastDiscardId : undefined
            } />
          </div>
        </div>

        {/* ═══ BOTTOM PLAYER (you): discards above, hand at bottom ═══ */}
        <div style={{
          position: 'absolute',
          bottom: 8, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          {/* Your discards in front of you (above hand) */}
          <DiscardPool tiles={me.discards} lastDiscardId={
            gameState.lastDiscardPlayer === myIndex ? lastDiscardId : undefined
          } />

          {/* Message banner */}
          <AnimatePresence>
            {message && turnPhase !== 'round-over' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  padding: '6px 16px',
                  background: 'rgba(251, 191, 36, 0.15)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: 8, fontSize: 12, fontWeight: 600,
                  color: 'var(--amber-300)',
                }}
              >
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Phase + Action bar */}
          {turnPhase !== 'round-over' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                {phaseLabel}
              </span>
              <ActionBar
                actions={availableActions}
                onAction={handleAction}
                tilesRemaining={gameState.tilesRemaining}
              />
            </div>
          )}

          {/* Your hand — ALWAYS face up, interactive only when discarding */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <PlayerInfo player={me} isCurrentTurn={me.isCurrentTurn} position="bottom" />
            <PlayerHand
              tiles={me.hand}
              melds={me.melds}
              isCurrentPlayer={true}
              interactive={isMyTurnToDiscard}
              selectedTileId={selectedTileId}
              onTileClick={handleTileClick}
            />
            <BonusTileDisplay player={me} />
          </div>
        </div>
      </div>

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 8, right: 12,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '6px 14px', background: 'rgba(0,0,0,0.3)',
        backdropFilter: 'blur(8px)', borderRadius: 8, zIndex: 10,
      }}>
        <span style={{ fontFamily: "'Press Start 2P', cursive", fontSize: 8, color: 'var(--jade-300)', letterSpacing: 1 }}>
          BROCS MJ · SG
        </span>
        <div style={{ width: 1, height: 14, background: 'var(--border-subtle)' }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Turn {gameState.turnNumber}
        </span>
      </div>

      {/* Chi selection overlay */}
      <AnimatePresence>
        {chiOptions && chiOptions.length > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 90,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                padding: '24px 32px',
                background: 'linear-gradient(160deg, var(--bg-card), var(--bg-surface))',
                borderRadius: 16,
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              }}
            >
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--amber-300)',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}>
                Choose Chi Combination
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                {chiOptions.map((combo, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => selectChi(idx)}
                    style={{
                      display: 'flex',
                      gap: 3,
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      cursor: 'pointer',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--amber-400)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)'; }}
                  >
                    {combo.map((tile) => (
                      <MahjongTile key={tile.id} tile={tile} faceUp size="medium" />
                    ))}
                    {/* Show the discard tile completing the sequence */}
                    {gameState.lastDiscard && (
                      <MahjongTile
                        tile={gameState.lastDiscard}
                        faceUp
                        size="medium"
                        highlighted
                      />
                    )}
                  </motion.button>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Click a combination to complete your Chi
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Win overlay */}
      <AnimatePresence>
        {turnPhase === 'round-over' && (
          <WinScreen
            winner={winner !== null ? gameState.players[winner] : null}
            message={message ?? 'Game Over'}
            taiResult={taiResult}
            paymentResult={paymentResult}
            players={gameState.players}
            roundInfo={{ roundWind: gameState.roundWind, roundNumber: gameState.roundNumber }}
            onNextRound={startNextRound}
            onPlayAgain={onPlayAgain}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
