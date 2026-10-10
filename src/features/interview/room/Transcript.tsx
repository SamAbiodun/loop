"use client";

import { useEffect, useRef } from "react";
import { Icon, Label } from "@/components/ui";
import { formatSince, type Entry } from "./entries";

type TranscriptProps = {
  entries: Entry[];
  startedAt: number | null;
  ended?: boolean;
  className?: string;
};

export function Transcript({ entries, startedAt, ended = false, className = "" }: TranscriptProps) {
  const ref = useRef<HTMLDivElement>(null);
  const last = entries[entries.length - 1];
  const lastText = last ? ("text" in last ? last.text : "") : "";
  // Keep pinned to the latest exchange, including while a turn streams in.
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length, lastText]);

  return (
    <div ref={ref} className={`overflow-y-auto px-4 py-3 ${className}`}>
      <ol className="flex flex-col gap-4">
        {entries.map((e) =>
          e.kind === "note" ? (
            <li
              key={e.id}
              className="flex items-center gap-2 font-mono text-[11px] text-ink-subtle"
            >
              <Icon name={e.note === "nudge" ? "nudge" : "eye"} size={12} />
              <span className="truncate">
                {e.note === "nudge" ? e.text : `${e.text} · interviewer can see this`}
              </span>
            </li>
          ) : e.who === "you" ? (
            <li key={e.id} className="flex flex-col items-end gap-1">
              <span className="flex items-center gap-2">
                <Label className="text-ink-subtle">{formatSince(e.at, startedAt)}</Label>
                <Label>You</Label>
              </span>
              <p className="max-w-[85%] rounded-xl rounded-tr-sm bg-raised px-3 py-2 text-sm leading-relaxed text-ink">
                {e.text}
              </p>
            </li>
          ) : (
            <li key={e.id} className="flex flex-col items-start gap-1">
              <span className="flex items-center gap-2">
                <Label>Interviewer</Label>
                <Label className="text-ink-subtle">{formatSince(e.at, startedAt)}</Label>
              </span>
              <p className="max-w-[92%] font-serif text-[17px] leading-[1.45] text-ink">
                {e.text}
              </p>
            </li>
          ),
        )}
        {ended && (
          <li className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
            interview ended
          </li>
        )}
      </ol>
    </div>
  );
}
