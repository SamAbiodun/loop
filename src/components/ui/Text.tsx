import type { HTMLAttributes, ReactNode } from "react";

/** Mono, uppercase, tracked: the HUD voice. Use for eyebrows, section labels,
 *  timecodes and anything machine-shaped. */
export function Label({
  className = "",
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted ${className}`}
      {...rest}
    />
  );
}

/** Zodiak statement. Never under 24px; weight 300 at 44px and up. */
export function Statement({
  className = "",
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={`font-serif text-5xl font-light leading-[1.05] tracking-[-0.02em] text-ink ${className}`}
      {...rest}
    />
  );
}

type PillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "strong" | "live";
  children: ReactNode;
};

/** Status by word, never by colour. `live` is the bright one. */
export function Pill({ tone = "neutral", className = "", ...rest }: PillProps) {
  const t =
    tone === "live"
      ? "bg-live text-live-fg"
      : tone === "strong"
        ? "bg-raised text-ink"
        : "bg-raised text-ink-muted";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide ${t} ${className}`}
      {...rest}
    />
  );
}

/** Flowdrive-style figure frame: a hairline box with a bracketed mono caption
 *  and corner ticks. Wrap a screenshot, a panel, or the editor. */
export function Frame({
  caption,
  readout,
  className = "",
  children,
}: {
  caption?: string;
  readout?: string;
  className?: string;
  children: ReactNode;
}) {
  const tick = "absolute h-3 w-3 border-line-strong";
  return (
    <figure className={`relative border border-line ${className}`}>
      <span className={`${tick} -left-px -top-px border-l border-t`} />
      <span className={`${tick} -right-px -top-px border-r border-t`} />
      <span className={`${tick} -bottom-px -left-px border-b border-l`} />
      <span className={`${tick} -bottom-px -right-px border-b border-r`} />
      {(caption || readout) && (
        <figcaption className="flex items-center justify-between border-b border-line px-3 py-1.5">
          <Label>{caption ? `[ ${caption} ]` : ""}</Label>
          <Label className="text-ink-subtle">{readout}</Label>
        </figcaption>
      )}
      {children}
    </figure>
  );
}
