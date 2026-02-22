import type { Tile, Meld } from '../types/game';
import MahjongTile from './MahjongTile';

interface PlayerHandProps {
  tiles: Tile[];
  melds: Meld[];
  isCurrentPlayer: boolean;  // shows tiles face-up
  interactive: boolean;       // allows clicking/selecting tiles
  selectedTileId: string | null;
  onTileClick?: (tile: Tile) => void;
}

export default function PlayerHand({
  tiles,
  melds,
  isCurrentPlayer,
  interactive,
  selectedTileId,
  onTileClick,
}: PlayerHandProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: 2,
    }}>
      {/* Melds (revealed sets) */}
      {melds.map((meld, meldIdx) => (
        <div key={`meld-${meldIdx}`} style={{
          display: 'flex',
          gap: 1,
          marginRight: 8,
          padding: '2px 4px',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: 4,
        }}>
          {meld.tiles.map((tile, i) => (
            <MahjongTile
              key={tile.id}
              tile={tile}
              faceUp
              size="medium"
              index={i}
            />
          ))}
        </div>
      ))}

      {/* Hand tiles */}
      <div style={{
        display: 'flex',
        gap: 'var(--tile-gap)',
        alignItems: 'flex-end',
      }}>
        {tiles.map((tile, idx) => (
          <MahjongTile
            key={tile.id}
            tile={tile}
            faceUp={isCurrentPlayer}
            size="medium"
            interactive={interactive}
            selected={selectedTileId === tile.id}
            onClick={() => interactive && onTileClick?.(tile)}
            index={idx}
          />
        ))}
      </div>
    </div>
  );
}
