"use client";

import { useState } from "react";
import type { Problem } from "./problems";

type ProblemPickerProps = {
  problems: Problem[];
  onStart: (problem: Problem) => void;
};

export function ProblemPicker({ problems, onStart }: ProblemPickerProps) {
  const [id, setId] = useState(problems[0]?.id ?? "");
  const selected = problems.find((p) => p.id === id);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          loop · DSA voice interview
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          Pick a problem, then talk through it out loud with the interviewer.
        </p>
      </header>

      <label className="flex flex-col gap-2 text-sm">
        <span className="text-neutral-300">Problem</span>
        <select
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100"
        >
          {problems.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {p.difficulty} · {p.category}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-sm">
          <p className="text-neutral-200">{selected.statement}</p>
          <p className="mt-3 text-neutral-400">
            Target: {selected.targetComplexity}
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!selected}
        onClick={() => selected && onStart(selected)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Start interview
      </button>
    </div>
  );
}
