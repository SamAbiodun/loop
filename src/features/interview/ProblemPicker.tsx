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
  const haystack = `${p.title} ${p.category} ${p.difficulty}`.toLowerCase();
  return haystack.includes(q);
}

export function ProblemPicker({ onStart }: ProblemPickerProps) {
  const [includeOpen, setIncludeOpen] = useState(false);
  const [mode, setMode] = useState<InterviewMode>(DEFAULT_MODE);
  const [query, setQuery] = useState("");
  const [id, setId] = useState(PROBLEMS[0]?.id ?? "");

  const groups = useMemo(() => {
    const pool = includeOpen ? [...PROBLEMS, ...OPEN_PROBLEMS] : PROBLEMS;
    const q = query.trim().toLowerCase();
    return groupByCategory(pool.filter((p) => matches(p, q)));
  }, [includeOpen, query]);

  const all = useMemo(() => groups.flatMap(([, ps]) => ps), [groups]);
  const selected = all.find((p) => p.id === id) ?? all[0];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          loop · DSA voice interview
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Search a problem, then talk through it out loud with the interviewer.
        </p>
      </header>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search problems — title, category, difficulty…"
        className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500"
      />

      <div className="max-h-72 overflow-y-auto rounded-md border border-neutral-800">
        {all.length === 0 ? (
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
                  onClick={() => setId(p.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                    selected?.id === p.id
                      ? "bg-blue-600/25 text-blue-100"
                      : "text-neutral-200 hover:bg-neutral-800"
                  }`}
                >
                  <span>{p.title}</span>
                  <span className="text-xs text-neutral-500">{p.difficulty}</span>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={includeOpen}
          onChange={(e) => setIncludeOpen(e.target.checked)}
        />
        Include open-dataset problems ({OPEN_PROBLEMS.length}, community ·
        competitive-style)
      </label>

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

      {selected && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-sm">
          <p className="font-medium text-neutral-100">
            {selected.title}{" "}
            <span className="text-neutral-500">· {selected.category}</span>
          </p>
          <p className="mt-2 text-neutral-200">{selected.statement}</p>
          <p className="mt-3 text-neutral-400">
            Target: {selected.targetComplexity}
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!selected}
        onClick={() => selected && onStart(selected, mode)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Start interview
      </button>
    </div>
  );
}
