// Pixel art broccoli rendered as an SVG grid
// This is the signature tile back design

export default function PixelBroccoli({ size = 32 }: { size?: number }) {
  const px = size / 16; // 16x16 pixel grid

  // 16x16 pixel grid for broccoli
  // 0 = transparent, 1 = dark green, 2 = mid green, 3 = light green, 4 = stem, 5 = stem light
  const grid = [
    [0,0,0,0,0,0,2,2,2,2,0,0,0,0,0,0],
    [0,0,0,0,0,2,3,3,3,3,2,0,0,0,0,0],
    [0,0,0,0,2,3,3,3,3,3,3,2,0,0,0,0],
    [0,0,0,2,3,3,3,3,3,3,3,3,2,0,0,0],
    [0,0,2,1,2,3,3,3,3,3,2,1,2,2,0,0],
    [0,2,3,3,1,2,3,3,3,2,1,3,3,3,2,0],
    [0,2,3,3,3,1,2,2,2,1,3,3,3,3,2,0],
    [2,3,3,3,3,3,1,1,1,3,3,3,3,3,3,2],
    [2,3,3,3,3,2,1,1,1,2,3,3,3,3,3,2],
    [0,2,3,3,2,2,1,1,1,2,2,3,3,3,2,0],
    [0,2,2,2,0,0,4,5,4,0,0,2,2,2,2,0],
    [0,0,0,0,0,0,4,5,4,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,4,5,4,0,0,0,0,0,0,0],
    [0,0,0,0,0,4,5,5,5,4,0,0,0,0,0,0],
    [0,0,0,0,0,4,4,4,4,4,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ];

  const colors: Record<number, string> = {
    0: 'transparent',
    1: 'var(--broc-dark, #1a5c2a)',
    2: 'var(--broc-mid, #2d8a4e)',
    3: 'var(--broc-light, #4caf50)',
    4: 'var(--broc-stem, #8d6e3f)',
    5: 'var(--broc-stem-light, #a67c52)',
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ imageRendering: 'pixelated' }}
      aria-label="Pixel broccoli"
    >
      {grid.map((row, y) =>
        row.map((cell, x) =>
          cell !== 0 ? (
            <rect
              key={`${x}-${y}`}
              x={x * px}
              y={y * px}
              width={px}
              height={px}
              fill={colors[cell]}
            />
          ) : null
        )
      )}
    </svg>
  );
}
