import { useState } from 'react';
import { motion } from 'framer-motion';
import PixelBroccoli from './PixelBroccoli';

const AVATAR_OPTIONS = ['🥦', '🍄', '🌽', '🥕', '🐉', '🀄', '🎋', '🌸', '🔥', '🐱', '🦊', '🎲'];

interface HomePageProps {
  onCreateRoom: (playerName: string, avatar: string) => void;
  onJoinRoom: (playerName: string, roomCode: string, avatar: string) => void;
  onPlaySolo: (playerName: string, avatar: string) => void;
}

export default function HomePage({ onCreateRoom, onJoinRoom, onPlaySolo }: HomePageProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🥦');
  const [mode, setMode] = useState<'home' | 'join'>('home');

  const canCreate = playerName.trim().length > 0;
  const canJoin = playerName.trim().length > 0 && roomCode.trim().length === 4;

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
      {/* Animated background grid */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse at 50% 30%, rgba(26, 107, 58, 0.3) 0%, transparent 60%),
          radial-gradient(ellipse at 20% 80%, rgba(45, 138, 78, 0.1) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 60%, rgba(26, 92, 42, 0.15) 0%, transparent 50%)
        `,
      }} />

      {/* Pixel grid overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />

      {/* Floating tiles in background */}
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.sin(i) * 15, 0],
            rotate: [0, 5 + i, -5 - i, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: 8 + i * 1.2,
            delay: i * 0.6,
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            left: `${5 + (i * 8.3) % 90}%`,
            top: `${5 + (i * 13.7) % 85}%`,
            opacity: 0.04 + (i % 3) * 0.01,
          }}
        >
          <PixelBroccoli size={32 + (i % 4) * 12} />
        </motion.div>
      ))}

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 40,
          zIndex: 1,
          width: '100%',
          maxWidth: 440,
          padding: '0 24px',
        }}
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {/* Pixel broccoli hero */}
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          >
            <PixelBroccoli size={80} />
          </motion.div>

          <div style={{
            fontFamily: "'Press Start 2P', cursive",
            fontSize: 22,
            color: 'var(--text-primary)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            BROCS
            <br />
            <span style={{ color: 'var(--jade-400)', fontSize: 14 }}>MAHJONG</span>
          </div>

          <div style={{
            fontSize: 14,
            color: 'var(--text-muted)',
            textAlign: 'center',
            lineHeight: 1.6,
            maxWidth: 300,
          }}>
            Singapore style mahjong with friends.
            <br />
            4 players. Pixel broccoli. Good times.
          </div>
        </motion.div>

        {/* Name input */}
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <label style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: 1,
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            Your Name
          </label>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={16}
            style={{
              width: '100%',
              padding: '14px 16px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              color: 'var(--text-primary)',
              fontSize: 16,
              fontFamily: "'DM Sans', sans-serif",
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--jade-500)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
          />
        </div>

        {/* Avatar picker */}
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <label style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: 1,
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            Avatar
          </label>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}>
            {AVATAR_OPTIONS.map(emoji => (
              <motion.button
                key={emoji}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedAvatar(emoji)}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  border: selectedAvatar === emoji
                    ? '2px solid var(--amber-400)'
                    : '1px solid var(--border-subtle)',
                  background: selectedAvatar === emoji
                    ? 'rgba(251, 191, 36, 0.1)'
                    : 'rgba(0,0,0,0.2)',
                  fontSize: 20,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                {emoji}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        {mode === 'home' ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            width: '100%',
          }}>
            <motion.button
              whileHover={canCreate ? { scale: 1.02 } : undefined}
              whileTap={canCreate ? { scale: 0.98 } : undefined}
              onClick={() => canCreate && onCreateRoom(playerName.trim(), selectedAvatar)}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: canCreate
                  ? 'linear-gradient(135deg, var(--jade-500), var(--jade-700))'
                  : 'rgba(255,255,255,0.03)',
                border: canCreate ? 'none' : '1px solid var(--border-subtle)',
                borderRadius: 14,
                color: canCreate ? 'white' : 'var(--text-muted)',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "'DM Sans', sans-serif",
                cursor: canCreate ? 'pointer' : 'not-allowed',
                letterSpacing: 0.5,
              }}
            >
              Create Room
            </motion.button>

            <motion.button
              whileHover={canCreate ? { scale: 1.02 } : undefined}
              whileTap={canCreate ? { scale: 0.98 } : undefined}
              onClick={() => canCreate && setMode('join')}
              style={{
                width: '100%',
                padding: '16px 24px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                color: canCreate ? 'var(--text-secondary)' : 'var(--text-muted)',
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: canCreate ? 'pointer' : 'not-allowed',
              }}
            >
              Join Room
            </motion.button>

            <div style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              margin: '4px 0',
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            </div>

            <motion.button
              whileHover={canCreate ? { scale: 1.02 } : undefined}
              whileTap={canCreate ? { scale: 0.98 } : undefined}
              onClick={() => canCreate && onPlaySolo(playerName.trim(), selectedAvatar)}
              style={{
                width: '100%',
                padding: '14px 24px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 14,
                color: canCreate ? 'var(--text-secondary)' : 'var(--text-muted)',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: canCreate ? 'pointer' : 'not-allowed',
              }}
            >
              🤖 Play Solo vs AI
            </motion.button>
          </div>
        ) : (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              width: '100%',
            }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <label style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                letterSpacing: 1,
                textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="XXXX"
                maxLength={4}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  color: 'var(--amber-400)',
                  fontSize: 24,
                  fontFamily: "'Press Start 2P', cursive",
                  letterSpacing: 8,
                  textAlign: 'center',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--jade-500)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode('home')}
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
                Back
              </motion.button>

              <motion.button
                whileHover={canJoin ? { scale: 1.02 } : undefined}
                whileTap={canJoin ? { scale: 0.98 } : undefined}
                onClick={() => canJoin && onJoinRoom(playerName.trim(), roomCode.trim(), selectedAvatar)}
                style={{
                  flex: 2,
                  padding: '14px 24px',
                  background: canJoin
                    ? 'linear-gradient(135deg, var(--amber-500), var(--amber-700))'
                    : 'rgba(255,255,255,0.03)',
                  border: canJoin ? 'none' : '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  color: canJoin ? '#000' : 'var(--text-muted)',
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: canJoin ? 'pointer' : 'not-allowed',
                }}
              >
                Join Game
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Footer */}
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          textAlign: 'center',
          opacity: 0.5,
        }}>
          Singapore Rules  ·  4 Players  ·  144 Tiles
        </div>
      </motion.div>
    </div>
  );
}
