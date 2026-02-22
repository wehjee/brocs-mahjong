import { motion } from 'framer-motion';
import type { Tile } from '../types/game';
import TileFace from './TileFace';
import PixelBroccoli from './PixelBroccoli';

interface MahjongTileProps {
  tile: Tile;
  faceUp?: boolean;
  size?: 'small' | 'medium' | 'large';
  interactive?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  orientation?: 'vertical' | 'horizontal';
  index?: number;
}

const sizeMap = {
  small: { width: 32, height: 44, brocSize: 18 },
  medium: { width: 44, height: 60, brocSize: 26 },
  large: { width: 56, height: 76, brocSize: 34 },
};

export default function MahjongTile({
  tile,
  faceUp,
  size = 'medium',
  interactive = false,
  selected = false,
  highlighted = false,
  onClick,
  orientation = 'vertical',
  index = 0,
}: MahjongTileProps) {
  const showFace = faceUp ?? tile.faceUp;
  const s = sizeMap[size];

  const isHorizontal = orientation === 'horizontal';
  const w = isHorizontal ? s.height : s.width;
  const h = isHorizontal ? s.width : s.height;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: selected ? -8 : 0,
      }}
      transition={{
        opacity: { delay: index * 0.02, duration: 0.3 },
        y: { type: 'spring', stiffness: 400, damping: 25 },
      }}
      whileHover={interactive ? {
        y: -4,
        transition: { type: 'spring', stiffness: 500, damping: 25 },
      } : undefined}
      whileTap={interactive ? { scale: 0.96 } : undefined}
      onClick={onClick}
      style={{
        width: w,
        height: h,
        borderRadius: 'var(--tile-radius)',
        cursor: interactive ? 'pointer' : 'default',
        position: 'relative',
        perspective: 600,
        flexShrink: 0,
      }}
    >
      {/* Tile body */}
      <div style={{
        width: '100%',
        height: '100%',
        borderRadius: 'var(--tile-radius)',
        background: showFace
          ? 'linear-gradient(160deg, #faf6ee 0%, var(--tile-face) 50%, #ebe5d5 100%)'
          : `linear-gradient(160deg, var(--tile-back) 0%, var(--tile-back-dark) 100%)`,
        boxShadow: selected
          ? '0 6px 20px rgba(251, 191, 36, 0.4), 0 0 0 2px var(--amber-400), inset 0 1px 0 rgba(255,255,255,0.2)'
          : highlighted
          ? '0 4px 12px rgba(59, 173, 102, 0.3), 0 0 0 2px var(--jade-400), inset 0 1px 0 rgba(255,255,255,0.2)'
          : 'var(--shadow-tile)',
        border: showFace
          ? '1px solid var(--tile-border)'
          : '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease',
      }}>
        {showFace ? (
          <TileFace definition={tile.definition} size={size} />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            background: `
              repeating-linear-gradient(
                45deg,
                transparent,
                transparent 3px,
                rgba(255,255,255,0.03) 3px,
                rgba(255,255,255,0.03) 6px
              )
            `,
          }}>
            <PixelBroccoli size={s.brocSize} />
          </div>
        )}
      </div>

      {/* Bottom edge (3D effect) */}
      <div style={{
        position: 'absolute',
        bottom: -2,
        left: 1,
        right: 1,
        height: 3,
        background: showFace
          ? 'linear-gradient(to bottom, var(--tile-shadow), #b5a88a)'
          : 'linear-gradient(to bottom, var(--tile-back-dark), #0a2a16)',
        borderRadius: '0 0 var(--tile-radius) var(--tile-radius)',
        zIndex: -1,
      }} />
    </motion.div>
  );
}
