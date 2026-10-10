"use client";

import { Label } from "@/components/ui";

export const METER_MIN_DB = -70;
export const METER_MAX_DB = -10;
export const GATE_MIN_DB = -70;
export const GATE_MAX_DB = -30;
const SEGMENTS = 40;

// Lit segments brighten left to right, g-2 → g-0, on a night strip so the
// meter reads the same way the room does: light is the signal.
const RAMP = ["bg-g-2", "bg-g-2", "bg-g-1", "bg-g-1", "bg-g-0"];

export function formatDb(db: number): string {
  if (!Number.isFinite(db)) return "-inf dB";
  return `${Math.round(db)} dB`;
}

function fraction(db: number): number {
  const f = (db - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB);
  return Math.min(1, Math.max(0, f));
}

export function LevelMeter({
  levelDb,
  gateDb,
  onGateChange,
}: {
  levelDb: number;
  gateDb: number;
  onGateChange: (db: number) => void;
}) {
  const lit = Math.round(fraction(levelDb) * SEGMENTS);
  const gateIndex = Math.round(fraction(gateDb) * SEGMENTS);
  const open = levelDb >= gateDb;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>level</Label>
        <Label className={open ? "text-ink" : "text-ink-subtle"}>
          {formatDb(levelDb)} · gate {open ? "open" : "closed"}
        </Label>
      </div>

      <div className="relative h-10 rounded-md bg-g-8 px-2">
        <div className="flex h-full items-center gap-[2px]">
          {Array.from({ length: SEGMENTS }, (_, i) => {
            const isLit = i < lit;
            const belowGate = i < gateIndex;
            const ramp = RAMP[Math.floor((i / SEGMENTS) * RAMP.length)];
            const tone = !isLit ? "bg-g-6" : belowGate ? "bg-g-4" : ramp;
            return (
              <span
                key={i}
                aria-hidden
                className={`h-5 flex-1 rounded-[1px] transition-colors duration-75 ${tone}`}
              />
            );
          })}
        </div>

        {/* Gate marker: the visible line, driven by the invisible range below. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-g-0"
          style={{ left: `calc(0.5rem + (100% - 1rem) * ${fraction(gateDb)})` }}
        >
          <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-g-0" />
        </span>
        <input
          type="range"
          aria-label="Noise gate threshold in decibels"
          min={GATE_MIN_DB}
          max={GATE_MAX_DB}
          step={1}
          value={gateDb}
          onChange={(e) => onGateChange(Number(e.target.value))}
          className="absolute inset-y-0 left-2 m-0 h-full cursor-ew-resize appearance-none bg-transparent opacity-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-g-0"
          style={{ width: `calc((100% - 1rem) * ${fraction(GATE_MAX_DB)})` }}
        />
      </div>

      <div className="relative h-4 px-2">
        <Label className="absolute left-2 text-ink-subtle">{METER_MIN_DB}</Label>
        <Label
          className="absolute -translate-x-1/2 text-ink"
          style={{ left: `calc(0.5rem + (100% - 1rem) * ${fraction(gateDb)})` }}
        >
          gate {formatDb(gateDb)}
        </Label>
        <Label className="absolute right-2 text-ink-subtle">{METER_MAX_DB}</Label>
      </div>
    </div>
  );
}
