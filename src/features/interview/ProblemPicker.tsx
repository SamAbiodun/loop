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
  Easy: "bg-emerald-500/10 text-emerald-400",
  Medium: "bg-amber-500/10 text-amber-400",
  Hard: "bg-rose-500/10 text-rose-400",
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
        <h1 className="text-3xl font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            loop
          </span>
          <span className="text-neutral-400"> · DSA voice interviews</span>
        </h1>
          {gate.required && (
            <button
              type="button"
              onClick={() => void gate.logout()}
              className="mt-1 text-xs text-neutral-500 hover:text-neutral-300"
            >
              Sign out
            </button>
          )}
        </div>
        <p className="mt-2 text-sm text-neutral-400">
          Talk through a problem out loud with an AI interviewer — it listens,
          probes your reasoning, and watches your code as you write it.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-neutral-500">
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
                  ? "border-blue-500/70 bg-blue-600/10"
                  : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 hover:bg-neutral-900"
              }`}
            >
              <span
                className={`block text-sm font-medium ${
                  mode === m ? "text-blue-200" : "text-neutral-200"
                }`}
              >
                {MODE_LABELS[m]}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-neutral-500">
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
          className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
        />
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeOpen}
              onChange={(e) => setIncludeOpen(e.target.checked)}
              className="accent-blue-500"
            />
            Include open-dataset problems ({OPEN_PROBLEMS.length},
            competitive-style)
          </label>
          <span>
            {total} problem{total === 1 ? "" : "s"} · click one to start
          </span>
        </div>
      </div>

      <div className="max-h-[26rem] overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900/30">
        {total === 0 ? (
          <p className="p-4 text-sm text-neutral-500">No problems match.</p>
        ) : (
          groups.map(([category, problems]) => (
            <div key={category}>
              <div className="sticky top-0 border-b border-neutral-800/60 bg-neutral-900 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                {category}
              </div>
              {problems.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onStart(p, mode)}
                  className="group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-neutral-300 transition-colors hover:bg-blue-600/10 hover:text-blue-100"
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
                      className="text-neutral-600 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-300"
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
