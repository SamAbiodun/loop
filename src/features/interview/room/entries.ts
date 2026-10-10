// The conversation as structured entries rather than one block of text.
// Spoken turns come from the realtime history; notes (editor syncs, runs,
// nudges) are app events the room records itself so they carry a timestamp.

export const EDITOR_SYNC_PREFIX = "[EDITOR]";

export type Phase = "clarify" | "approach" | "code" | "test" | "analyze";
export const PHASES: Phase[] = ["clarify", "approach", "code", "test", "analyze"];

export type Speaker = "interviewer" | "you";

export type Turn = {
  kind: "turn";
  id: string;
  who: Speaker;
  text: string;
  /** Wall-clock ms when the entry was first seen. */
  at: number;
};

export type Note = {
  kind: "note";
  id: string;
  /** code: editor changed; ran: code was executed; nudge: request_hint fired. */
  note: "code" | "ran" | "nudge";
  text: string;
  at: number;
};

export type Entry = Turn | Note;

type HistoryItem = {
  itemId?: string;
  type?: string;
  role?: string;
  content?: { type?: string; text?: string; transcript?: string | null }[];
};

/**
 * Turn the realtime conversation history into spoken turns. `stamp` returns
 * the time an item was first seen (the SDK history carries no timestamps), so
 * the caller owns the id → time map and this stays pure.
 */
export function buildTurns(
  items: unknown[],
  stamp: (id: string, index: number) => number,
): Turn[] {
  const turns: Turn[] = [];
  items.forEach((raw, index) => {
    const item = raw as HistoryItem;
    if (item.type !== "message") return;
    const who: Speaker | null =
      item.role === "assistant" ? "interviewer" : item.role === "user" ? "you" : null;
    if (!who) return;
    const text = (item.content ?? [])
      .map((c) =>
        c.type === "output_text" || c.type === "input_text"
          ? (c.text ?? "")
          : c.type === "output_audio" || c.type === "input_audio"
            ? (c.transcript ?? "")
            : "",
      )
      .join("")
      .trim();
    // Silent editor syncs are context for the model, not conversation; the
    // room renders its own dated notes for them instead.
    if (!text || text.startsWith(EDITOR_SYNC_PREFIX)) return;
    const id = item.itemId ?? `h${index}`;
    turns.push({ kind: "turn", id, who, text, at: stamp(id, index) });
  });
  return turns;
}

/** Merge turns and notes into one stream, oldest first. Stable on ties. */
export function mergeEntries(turns: Turn[], notes: Note[]): Entry[] {
  return [...turns, ...notes].sort((a, b) => a.at - b.at);
}

/** mm:ss since the session clock started; "--:--" before it has. */
export function formatSince(at: number, startedAt: number | null): string {
  if (startedAt === null) return "--:--";
  const s = Math.max(0, Math.floor((at - startedAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The interviewer's current or most recent line, for the pinned caption. */
export function lastInterviewerLine(turns: Turn[]): string | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].who === "interviewer") return turns[i].text;
  }
  return null;
}
