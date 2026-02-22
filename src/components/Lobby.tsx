import { useState } from 'react';
import { motion } from 'framer-motion';
import type { LobbyPlayer } from '../types/game';
import PixelBroccoli from './PixelBroccoli';

interface LobbyProps {
  roomCode: string;
  players: LobbyPlayer[];
  isHost: boolean;
  onStartGame: () => void;
  onLeave: () => void;
  onToggleReady: () => void;
  currentPlayerId: string;
}

const SEAT_LABELS = ['東 East', '南 South', '西 West', '北 North'];
const SEAT_EMOJIS = ['🥦', '🍄', '🌽', '🥕'];

export default function Lobby({
  roomCode,
  players,
  isHost,
  onStartGame,
  onLeave,
  onToggleReady,
  currentPlayerId,
}: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const allReady = players.length === 4 && players.every(p => p.isReady);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-deep)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse at 30% 20%, rgba(26, 107, 58, 0.2) 0%, transparent 60%),
          radial-gradient(ellipse at 70% 80%, rgba(45, 138, 78, 0.15) 0%, transparent 50%)
        `,
      }} />

      {/* Floating broccoli decorations */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 10, -10, 0],
            opacity: [0.05, 0.08, 0.05],
          }}
          transition={{
            repeat: Infinity,
            duration: 5 + i * 0.7,
            delay: i * 0.5,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            left: `${10 + (i * 12) % 80}%`,
            top: `${15 + (i * 17) % 70}%`,
            opacity: 0.05,
            transform: `scale(${0.8 + (i % 3) * 0.4})`,
          }}
        >
          <PixelBroccoli size={48 + (i % 3) * 16} />
        </motion.div>
      ))}

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
          zIndex: 1,
          width: '100%',
          maxWidth: 560,
          padding: '0 24px',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            fontFamily: "'Press Start 2P', cursive",
            fontSize: 10,
            color: 'var(--jade-400)',
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}>
            Game Lobby
          </div>

          {/* Room code */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCopyCode}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 24px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <span style={{
              fontFamily: "'Press Start 2P', cursive",
              fontSize: 20,
              letterSpacing: 6,
              color: 'var(--amber-400)',
            }}>
              {roomCode}
            </span>
            <span style={{
              fontSize: 12,
              color: copied ? 'var(--jade-300)' : 'var(--text-muted)',
              transition: 'color 0.2s',
            }}>
              {copied ? '✓ Copied!' : '📋 Copy'}
            </span>
          </motion.button>
          <span style={{
            fontSize: 12,
            color: 'var(--text-muted)',
          }}>
            Share this code to invite players
          </span>
        </div>

        {/* Player seats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          width: '100%',
        }}>
          {Array.from({ length: 4 }).map((_, i) => {
            const player = players[i];
            const isMe = player?.id === currentPlayerId;

            return (
              <motion.div
                key={i}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  background: player
                    ? isMe
                      ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.05))'
                      : 'rgba(255,255,255,0.03)'
                    : 'rgba(255,255,255,0.01)',
                  border: player
                    ? isMe
                      ? '1px solid rgba(251, 191, 36, 0.3)'
                      : '1px solid var(--border-subtle)'
                    : '1px dashed rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  transition: 'all 0.3s ease',
                }}
              >
                {/* Avatar / Empty slot */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: player
                    ? 'linear-gradient(135deg, var(--jade-600), var(--jade-400))'
                    : 'rgba(255,255,255,0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: player ? 22 : 16,
                  flexShrink: 0,
                }}>
                  {player ? SEAT_EMOJIS[i] : '?'}
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  flex: 1,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: player ? 'var(--text-primary)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {player ? (
                      <>
                        {player.name}
                        {player.isHost && (
                          <span style={{
                            marginLeft: 6,
                            fontSize: 9,
                            padding: '2px 5px',
                            background: 'var(--amber-500)',
                            color: '#000',
                            borderRadius: 4,
                            fontWeight: 700,
                            verticalAlign: 'middle',
                          }}>
                            HOST
                          </span>
                        )}
                      </>
                    ) : 'Waiting...'}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: 'var(--text-muted)',
                  }}>
                    <span style={{ fontFamily: "'Noto Sans SC', sans-serif" }}>
                      {SEAT_LABELS[i]}
                    </span>
                    {player && (
                      <span style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: player.isReady
                          ? 'rgba(39, 174, 96, 0.2)'
                          : 'rgba(255,255,255,0.05)',
                        color: player.isReady ? '#27ae60' : 'var(--text-muted)',
                        fontWeight: 600,
                      }}>
                        {player.isReady ? '✓ Ready' : 'Not Ready'}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: 12,
          width: '100%',
        }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onLeave}
            style={{
              flex: 1,
              padding: '14px 24px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              color: 'var(--text-secondary)',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            Leave Room
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onToggleReady}
            style={{
              flex: 1,
              padding: '14px 24px',
              background: players.find(p => p.id === currentPlayerId)?.isReady
                ? 'rgba(255,255,255,0.05)'
                : 'linear-gradient(135deg, var(--jade-500), var(--jade-600))',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              color: 'var(--text-primary)',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            {players.find(p => p.id === currentPlayerId)?.isReady ? 'Cancel Ready' : '✓ Ready Up'}
          </motion.button>

          {isHost && (
            <motion.button
              whileHover={allReady ? { scale: 1.02 } : undefined}
              whileTap={allReady ? { scale: 0.98 } : undefined}
              onClick={allReady ? onStartGame : undefined}
              style={{
                flex: 1.5,
                padding: '14px 24px',
                background: allReady
                  ? 'linear-gradient(135deg, var(--amber-500), var(--amber-700))'
                  : 'rgba(255,255,255,0.03)',
                border: allReady ? 'none' : '1px solid var(--border-subtle)',
                borderRadius: 12,
                color: allReady ? '#000' : 'var(--text-muted)',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                cursor: allReady ? 'pointer' : 'not-allowed',
                opacity: allReady ? 1 : 0.5,
              }}
            >
              {allReady ? '🀄 Start Game' : `Waiting (${players.length}/4)`}
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
