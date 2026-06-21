"use client";

import { useMemo, useState } from "react";
import {
  DEFAULT_MODE,
  MODE_LABELS,
  REALTIME_MODELS,
  type InterviewMode,
} from "@/features/voice";
import {
  OPEN_PROBLEMS,
  PROBLEMS,
  groupByCategory,
  type Problem,
} from "./problems";

type ProblemPickerProps = {
  onStart: (problem: Problem, mode: InterviewMode) => void;
};

const MODES = Object.keys(REALTIME_MODELS) as InterviewMode[];

function matches(p: Problem, q: string): boolean {
  if (!q) return true;
  return `${p.title} ${p.category} ${p.difficulty}`.toLowerCase().includes(q);
}

export function ProblemPicker({ onStart }: ProblemPickerProps) {
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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          loop · DSA voice interview
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Choose your interviewer, then click a problem to begin.
        </p>
      </header>

      <div className="flex flex-col gap-2 text-sm">
        <span className="text-neutral-300">Interviewer</span>
        <div className="flex gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                mode === m
                  ? "border-blue-500 bg-blue-600/20 text-blue-200"
                  : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search problems — title, category, difficulty…"
        className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
      />

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={includeOpen}
          onChange={(e) => setIncludeOpen(e.target.checked)}
        />
        Include open-dataset problems ({OPEN_PROBLEMS.length}, community ·
        competitive-style)
      </label>

      <p className="text-xs text-neutral-500">
        {total} problem{total === 1 ? "" : "s"} · click one to start the
        interview
      </p>

      <div className="max-h-[28rem] overflow-y-auto rounded-md border border-neutral-800">
        {total === 0 ? (
          <p className="p-4 text-sm text-neutral-500">No problems match.</p>
        ) : (
          groups.map(([category, problems]) => (
            <div key={category}>
              <div className="sticky top-0 bg-neutral-900 px-3 py-1.5 text-xs uppercase tracking-wide text-neutral-500">
                {category}
              </div>
              {problems.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onStart(p, mode)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-blue-600/20 hover:text-blue-100"
                >
                  <span>{p.title}</span>
                  <span className="flex items-center gap-2 text-xs text-neutral-500">
                    {p.difficulty}
                    <span aria-hidden className="text-neutral-600">
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
