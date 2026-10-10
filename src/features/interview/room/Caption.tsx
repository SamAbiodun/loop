/** The interviewer's current or last line, pinned and large. */
export function Caption({ text, className = "" }: { text: string | null; className?: string }) {
  return (
    <p
      className={`font-serif text-[26px] font-light leading-[1.25] tracking-[-0.01em] text-ink lg:text-[28px] ${className}`}
      aria-live="off"
    >
      {text ? `“${text}”` : ""}
    </p>
  );
}
