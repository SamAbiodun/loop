"use client";

import { useEffect, useRef, useState } from "react";

/** Brightness says how live it is; shape says what kind of quiet. */
export type MeterState =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "muted"
  | "micPaused"
  | "error"
  | "ended";

export const METER_LABEL: Record<MeterState, string> = {
  idle: "ready",
  connecting: "connecting",
  listening: "listening",
  speaking: "speaking",
  muted: "muted",
  micPaused: "mic paused · interviewer speaking",
  error: "error",
  ended: "ended",
};

const BAR_COLOR: Record<MeterState, string> = {
  idle: "bg-g-4",
  connecting: "bg-g-2",
  listening: "bg-g-3",
  speaking: "bg-g-0",
  muted: "bg-g-4",
  micPaused: "bg-g-4",
  error: "bg-g-4",
  ended: "bg-g-4",
};

// Centre bars swing more than the edges so a single level still reads as a
// voice rather than a volume knob.
const SPREAD = [0.55, 0.85, 1, 0.8, 0.6];
const FLAT = 0.12;
// Reduced motion: three stepped brightness levels, no movement.
const STEPPED: Record<"listening" | "speaking", string[]> = {
  listening: ["bg-g-5", "bg-g-4", "bg-g-3", "bg-g-4", "bg-g-5"],
  speaking: ["bg-g-3", "bg-g-2", "bg-g-0", "bg-g-2", "bg-g-3"],
};

/** Deterministic, smooth pseudo-voice pattern keyed to time (fallback when no
 *  analyser is available for the interviewer's audio). */
export function patternLevel(tSeconds: number, bar: number): number {
  const a = Math.sin(tSeconds * 6.1 + bar * 1.7);
  const b = Math.sin(tSeconds * 2.3 + bar * 0.9);
  const c = Math.sin(tSeconds * 11.7 + bar * 2.6);
  return 0.35 + 0.22 * a + 0.18 * b + 0.1 * c;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

type VoiceMeterProps = {
  state: MeterState;
  /** Current input level 0..1 for `listening`; null when unavailable. */
  getMicLevel?: () => number | null;
  /** Current interviewer output level 0..1 for `speaking`; null → pattern. */
  getSpeakerLevel?: () => number | null;
  /** Bar height in px. */
  height?: number;
  className?: string;
};

export function VoiceMeter({
  state,
  getMicLevel,
  getSpeakerLevel,
  height = 56,
  className = "",
}: VoiceMeterProps) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const smoothed = useRef<number[]>([FLAT, FLAT, FLAT, FLAT, FLAT]);
  const reduced = useReducedMotion();
  const micRef = useRef(getMicLevel);
  const spkRef = useRef(getSpeakerLevel);
  useEffect(() => {
    micRef.current = getMicLevel;
    spkRef.current = getSpeakerLevel;
  }, [getMicLevel, getSpeakerLevel]);

  const animated =
    !reduced &&
    (state === "listening" || state === "speaking" || state === "connecting");

  useEffect(() => {
    const paint = (levels: number[]) => {
      bars.current.forEach((el, i) => {
        if (el) el.style.height = `${Math.round(Math.min(1, Math.max(FLAT, levels[i])) * 100)}%`;
      });
    };
    if (!animated) {
      smoothed.current = [FLAT, FLAT, FLAT, FLAT, FLAT];
      paint(
        reduced && (state === "listening" || state === "speaking")
          ? [0.3, 0.55, 0.8, 0.55, 0.3]
          : state === "muted" || state === "micPaused"
            ? [0.3, 0.3, 0.3, 0.3, 0.3]
            : [FLAT, FLAT, FLAT, FLAT, FLAT],
      );
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      const t = now / 1000;
      let target: number[];
      if (state === "connecting") {
        const lit = Math.floor(t / 0.45) % 5;
        target = SPREAD.map((_, i) => (i === lit ? 0.9 : 0.18));
      } else if (state === "listening") {
        const lvl = micRef.current?.() ?? 0;
        target = SPREAD.map((s) => FLAT + lvl * s * (1 - FLAT));
      } else {
        const lvl = spkRef.current?.() ?? null;
        target =
          lvl === null
            ? SPREAD.map((_, i) => patternLevel(t, i))
            : SPREAD.map((s, i) => FLAT + lvl * s * (1 - FLAT) + 0.04 * Math.sin(t * 9 + i));
      }
      // Fast attack, slower release: bars jump up with the voice and fall back
      // without flicker.
      smoothed.current = smoothed.current.map((prev, i) => {
        const next = target[i];
        return next > prev ? prev + (next - prev) * 0.6 : prev + (next - prev) * 0.25;
      });
      paint(smoothed.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animated, state, reduced]);

  if (state === "error") {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        style={{ height }}
        role="img"
        aria-label="error"
      >
        <span className="block h-7 w-7 rounded-full border-2 border-ink" />
      </div>
    );
  }

  const stepped = reduced && (state === "listening" || state === "speaking");

  return (
    <div
      className={`relative flex items-center gap-1.5 ${className}`}
      style={{ height }}
      role="img"
      aria-label={METER_LABEL[state]}
    >
      {SPREAD.map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
          className={`block w-1.5 rounded-full transition-[height,opacity] duration-100 ${
            stepped ? STEPPED[state as "listening" | "speaking"][i] : BAR_COLOR[state]
          } ${state === "micPaused" && i === 2 ? "opacity-0" : ""}`}
          style={{ height: `${FLAT * 100}%` }}
        />
      ))}
      {state === "muted" && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 rotate-[-55deg] bg-ink"
        />
      )}
    </div>
  );
}

/** Screen-reader announcement of state changes, rendered once per room. */
export function MeterAnnouncer({ state }: { state: MeterState }) {
  return (
    <span aria-live="polite" className="sr-only">
      {`Interviewer ${METER_LABEL[state]}`}
    </span>
  );
}
