import { motion } from 'framer-motion';
import type { ActionType } from '../types/game';

interface ActionBarProps {
  actions: ActionType[];
  onAction: (action: ActionType) => void;
  tilesRemaining: number;
}

const ACTION_CONFIG: Record<ActionType, { label: string; icon: string; color: string; hotkey: string }> = {
  draw: { label: 'Draw', icon: '📥', color: '#3498db', hotkey: 'D' },
  discard: { label: 'Discard', icon: '📤', color: '#e67e22', hotkey: 'X' },
  chi: { label: 'Chi', icon: '🔗', color: '#2ecc71', hotkey: 'C' },
  pong: { label: 'Pong', icon: '🔺', color: '#e74c3c', hotkey: 'P' },
  kong: { label: 'Kong', icon: '💎', color: '#9b59b6', hotkey: 'K' },
  win: { label: 'Win!', icon: '🏆', color: '#f1c40f', hotkey: 'W' },
  pass: { label: 'Pass', icon: '⏭', color: '#7f8c8d', hotkey: 'Space' },
};

export default function ActionBar({
  actions,
  onAction,
  tilesRemaining,
}: ActionBarProps) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 20px',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
        borderRadius: 14,
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Wall counter */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        paddingRight: 12,
        borderRight: '1px solid var(--border-subtle)',
        minWidth: 50,
      }}>
        <span style={{
          fontFamily: "'Press Start 2P', cursive",
          fontSize: 14,
          color: 'var(--amber-400)',
        }}>
          {tilesRemaining}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1 }}>
          WALL
        </span>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        {actions.map((action) => {
          const config = ACTION_CONFIG[action];
          return (
            <motion.button
              key={action}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onAction(action)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                border: 'none',
                borderRadius: 8,
                background: `linear-gradient(135deg, ${config.color}, ${config.color}cc)`,
                color: 'white',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer',
                boxShadow: `0 2px 8px ${config.color}40`,
                transition: 'all 0.2s ease',
              }}
            >
              <span>{config.icon}</span>
              <span>{config.label}</span>
              <span style={{
                fontSize: 9,
                opacity: 0.7,
                padding: '1px 4px',
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 3,
              }}>
                {config.hotkey}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
