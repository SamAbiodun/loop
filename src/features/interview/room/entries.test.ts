import { describe, expect, it } from "vitest";
import {
  buildTurns,
  formatSince,
  lastInterviewerLine,
  mergeEntries,
  type Note,
} from "./entries";

const items = [
  {
    itemId: "a",
    type: "message",
    role: "assistant",
    content: [{ type: "output_audio", transcript: "Hello, how are you?" }],
  },
  {
    itemId: "b",
    type: "message",
    role: "user",
    content: [{ type: "input_text", text: "[EDITOR] The candidate updated the editor." }],
  },
  {
    itemId: "c",
    type: "message",
    role: "user",
    content: [{ type: "input_audio", transcript: " I'd use a hash map. " }],
  },
  { itemId: "d", type: "function_call", name: "request_hint" },
  { itemId: "e", type: "message", role: "assistant", content: [] },
];

describe("buildTurns", () => {
  it("keeps spoken turns, drops editor syncs and empty items", () => {
    const turns = buildTurns(items, (_id, i) => 1000 + i);
    expect(turns.map((t) => [t.who, t.text])).toEqual([
      ["interviewer", "Hello, how are you?"],
      ["you", "I'd use a hash map."],
    ]);
    expect(turns[1].at).toBe(1002);
  });
});

describe("mergeEntries / caption / time", () => {
  it("interleaves notes by time and finds the last interviewer line", () => {
    const turns = buildTurns(items, (_id, i) => 1000 + i * 10);
    const notes: Note[] = [
      { kind: "note", id: "n1", note: "code", text: "code updated", at: 1005 },
    ];
    expect(mergeEntries(turns, notes).map((e) => e.id)).toEqual(["a", "n1", "c"]);
    expect(lastInterviewerLine(turns)).toBe("Hello, how are you?");
    expect(formatSince(90_000, 0)).toBe("1:30");
    expect(formatSince(5, null)).toBe("--:--");
  });
});
