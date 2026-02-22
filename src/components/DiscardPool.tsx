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
      {tiles.map((tile, idx) => (
        <motion.div
          key={tile.id}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: idx * 0.05, type: 'spring', stiffness: 400, damping: 25 }}
        >
          <MahjongTile
            tile={tile}
            faceUp
            size="small"
            highlighted={tile.id === lastDiscardId}
            index={idx}
          />
        </motion.div>
      ))}
    </div>
  );
}
