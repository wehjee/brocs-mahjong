import { motion } from 'framer-motion';
import type { Player, SeatWind } from '../types/game';

interface PlayerInfoProps {
  player: Player;
  isCurrentTurn: boolean;
  position: 'bottom' | 'right' | 'top' | 'left';
  compact?: boolean;
}

const WIND_LABELS: Record<SeatWind, string> = {
  east: '東', south: '南', west: '西', north: '北',
};

export default function PlayerInfo({ player, isCurrentTurn, position, compact = false }: PlayerInfoProps) {
  const isVertical = position === 'left' || position === 'right';
  const avatarSize = compact ? 28 : 36;

  return (
    <motion.div
      animate={{
        boxShadow: isCurrentTurn
          ? '0 0 20px rgba(251, 191, 36, 0.3), 0 0 0 1px rgba(251, 191, 36, 0.4)'
          : '0 2px 8px rgba(0,0,0,0.2)',
      }}
      style={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'center',
        gap: compact ? 4 : 8,
        padding: compact ? '4px 8px' : '8px 12px',
        background: isCurrentTurn
          ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(251, 191, 36, 0.05))'
          : 'rgba(0,0,0,0.25)',
        borderRadius: compact ? 8 : 10,
        backdropFilter: 'blur(8px)',
        minWidth: isVertical ? 'auto' : compact ? 100 : 140,
      }}
    >
      {/* Avatar */}
      <div style={{
        width: avatarSize,
        height: avatarSize,
        borderRadius: '50%',
        background: isCurrentTurn
          ? 'linear-gradient(135deg, var(--amber-500), var(--amber-300))'
          : 'linear-gradient(135deg, var(--jade-600), var(--jade-400))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: compact ? 14 : 18,
        flexShrink: 0,
        border: player.isConnected ? 'none' : '2px dashed rgba(255,255,255,0.3)',
        opacity: player.isConnected ? 1 : 0.5,
      }}>
        {player.avatar}
      </div>

      {/* Info */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isVertical ? 'center' : 'flex-start',
        gap: compact ? 1 : 2,
        overflow: 'hidden',
      }}>
        <div style={{
          fontSize: compact ? 10 : 12,
          fontWeight: 600,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: compact ? 50 : 80,
        }}>
          {player.name}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 2 : 4,
          fontSize: compact ? 8 : 10,
          color: 'var(--text-secondary)',
        }}>
          <span style={{
            fontFamily: "'Noto Sans SC', sans-serif",
            fontWeight: 700,
            fontSize: compact ? 10 : 12,
            color: isCurrentTurn ? 'var(--amber-400)' : 'var(--text-muted)',
          }}>
            {WIND_LABELS[player.seatWind]}
          </span>
          {!compact && (
            <span style={{ color: 'var(--text-muted)' }}>
              {player.hand.length} tiles
            </span>
          )}
        </div>
      </div>

      {/* Turn indicator */}
      {isCurrentTurn && (
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{
            width: compact ? 5 : 6,
            height: compact ? 5 : 6,
            borderRadius: '50%',
            background: 'var(--amber-400)',
            flexShrink: 0,
          }}
        />
      )}
    </motion.div>
  );
}
