"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_MODE,
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  REALTIME_MODELS,
  type InterviewMode,
} from "@/features/voice";
import {
  OPEN_PROBLEMS,
  PROBLEMS,
  groupByCategory,
  type Difficulty,
  type Problem,
} from "./problems";
import { usePasscodeGate } from "./PasscodeGate";

type ProblemPickerProps = {
  onStart: (problem: Problem, mode: InterviewMode) => void;
};

const MODES = Object.keys(REALTIME_MODELS) as InterviewMode[];

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  Easy: "bg-raised text-ink",
  Medium: "bg-raised text-ink",
  Hard: "bg-raised text-ink",
};

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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header>
        <div className="flex items-start justify-between gap-4">
        <h1 className="flex items-center gap-3 text-3xl font-medium tracking-tight">
          <svg
            aria-hidden
            viewBox="0 0 32 32"
            className="h-8 w-8 shrink-0 rounded-md bg-live"
          >
            <g fill="var(--live-fg)">
              <circle cx="16" cy="5.5" r="2.1" />
              <circle cx="20.02" cy="6.3" r="2.1" />
              <circle cx="23.42" cy="8.58" r="2.1" />
              <circle cx="25.7" cy="11.98" r="2.1" />
              <circle cx="26.5" cy="16" r="2.1" />
              <circle cx="25.7" cy="20.02" r="2.1" />
              <circle cx="23.42" cy="23.42" r="2.1" />
              <circle cx="20.02" cy="25.7" r="2.1" />
              <circle cx="16" cy="26.5" r="2.1" />
              <circle cx="11.98" cy="25.7" r="2.1" />
              <circle cx="8.58" cy="23.42" r="2.1" />
              <circle cx="6.3" cy="20.02" r="2.1" />
              <circle cx="5.5" cy="16" r="2.1" />
            </g>
            <g fill="var(--ink-subtle)">
              <circle cx="6.3" cy="11.98" r="1.3" />
              <circle cx="8.58" cy="8.58" r="1.3" />
              <circle cx="11.98" cy="6.3" r="1.3" />
            </g>
          </svg>
          <span>loop</span>
          <span className="font-normal text-ink-muted"> · DSA voice interviews</span>
        </h1>
          {gate.required && (
            <button
              type="button"
              onClick={() => void gate.logout()}
              className="mt-1 text-xs text-ink-subtle hover:text-ink"
            >
              Sign out
            </button>
          )}
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          Talk through a problem out loud with an AI interviewer — it listens,
          probes your reasoning, and watches your code as you write it.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-ink-subtle">
          Interviewer model
        </span>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                mode === m
                  ? "border-ink-muted bg-raised"
                  : "border-line bg-surface hover:border-line-strong hover:bg-surface"
              }`}
            >
              <span
                className={`block text-sm font-medium ${
                  mode === m ? "text-ink" : "text-ink"
                }`}
              >
                {MODE_LABELS[m]}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-subtle">
                {MODE_DESCRIPTIONS[m]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search problems — title, category, difficulty…"
          className="rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-ink-muted focus:ring-2 focus:ring-ink-muted/30"
        />
        <div className="flex items-center justify-between text-xs text-ink-subtle">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeOpen}
              onChange={(e) => setIncludeOpen(e.target.checked)}
              className="accent-g-2"
            />
            Include open-dataset problems ({OPEN_PROBLEMS.length},
            competitive-style)
          </label>
          <span>
            {total} problem{total === 1 ? "" : "s"} · click one to start
          </span>
        </div>
      </div>

      <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-line bg-surface">
        {total === 0 ? (
          <p className="p-4 text-sm text-ink-subtle">No problems match.</p>
        ) : (
          groups.map(([category, problems]) => (
            <div key={category}>
              <div className="sticky top-0 border-b border-line bg-surface px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                {category}
              </div>
              {problems.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onStart(p, mode)}
                  className="group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                >
                  <span>{p.title}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${DIFFICULTY_STYLE[p.difficulty]}`}
                    >
                      {p.difficulty}
                    </span>
                    <span
                      aria-hidden
                      className="text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
                    >
                      ›
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
