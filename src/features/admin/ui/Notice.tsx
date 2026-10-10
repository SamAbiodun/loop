import type { ReactNode } from "react";
import { Icon } from "@/components/ui";

/** Ink text on a raised block with a warning glyph. Errors and caveats are
 *  carried by the word and the icon, never by colour. */
export function Notice({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-lg border border-line bg-raised px-3 py-2.5 text-sm leading-5 text-ink ${className}`}
    >
      <Icon name="warning" size={16} className="mt-0.5 text-ink-muted" />
      <span>{children}</span>
    </div>
  );
}
