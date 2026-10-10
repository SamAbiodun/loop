/** Three rungs: where to look → shape of the idea → name the technique.
 *  Filled dots are nudges used; past three the count takes over. */
export function HintLadder({ used }: { used: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-muted"
      title="Nudges: where to look, shape of the idea, name the technique"
      aria-label={`${used} nudge${used === 1 ? "" : "s"} used`}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className={`block h-1.5 w-1.5 rounded-full ${
            i < used ? "bg-ink" : "border border-line-strong"
          }`}
        />
      ))}
      {used > 3 && <span aria-hidden>+{used - 3}</span>}
    </span>
  );
}
