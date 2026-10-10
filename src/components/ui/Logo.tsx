// Logo 06: the dot-matrix ring, 13 of 16 dots lit, the loop still closing.
const LIT = [
  [16, 5.5],
  [20.02, 6.3],
  [23.42, 8.58],
  [25.7, 11.98],
  [26.5, 16],
  [25.7, 20.02],
  [23.42, 23.42],
  [20.02, 25.7],
  [16, 26.5],
  [11.98, 25.7],
  [8.58, 23.42],
  [6.3, 20.02],
  [5.5, 16],
];
const DIM = [
  [6.3, 11.98],
  [8.58, 8.58],
  [11.98, 6.3],
];

export function DotRing({
  size = 32,
  className = "",
  lit = "currentColor",
  dim = "var(--ink-subtle)",
}: {
  size?: number;
  className?: string;
  lit?: string;
  dim?: string;
}) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" width={size} height={size} className={`shrink-0 ${className}`}>
      <g fill={lit}>
        {LIT.map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={2.1} />
        ))}
      </g>
      <g fill={dim}>
        {DIM.map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={1.3} />
        ))}
      </g>
    </svg>
  );
}

/** Icon tile plus wordmark. `tile` draws the ring on a square of the live colour. */
export function Logo({
  size = 28,
  wordmark = true,
  tile = true,
  className = "",
}: {
  size?: number;
  wordmark?: boolean;
  tile?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {tile ? (
        <span
          className="inline-flex items-center justify-center rounded-md bg-live text-live-fg"
          style={{ width: size, height: size }}
        >
          <DotRing size={size * 0.78} dim="var(--ink-subtle)" />
        </span>
      ) : (
        <DotRing size={size} className="text-ink" />
      )}
      {wordmark && (
        <span
          className="font-sans font-medium tracking-[-0.03em] text-ink"
          style={{ fontSize: size * 0.82, lineHeight: 1 }}
        >
          loop
        </span>
      )}
    </span>
  );
}
