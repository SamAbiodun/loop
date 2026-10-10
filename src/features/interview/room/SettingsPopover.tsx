"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Icon, Label } from "@/components/ui";

type SettingsPopoverProps = {
  gateDb: number;
  onGateDb: (db: number) => void;
  gateEnabled: boolean;
  hideClock: boolean;
  onHideClock: (hide: boolean) => void;
};

/** The "..." menu: noise gate and the clock toggle, out of the header's way. */
export function SettingsPopover({
  gateDb,
  onGateDb,
  gateEnabled,
  hideClock,
  onHideClock,
}: SettingsPopoverProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <Button
        size="sm"
        variant="ghost"
        aria-label="Session settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="px-2"
      >
        <Icon name="dots" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-line-strong bg-surface p-3 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between">
              <Label>Noise gate</Label>
              <span className="font-mono text-[11px] text-ink-subtle">{gateDb} dB</span>
            </span>
            <input
              type="range"
              min={-70}
              max={-30}
              step={1}
              value={gateDb}
              disabled={!gateEnabled}
              onChange={(e) => onGateDb(Number(e.target.value))}
              className="w-full accent-g-1 disabled:opacity-40"
            />
            <span className="text-[11px] leading-snug text-ink-subtle">
              Mic sound quieter than this never reaches the interviewer. Raise it
              if room noise gets through; lower it if it clips your voice.
            </span>
          </label>
          <label className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="flex items-center gap-2 text-sm text-ink">
              <Icon name="clock" size={14} className="text-ink-muted" />
              Hide clock
            </span>
            <input
              type="checkbox"
              checked={hideClock}
              onChange={(e) => onHideClock(e.target.checked)}
              className="h-4 w-4 accent-g-1"
            />
          </label>
        </div>
      )}
    </div>
  );
}
