import type { SVGAttributes } from "react";

// 24px grid, 1.5px stroke, currentColor. Replaces the emoji and unicode glyphs.
const PATHS = {
  mic: "M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm-5-3a5 5 0 0 0 10 0M12 17v4M9 21h6",
  micOff:
    "M9 9v3a3 3 0 0 0 5.1 2.1M15 10V7a3 3 0 0 0-5.6-1.5M7 12a5 5 0 0 0 7.9 4.1M17 12a5 5 0 0 1-.4 2M12 17v4M9 21h6M4 4l16 16",
  play: "M8 6v12l10-6Z",
  pause: "M8 6h3v12H8ZM13 6h3v12h-3Z",
  stop: "M7 7h10v10H7Z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6 6 18",
  chevronRight: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  arrowLeft: "M19 12H5m6-6-6 6 6 6",
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  eye: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  warning: "M12 3 2 20h20L12 3Zm0 7v4m0 3v.5",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5Z",
  unlock: "M7 11V8a5 5 0 0 1 9.6-1.9M5 11h14v10H5Z",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6",
  copy: "M8 8h12v12H8ZM4 16V4h12",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L14.8 3H9.2l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L4.7 11a7.4 7.4 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.6h5.6l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1Z",
  refresh: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
  volume: "M4 10v4h4l5 4V6L8 10H4Zm12-1a4 4 0 0 1 0 6m2.5-9a8 8 0 0 1 0 12",
  headphones: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H4Zm13 0h3v6h-3Z",
  nudge: "M12 3a6 6 0 0 0-3 11.2V17h6v-2.8A6 6 0 0 0 12 3Zm-2 17h4",
  code: "M8 8l-4 4 4 4m8-8 4 4-4 4M14 5l-4 14",
  phase: "M12 21a9 9 0 1 0 0-18M12 3a9 9 0 0 0-6.4 2.6",
  ring: "M12 21a9 9 0 1 0-9-9",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0",
  send: "M3 11l18-8-8 18-2-8-8-2Z",
  spark: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 16,
  className = "",
  ...rest
}: { name: IconName; size?: number } & SVGAttributes<SVGSVGElement>) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
