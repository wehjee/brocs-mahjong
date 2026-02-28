import { motion } from 'framer-motion';
import type { Tile } from '../types/game';
import MahjongTile from './MahjongTile';

interface DiscardPoolProps {
  tiles: Tile[];
  lastDiscardId?: string;
}

export default function DiscardPool({ tiles, lastDiscardId }: DiscardPoolProps) {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 2,
      maxWidth: 210,
      minHeight: 44,
      padding: 4,
    }}>
      {tiles.map((tile, idx) => {
        const isLast = tile.id === lastDiscardId;
        return (
          <motion.div
            key={tile.id}
            initial={{ scale: 0.3, opacity: 0, y: 20 }}
            animate={{
              scale: 1,
              opacity: 1,
              y: 0,
            }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 30,
            }}
            style={{ position: 'relative' }}
          >
            {/* Glow pulse on last discard */}
            {isLast && (
              <motion.div
                initial={{ opacity: 0.6, scale: 1 }}
                animate={{ opacity: 0, scale: 1.8 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  inset: -4,
                  borderRadius: 6,
                  background: 'var(--amber-400)',
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              />
            )}
            <MahjongTile
              tile={tile}
              faceUp
              size="small"
              highlighted={isLast}
              index={idx}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
