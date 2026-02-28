import { motion } from 'framer-motion';
import type { Player } from '../types/game';
import type { TaiResult, PaymentResult } from '../engine/gameEngine';
import { useBreakpoint } from '../hooks/useResponsive';
import PixelBroccoli from './PixelBroccoli';
import MahjongTile from './MahjongTile';

interface WinScreenProps {
  winner: Player | null;
  message: string;
  taiResult: TaiResult | null;
  paymentResult: PaymentResult | null;
  players: Player[];
  roundInfo: { roundWind: string; roundNumber: number };
  onNextRound: () => void;
  onPlayAgain: () => void;
}

const WIND_LABELS: Record<string, string> = { east: 'East', south: 'South', west: 'West', north: 'North' };

export default function WinScreen({ winner, message, taiResult, paymentResult, players, roundInfo, onNextRound, onPlayAgain }: WinScreenProps) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const tileSize: 'tiny' | 'small' = isMobile ? 'tiny' : 'small';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: isMobile ? 14 : 20,
          padding: isMobile ? '20px 16px' : '36px 48px',
          background: 'linear-gradient(160deg, var(--bg-card), var(--bg-surface))',
          borderRadius: isMobile ? 14 : 20,
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          maxWidth: isMobile ? '92vw' : 540,
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {/* Trophy / Draw icon */}
        <motion.div
          animate={{ y: [0, -8, 0], rotate: [0, 3, -3, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
        >
          {winner ? (
            <div style={{ fontSize: 48 }}>🏆</div>
          ) : (
            <PixelBroccoli size={56} />
          )}
        </motion.div>

        {/* Message */}
        <div style={{
          fontFamily: "'Press Start 2P', cursive",
          fontSize: winner ? 14 : 11,
          color: winner ? 'var(--amber-400)' : 'var(--text-secondary)',
          textAlign: 'center',
          lineHeight: 1.8,
        }}>
          {message}
        </div>

        {/* Winner's hand */}
        {winner && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              Winning hand:
            </div>

            {/* Melds */}
            {winner.melds.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {winner.melds.map((meld, mi) => (
                  <div key={mi} style={{
                    display: 'flex', gap: 2,
                    padding: '3px 5px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: 6,
                  }}>
                    {meld.tiles.map((tile) => (
                      <MahjongTile key={tile.id} tile={tile} faceUp size={tileSize} />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Hand tiles */}
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
              {winner.hand.map((tile) => (
                <MahjongTile key={tile.id} tile={tile} faceUp size={tileSize} />
              ))}
            </div>

            {/* Revealed bonus tiles */}
            {winner.revealedBonuses.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Bonus tiles:</div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {winner.revealedBonuses.map((tile) => (
                    <MahjongTile key={tile.id} tile={tile} faceUp size={tileSize} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tai breakdown */}
        {taiResult && taiResult.breakdown.length > 0 && (
          <div style={{
            width: '100%',
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--amber-300)',
              textAlign: 'center',
              letterSpacing: 1,
            }}>
              TAI BREAKDOWN
            </div>
            {taiResult.breakdown.map((item, idx) => (
              <div key={idx} style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}>
                <span>{item.name}</span>
                <span style={{ fontWeight: 700, color: 'var(--amber-400)' }}>+{item.tai}</span>
              </div>
            ))}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-primary)',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 6,
              marginTop: 2,
            }}>
              <span>Total</span>
              <span style={{ color: 'var(--amber-400)' }}>{taiResult.tai} tai</span>
            </div>
          </div>
        )}

        {/* Payment summary */}
        {paymentResult && (
          <div style={{
            width: '100%',
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.15)',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--jade-300)',
              textAlign: 'center',
              letterSpacing: 1,
            }}>
              PAYMENTS
            </div>
            {paymentResult.payments.map((pay) => {
              const player = players[pay.playerIndex];
              const isPositive = pay.amount > 0;
              return (
                <div key={pay.playerIndex} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{player.avatar}</span>
                    <span>{player.name}</span>
                  </span>
                  <span style={{
                    fontWeight: 700,
                    color: isPositive ? '#4ade80' : '#f87171',
                  }}>
                    {isPositive ? '+' : ''}{pay.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Round info */}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          {WIND_LABELS[roundInfo.roundWind]} Wind — Round {roundInfo.roundNumber} of 4
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNextRound}
            style={{
              padding: '14px 36px',
              background: 'linear-gradient(135deg, var(--jade-500), var(--jade-700))',
              border: 'none',
              borderRadius: 12,
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
              letterSpacing: 0.5,
            }}
          >
            Next Round
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPlayAgain}
            style={{
              padding: '14px 24px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            New Game
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
