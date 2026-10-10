"use client";

import { useMemo, useState } from "react";
import { Button, Frame, Icon, Label, Logo, Pill, Statement } from "@/components/ui";
import {
  DEFAULT_MODE,
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  REALTIME_MODELS,
  type InterviewMode,
} from "@/features/voice";
import {
  CATEGORIES,
  OPEN_PROBLEMS,
  PROBLEMS,
  groupByCategory,
  type Problem,
} from "./problems";
import { usePasscodeGate } from "./PasscodeGate";

type ProblemPickerProps = {
  onStart: (problem: Problem, mode: InterviewMode) => void;
};

const MODES = Object.keys(REALTIME_MODELS) as InterviewMode[];
const READOUT = `${PROBLEMS.length} problems · ${CATEGORIES.length} categories`;

// Faint 2px dot matrix behind the hero only; sits under the text, g-2 on paper.
const DOT_MATRIX = {
  backgroundImage: "radial-gradient(var(--g-2) 1px, transparent 1.2px)",
  backgroundSize: "18px 18px",
  maskImage: "linear-gradient(to bottom, black 55%, transparent)",
  WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent)",
} as const;

function matches(p: Problem, q: string): boolean {
  if (!q) return true;
  return `${p.title} ${p.category} ${p.difficulty}`.toLowerCase().includes(q);
}

export function ProblemPicker({ onStart }: ProblemPickerProps) {
  const gate = usePasscodeGate();
  const [includeOpen, setIncludeOpen] = useState(false);
  const [mode, setMode] = useState<InterviewMode>(DEFAULT_MODE);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const pool = includeOpen ? [...PROBLEMS, ...OPEN_PROBLEMS] : PROBLEMS;
    const q = query.trim().toLowerCase();
    return groupByCategory(pool.filter((p) => matches(p, q)));
  }, [includeOpen, query]);

  const total = useMemo(
    () => groups.reduce((n, [, ps]) => n + ps.length, 0),
    [groups],
  );

  return (
    <div data-theme="paper" className="bg-bg text-ink min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col border-x border-line">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <Logo size={28} />
          <div className="flex items-center gap-4">
            <Label className="text-ink-subtle">{READOUT}</Label>
            {gate.required && (
              <Button variant="ghost" size="sm" onClick={() => void gate.logout()}>
                Sign out
              </Button>
            )}
          </div>
        </div>

        <header className="relative overflow-hidden border-b border-line px-6 py-14 sm:px-10 sm:py-20">
          <div aria-hidden className="absolute inset-0 opacity-70" style={DOT_MATRIX} />
          <div className="relative flex max-w-2xl flex-col gap-5">
            <Label>NeetCode 150 · 18 categories</Label>
            <Statement className="text-[40px] font-normal sm:text-[56px] sm:font-light">
              Pick a problem.
            </Statement>
            <p className="font-sans text-base leading-relaxed text-ink-muted sm:text-lg">
              Every one written to be read aloud.
            </p>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-10 px-6 py-10 sm:px-10">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label>interviewer</Label>
              <Label className="text-ink-subtle">{REALTIME_MODELS[mode]}</Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {MODES.map((m) => {
                const selected = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMode(m)}
                    className={`flex items-start justify-between gap-4 rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-muted/40 ${
                      selected
                        ? "border-ink bg-raised"
                        : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    <span className="flex flex-col gap-1.5">
                      <span className="font-sans text-sm font-medium text-ink">
                        {MODE_LABELS[m]}
                      </span>
                      <span className="text-xs leading-relaxed text-ink-muted">
                        {MODE_DESCRIPTIONS[m]}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        selected ? "border-ink bg-ink text-bg" : "border-line-strong"
                      }`}
                    >
                      {selected && <Icon name="check" size={10} strokeWidth={2.5} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, category or difficulty"
              className="h-11 rounded-lg border border-line-strong bg-raised px-3.5 font-sans text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-ink focus-visible:ring-2 focus-visible:ring-ink-muted/30"
            />
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={includeOpen}
                onChange={(e) => setIncludeOpen(e.target.checked)}
                className="h-3.5 w-3.5 accent-g-8"
              />
              Include open-dataset problems ({OPEN_PROBLEMS.length}, competitive-style)
            </label>
          </section>

          <Frame caption="problems" readout={String(total)}>
            <div className="max-h-[32rem] overflow-y-auto bg-surface">
              {total === 0 ? (
                <p className="p-5 text-sm text-ink-muted">No problems match.</p>
              ) : (
                groups.map(([category, problems]) => (
                  <div key={category}>
                    <div className="sticky top-0 z-10 border-b border-line bg-surface px-4 py-2">
                      <Label>{category}</Label>
                    </div>
                    {problems.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onStart(p, mode)}
                        className="group flex w-full items-center justify-between gap-3 border-b border-line px-4 py-3 text-left font-sans text-sm text-ink transition-colors last:border-b-0 hover:bg-raised focus-visible:bg-raised focus-visible:outline-none"
                      >
                        <span>{p.title}</span>
                        <span className="flex items-center gap-3">
                          <Pill>{p.difficulty}</Pill>
                          <Icon
                            name="chevronRight"
                            className="text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                          />
                        </span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </Frame>
        </main>

        <footer className="flex items-center justify-between border-t border-line px-6 py-4 sm:px-10">
          <Label className="text-ink-subtle">loop · voice DSA interviews</Label>
          <Label className="text-ink-subtle">step 1 of 2 · pick</Label>
        </footer>
      </div>
    </div>
  );
}
