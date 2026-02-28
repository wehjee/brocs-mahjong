import type { TileDefinition } from '../types/game';

interface TileFaceProps {
  definition: TileDefinition;
  size?: 'tiny' | 'small' | 'medium' | 'large';
}

// Chinese characters for the tile faces
const CHINESE_NUMBERS: Record<number, string> = {
  1: '一', 2: '二', 3: '三', 4: '四', 5: '五',
  6: '六', 7: '七', 8: '八', 9: '九',
};

const WIND_CHARS: Record<string, string> = {
  east: '東', south: '南', west: '西', north: '北',
};

const DRAGON_CHARS: Record<string, { char: string; color: string }> = {
  red: { char: '中', color: 'var(--dragon-red)' },
  green: { char: '發', color: 'var(--dragon-green)' },
  white: { char: '', color: 'var(--dragon-white)' },
};

const FLOWER_NAMES = ['梅', '蘭', '竹', '菊'];
const ANIMAL_NAMES = ['🐱', '🐭', '🐓', '🐛'];
const ANIMAL_LABELS = ['Cat', 'Mouse', 'Rooster', 'Centipede'];

const sizeMap = {
  tiny: { fontSize: 8, subSize: 5, width: 24, height: 32 },
  small: { fontSize: 10, subSize: 7, width: 32, height: 44 },
  medium: { fontSize: 14, subSize: 9, width: 44, height: 60 },
  large: { fontSize: 18, subSize: 12, width: 56, height: 76 },
};

export default function TileFace({ definition, size = 'medium' }: TileFaceProps) {
  const s = sizeMap[size];

  const renderContent = () => {
    switch (definition.type) {
      case 'suit':
        return renderSuitTile(definition.suit, definition.value, s);
      case 'wind':
        return renderWindTile(definition.direction, s);
      case 'dragon':
        return renderDragonTile(definition.color, s);
      case 'bonus':
        return renderBonusTile(definition.bonusType, definition.value, s);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      fontFamily: "'Noto Sans SC', sans-serif",
      userSelect: 'none',
    }}>
      {renderContent()}
    </div>
  );
}

function renderSuitTile(suit: string, value: number, s: { fontSize: number; subSize: number }) {
  const suitColors: Record<string, string> = {
    bamboo: 'var(--suit-bamboo)',
    character: 'var(--suit-character)',
    dot: 'var(--suit-dot)',
  };

  const suitSymbols: Record<string, string> = {
    bamboo: '🀇',
    character: '萬',
    dot: '●',
  };

  const color = suitColors[suit];

  if (suit === 'dot') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <span style={{ fontSize: s.fontSize * 1.1, fontWeight: 700, color, lineHeight: 1 }}>
          {value}
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 1, maxWidth: s.fontSize * 2 }}>
          {Array.from({ length: Math.min(value, 5) }).map((_, i) => (
            <span key={i} style={{ fontSize: s.subSize * 0.7, color, lineHeight: 1 }}>●</span>
          ))}
        </div>
      </div>
    );
  }

  if (suit === 'character') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <span style={{ fontSize: s.fontSize, fontWeight: 700, color, lineHeight: 1.1 }}>
          {CHINESE_NUMBERS[value]}
        </span>
        <span style={{ fontSize: s.subSize, color, lineHeight: 1.1, fontWeight: 700 }}>
          {suitSymbols.character}
        </span>
      </div>
    );
  }

  // Bamboo
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span style={{ fontSize: s.fontSize * 0.85, fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </span>
      <div style={{ display: 'flex', gap: 1 }}>
        {Array.from({ length: Math.min(value, 4) }).map((_, i) => (
          <div key={i} style={{
            width: 2,
            height: s.fontSize * 0.7,
            background: `linear-gradient(to bottom, ${color}, #1a5c2a)`,
            borderRadius: 1,
          }} />
        ))}
      </div>
    </div>
  );
}

function renderWindTile(direction: string, s: { fontSize: number }) {
  return (
    <span style={{
      fontSize: s.fontSize * 1.3,
      fontWeight: 700,
      color: 'var(--wind-color)',
      lineHeight: 1,
    }}>
      {WIND_CHARS[direction]}
    </span>
  );
}

function renderDragonTile(color: string, s: { fontSize: number }) {
  const dragon = DRAGON_CHARS[color];

  if (color === 'white') {
    return (
      <div style={{
        width: s.fontSize * 1.5,
        height: s.fontSize * 1.8,
        border: `2px solid var(--dragon-white)`,
        borderRadius: 3,
      }} />
    );
  }

  return (
    <span style={{
      fontSize: s.fontSize * 1.3,
      fontWeight: 900,
      color: dragon.color,
      lineHeight: 1,
    }}>
      {dragon.char}
    </span>
  );
}

function renderBonusTile(bonusType: string, value: number, s: { fontSize: number }) {
  const isFlower = bonusType === 'flower';

  if (isFlower) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <span style={{ fontSize: s.fontSize * 0.6, color: '#e74c3c', fontWeight: 700, lineHeight: 1 }}>
          {value}
        </span>
        <span style={{ fontSize: s.fontSize * 1.1, fontWeight: 700, color: '#e74c3c', lineHeight: 1 }}>
          {FLOWER_NAMES[value - 1]}
        </span>
      </div>
    );
  }

  // Animal tiles
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <span style={{ fontSize: s.fontSize * 1.2, lineHeight: 1.1 }}>
        {ANIMAL_NAMES[value - 1]}
      </span>
      <span style={{ fontSize: s.fontSize * 0.45, color: '#6c3483', fontWeight: 700, lineHeight: 1, letterSpacing: -0.5 }}>
        {ANIMAL_LABELS[value - 1]}
      </span>
    </div>
  );
}
