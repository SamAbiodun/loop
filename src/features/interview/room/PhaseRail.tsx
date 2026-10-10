import { PHASES, type Phase } from "./entries";

/** Five segments; the current one is the bright one. No deadlines, no red. */
export function PhaseRail({ phase, className = "" }: { phase: Phase; className?: string }) {
  const current = PHASES.indexOf(phase);
  return (
    <ol
      className={`flex items-stretch gap-1 ${className}`}
      aria-label="Interview phase"
    >
      {PHASES.map((p, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li
            key={p}
            aria-current={now ? "step" : undefined}
            className={`min-w-[4.5rem] flex-1 border-t-2 pt-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] ${
              now
                ? "border-g-0 text-ink"
                : done
                  ? "border-g-4 text-ink-muted"
                  : "border-line text-ink-subtle"
            }`}
          >
            {p}
          </li>
        );
      })}
    </ol>
  );
}
