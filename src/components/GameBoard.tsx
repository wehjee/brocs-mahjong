import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Tile, ActionType, Player } from '../types/game';
import type { GameEngine } from '../engine/useGameEngine';
import { checkWin, checkWinWithTile, canPong, canKong, canChi, canSelfKong } from '../engine/gameEngine';
import { useBreakpoint } from '../hooks/useResponsive';
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
function BonusTileDisplay({ player, size = 'small' }: { player: Player; size?: 'tiny' | 'small' }) {
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
        <MahjongTile key={tile.id} tile={tile} faceUp size={size} />
      ))}
    </div>
  );
}

// Display revealed melds (pong/chi/kong) for any player
function MeldDisplay({ player, size = 'small' }: { player: Player; size?: 'tiny' | 'small' }) {
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
            <MahjongTile key={tile.id} tile={tile} faceUp size={size} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Compact tile count badge for mobile opponent hands
function TileCountBadge({ count, isCurrentTurn }: { count: number; isCurrentTurn: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 32,
      height: 32,
      borderRadius: 8,
      background: isCurrentTurn
        ? 'linear-gradient(135deg, var(--amber-500), var(--amber-300))'
        : 'linear-gradient(135deg, var(--tile-back), var(--tile-back-dark))',
      border: '1px solid rgba(255,255,255,0.1)',
      fontSize: 12,
      fontWeight: 700,
      color: isCurrentTurn ? '#000' : 'rgba(255,255,255,0.6)',
    }}>
      {count}
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

  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';
  const opponentTileSize: 'tiny' | 'small' = isMobile ? 'tiny' : 'small';
  const myTileSize: 'small' | 'medium' = isMobile ? 'small' : 'medium';

  const myIndex = engine.myIndex;
  const getRelativePlayer = (offset: number) =>
    gameState.players[(myIndex + offset) % 4];

  const me = getRelativePlayer(0);        // bottom
  const right = getRelativePlayer(1);      // right
  const across = getRelativePlayer(2);     // top
  const left = getRelativePlayer(3);       // left

  // ── Claim announcement overlay ──────────────────────────────────
  const [announcement, setAnnouncement] = useState<{ text: string; color: string } | null>(null);
  const prevMessageRef = useRef(message);

  useEffect(() => {
    if (message && message !== prevMessageRef.current) {
      const lower = message.toLowerCase();
      let ann: { text: string; color: string } | null = null;
      if (lower.includes('pong')) ann = { text: 'PONG!', color: '#ef4444' };
      else if (lower.includes('kong')) ann = { text: 'KONG!', color: '#a855f7' };
      else if (lower.includes('chi')) ann = { text: 'CHI!', color: '#22c55e' };
      else if (lower.includes('wins') || lower.includes('win')) ann = { text: 'WIN!', color: '#f59e0b' };
      if (ann) {
        setAnnouncement(ann);
        setTimeout(() => setAnnouncement(null), 800);
      }
    }
    prevMessageRef.current = message;
  }, [message]);

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
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const key = e.key.toLowerCase();
      const action = HOTKEY_MAP[key];
      if (action && availableActions.includes(action)) {
        e.preventDefault();
        performAction(action);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

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
              position: 'absolute',
              width: isMobile ? 80 : isTablet ? 140 : 200,
              height: isMobile ? 80 : isTablet ? 140 : 200,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          />
          <div style={{
            fontFamily: "'Noto Sans SC', sans-serif",
            fontSize: isMobile ? 20 : 36,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.1)', lineHeight: 1,
          }}>
            {gameState.roundWind === 'east' ? '東' : gameState.roundWind === 'south' ? '南' : gameState.roundWind === 'west' ? '西' : '北'}
          </div>
          {!isMobile && (
            <div style={{
              fontFamily: "'Press Start 2P', cursive", fontSize: 7,
              color: 'rgba(255,255,255,0.07)', letterSpacing: 2,
            }}>
              ROUND {gameState.roundNumber}
            </div>
          )}
        </div>

        {/* ═══ TOP PLAYER (across): hand at top, discards below ═══ */}
        <div style={{
          position: 'absolute',
          top: isMobile ? 4 : 8, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 3 : 6,
        }}>
          <PlayerInfo player={across} isCurrentTurn={across.isCurrentTurn} position="top" compact={isMobile} />
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 3 : 6 }}>
            <MeldDisplay player={across} size={opponentTileSize} />
            {isMobile ? (
              <TileCountBadge count={across.hand.length} isCurrentTurn={across.isCurrentTurn} />
            ) : (
              <div style={{ display: 'flex', gap: 1 }}>
                {across.hand.map((tile, idx) => (
                  <MahjongTile key={tile.id} tile={tile} faceUp={false} size={opponentTileSize} index={idx} />
                ))}
              </div>
            )}
          </div>
          {!isMobile && <BonusTileDisplay player={across} size={opponentTileSize} />}
          <DiscardPool tiles={across.discards} lastDiscardId={
            gameState.lastDiscardPlayer === (myIndex + 2) % 4 ? lastDiscardId : undefined
          } />
        </div>

        {/* ═══ LEFT PLAYER: hand at left, discards to the right ═══ */}
        <div style={{
          position: 'absolute',
          left: isMobile ? 4 : 8, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'row', alignItems: 'center', gap: isMobile ? 3 : 6,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 3 : 6 }}>
            <PlayerInfo player={left} isCurrentTurn={left.isCurrentTurn} position="left" compact={isMobile} />
            {!isMobile && <MeldDisplay player={left} size={opponentTileSize} />}
            {isMobile ? (
              <TileCountBadge count={left.hand.length} isCurrentTurn={left.isCurrentTurn} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {left.hand.slice(0, 13).map((tile, idx) => (
                  <MahjongTile key={tile.id} tile={tile} faceUp={false} size={opponentTileSize} orientation="horizontal" index={idx} />
                ))}
              </div>
            )}
            {!isMobile && <BonusTileDisplay player={left} size={opponentTileSize} />}
          </div>
          {!isMobile && (
            <div style={{ maxWidth: isTablet ? 140 : 180 }}>
              <DiscardPool tiles={left.discards} lastDiscardId={
                gameState.lastDiscardPlayer === (myIndex + 3) % 4 ? lastDiscardId : undefined
              } />
            </div>
          )}
        </div>

        {/* ═══ RIGHT PLAYER: hand at right, discards to the left ═══ */}
        <div style={{
          position: 'absolute',
          right: isMobile ? 4 : 8, top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: isMobile ? 3 : 6,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 3 : 6 }}>
            <PlayerInfo player={right} isCurrentTurn={right.isCurrentTurn} position="right" compact={isMobile} />
            {!isMobile && <MeldDisplay player={right} size={opponentTileSize} />}
            {isMobile ? (
              <TileCountBadge count={right.hand.length} isCurrentTurn={right.isCurrentTurn} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {right.hand.slice(0, 13).map((tile, idx) => (
                  <MahjongTile key={tile.id} tile={tile} faceUp={false} size={opponentTileSize} orientation="horizontal" index={idx} />
                ))}
              </div>
            )}
            {!isMobile && <BonusTileDisplay player={right} size={opponentTileSize} />}
          </div>
          {!isMobile && (
            <div style={{ maxWidth: isTablet ? 140 : 180 }}>
              <DiscardPool tiles={right.discards} lastDiscardId={
                gameState.lastDiscardPlayer === (myIndex + 1) % 4 ? lastDiscardId : undefined
              } />
            </div>
          )}
        </div>

        {/* ═══ BOTTOM PLAYER (you): discards above, hand at bottom ═══ */}
        <div style={{
          position: 'absolute',
          bottom: isMobile ? 4 : 8, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 3 : 6,
          maxWidth: isMobile ? '100%' : 'none',
          width: isMobile ? '100%' : 'auto',
          padding: isMobile ? '0 4px' : 0,
        }}>
          {/* Your discards in front of you (above hand) */}
          {!isMobile && (
            <DiscardPool tiles={me.discards} lastDiscardId={
              gameState.lastDiscardPlayer === myIndex ? lastDiscardId : undefined
            } />
          )}

          {/* Message banner */}
          <AnimatePresence>
            {message && turnPhase !== 'round-over' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  padding: isMobile ? '4px 10px' : '6px 16px',
                  background: 'rgba(251, 191, 36, 0.15)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: 8, fontSize: isMobile ? 10 : 12, fontWeight: 600,
                  color: 'var(--amber-300)',
                }}
              >
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Phase + Action bar */}
          {turnPhase !== 'round-over' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 2 : 4 }}>
              {!isMobile && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                  {phaseLabel}
                </span>
              )}
              <ActionBar
                actions={availableActions}
                onAction={handleAction}
                tilesRemaining={gameState.tilesRemaining}
                compact={isMobile}
              />
            </div>
          )}

          {/* Your hand — ALWAYS face up, interactive only when discarding */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: isMobile ? 3 : 6,
            maxWidth: isMobile ? '100%' : 'none',
            overflow: isMobile ? 'auto' : 'visible',
          }}>
            {!isMobile && <PlayerInfo player={me} isCurrentTurn={me.isCurrentTurn} position="bottom" />}
            <PlayerHand
              tiles={me.hand}
              melds={me.melds}
              isCurrentPlayer={true}
              interactive={isMyTurnToDiscard}
              selectedTileId={selectedTileId}
              onTileClick={handleTileClick}
              tileSize={myTileSize}
            />
            {!isMobile && <BonusTileDisplay player={me} />}
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

      {/* Claim announcement overlay */}
      <AnimatePresence>
        {announcement && (
          <motion.div
            key="announcement"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontFamily: "'Press Start 2P', cursive",
              fontSize: isMobile ? 24 : 36,
              color: announcement.color,
              textShadow: `0 0 20px ${announcement.color}40, 0 2px 8px rgba(0,0,0,0.5)`,
              zIndex: 100,
              pointerEvents: 'none',
              letterSpacing: 4,
            }}
          >
            {announcement.text}
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
