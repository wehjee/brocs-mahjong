import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBreakpoint } from '../hooks/useResponsive';

interface ScoringReferenceProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TaiPattern {
  name: string;
  tai: string;
  desc?: string;
}

interface TaiCategory {
  title: string;
  patterns: TaiPattern[];
}

const SCORING_DATA: TaiCategory[] = [
  {
    title: 'Bonus Tiles',
    patterns: [
      { name: 'Each Flower', tai: '1', desc: 'Each flower tile in your bonus area' },
      { name: 'Each Animal', tai: '1', desc: 'Each animal tile in your bonus area' },
      { name: 'Matching Flower', tai: '1', desc: 'Flower number matches your seat wind' },
      { name: 'Matching Animal', tai: '1', desc: 'Animal number matches your seat wind' },
      { name: 'All 4 Flowers', tai: '+1', desc: 'Bonus for having all four flowers' },
      { name: 'All 4 Animals', tai: '+1', desc: 'Bonus for having all four animals' },
      { name: 'Cat & Mouse', tai: '1', desc: 'Both cat and mouse animals' },
      { name: 'Rooster & Centipede', tai: '1', desc: 'Both rooster and centipede animals' },
    ],
  },
  {
    title: 'Basic Hand',
    patterns: [
      { name: 'Self-Drawn Win', tai: '1', desc: 'Win by drawing the tile yourself' },
      { name: 'No Bonus Tiles', tai: '1', desc: 'Win with zero flowers and animals' },
      { name: 'Concealed Hand', tai: '1', desc: 'No open melds (concealed kongs OK)' },
    ],
  },
  {
    title: 'Melds',
    patterns: [
      { name: 'All Pongs', tai: '2', desc: 'All melds are pongs or kongs, no chi' },
      { name: 'Dragon Pong / Kong', tai: '1 each', desc: 'Red, green, or white dragon set' },
      { name: 'Seat Wind Pong / Kong', tai: '1', desc: 'Wind set matching your seat wind' },
      { name: 'Round Wind Pong / Kong', tai: '1', desc: 'Wind set matching the round wind' },
    ],
  },
  {
    title: 'Flushes',
    patterns: [
      { name: 'Half Flush', tai: '2', desc: 'One suit mixed with honor tiles' },
      { name: 'Full Flush', tai: '4', desc: 'Entire hand is one suit, no honors' },
    ],
  },
  {
    title: 'Limit Hands',
    patterns: [
      { name: 'Small Three Dragons', tai: '4', desc: '2 dragon pongs + 1 dragon pair' },
      { name: 'Big Three Dragons', tai: '8', desc: 'Pong/kong of all 3 dragons' },
      { name: 'Small Four Winds', tai: '8', desc: '3 wind pongs + 1 wind pair' },
      { name: 'Big Four Winds', tai: '10', desc: 'Pong/kong of all 4 winds' },
      { name: 'All Honors', tai: '10', desc: 'Only wind and dragon tiles' },
      { name: 'All Terminals', tai: '10', desc: 'Only 1s and 9s of number suits' },
    ],
  },
];

export default function ScoringReference({ isOpen, onClose }: ScoringReferenceProps) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 95,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.85, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: isMobile ? '94vw' : 440,
              maxHeight: '82vh',
              background: 'linear-gradient(160deg, var(--bg-card), var(--bg-surface))',
              borderRadius: isMobile ? 14 : 18,
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: isMobile ? '16px 16px 12px' : '20px 24px 16px',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
            }}>
              <div style={{
                fontFamily: "'Press Start 2P', cursive",
                fontSize: isMobile ? 10 : 12,
                color: 'var(--amber-400)',
                letterSpacing: 1,
              }}>
                SCORING GUIDE
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-muted)',
                  fontSize: 16,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                ×
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{
              overflowY: 'auto',
              padding: isMobile ? '12px 16px 16px' : '16px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? 16 : 20,
            }}>
              {SCORING_DATA.map((category) => (
                <div key={category.title}>
                  {/* Category header */}
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--amber-300)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: 1.5,
                    marginBottom: 8,
                    paddingBottom: 4,
                    borderBottom: '1px solid rgba(251, 191, 36, 0.1)',
                  }}>
                    {category.title}
                  </div>

                  {/* Pattern rows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {category.patterns.map((pattern) => (
                      <div key={pattern.name} style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '5px 0',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: isMobile ? 11 : 12,
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.3,
                          }}>
                            {pattern.name}
                          </div>
                          {pattern.desc && (
                            <div style={{
                              fontSize: isMobile ? 9 : 10,
                              color: 'var(--text-muted)',
                              lineHeight: 1.4,
                              marginTop: 1,
                            }}>
                              {pattern.desc}
                            </div>
                          )}
                        </div>
                        <div style={{
                          fontSize: isMobile ? 12 : 13,
                          fontWeight: 700,
                          color: 'var(--amber-400)',
                          flexShrink: 0,
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {pattern.tai}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Footer note */}
              <div style={{
                fontSize: 9,
                color: 'var(--text-muted)',
                textAlign: 'center',
                lineHeight: 1.6,
                paddingTop: 8,
                borderTop: '1px solid var(--border-subtle)',
              }}>
                Minimum 1 tai required to win · Maximum 10 tai (capped)
                <br />
                Base points = 2<sup>tai</sup> · Patterns stack
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
