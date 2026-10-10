"use client";

import { Icon, Label } from "@/components/ui";
import type { Problem } from "../problems";

export type ProblemTab = "problem" | "examples" | null;

/** Statement and examples tucked under the conversation; a second click on
 *  the open tab collapses it. */
export function ProblemTabs({
  problem,
  open,
  onChange,
  className = "",
}: {
  problem: Problem;
  open: ProblemTab;
  onChange: (tab: ProblemTab) => void;
  className?: string;
}) {
  const tab = (id: Exclude<ProblemTab, null>, label: string) => (
    <button
      type="button"
      onClick={() => onChange(open === id ? null : id)}
      aria-expanded={open === id}
      className={`flex items-center gap-1.5 px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
        open === id ? "text-ink" : "text-ink-subtle hover:text-ink-muted"
      }`}
    >
      <Icon
        name="chevronDown"
        size={12}
        className={`transition-transform ${open === id ? "" : "-rotate-90"}`}
      />
      {label}
    </button>
  );

  return (
    <div className={`border-t border-line bg-surface ${className}`}>
      <div className="flex items-center">
        {tab("problem", "Problem")}
        {problem.examples.length > 0 && tab("examples", "Examples")}
        <Label className="ml-auto pr-3 text-ink-subtle">{problem.difficulty}</Label>
      </div>
      {open === "problem" && (
        <div className="max-h-[38dvh] overflow-y-auto border-t border-line px-4 py-3 text-sm">
          <p className="leading-relaxed text-ink">{problem.statement}</p>
          {problem.constraints.length > 0 && (
            <ul className="mt-3 space-y-1 font-mono text-xs text-ink-muted">
              {problem.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {open === "examples" && (
        <div className="max-h-[38dvh] space-y-2 overflow-y-auto border-t border-line px-4 py-3">
          {problem.examples.map((e, i) => (
            <div key={i} className="rounded-lg bg-raised px-3 py-2 font-mono text-xs">
              <div className="flex items-center gap-2">
                <code className="text-ink">{e.input}</code>
                <Icon name="arrowRight" size={12} className="text-ink-subtle" />
                <code className="text-ink">{e.output}</code>
              </div>
              {e.explanation && (
                <p className="mt-1 font-sans text-xs text-ink-subtle">{e.explanation}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
