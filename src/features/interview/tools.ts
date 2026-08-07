import { z } from "zod";
import { tool } from "@openai/agents/realtime";

export type EditorState = { code: string; language: string };
const MAX_EDITOR_CHARS = 100_000;

export function createGetEditorStateTool(getState: () => EditorState) {
  return tool({
    name: "get_editor_state",
    description:
      "Read the candidate's CURRENT editor contents and selected language. This is the authoritative, live state of the editor — call it whenever you need to know exactly what is on screen: before reviewing or testing their code, when they say they've written or changed something or are done, when they switch languages, or any time you're unsure. Prefer this over assuming.",
    parameters: z.object({}),
    execute: async () => {
      const { code, language } = getState();
      return {
        language,
        code:
          code.trim().length === 0
            ? "(the editor is empty)"
            : code.slice(0, MAX_EDITOR_CHARS),
        truncated: code.length > MAX_EDITOR_CHARS,
      };
    },
  });
}

export function createHintTool(onRequested: () => void) {
  return tool({
    name: "request_hint",
    description:
      'Record that you gave the candidate a substantive hint or nudge toward the approach — whether they asked ("can I get a hint?") or you offered it because they were clearly stuck or silent. Call it JUST BEFORE you give the nudge, then keep the nudge as small as possible — never the full answer or the code. Do NOT call it for ordinary Socratic questions (e.g. asking for the complexity or an edge case).',
    parameters: z.object({}),
    execute: async () => {
      onRequested();
      return { acknowledged: true };
    },
  });
}

export type TimeState = {
  started: boolean;
  minutesRemaining: number;
  minutesElapsed: number;
  capMinutes: number;
};

export function createGetTimeTool(getTime: () => TimeState) {
  return tool({
    name: "get_time_remaining",
    description:
      "Get how much time is left in the session, in minutes, so you can pace the interview — move the candidate from approach to coding, or start wrapping up for feedback, as time runs low. `started` is false until the candidate has started the session clock; before that, treat the full time as available.",
    parameters: z.object({}),
    execute: async () => getTime(),
  });
}

export function createEditCodeTool(onEdit: (code: string) => void) {
  return tool({
    name: "edit_code",
    description:
      "Replace the entire contents of the candidate's code editor. Pass the COMPLETE new file contents (not a diff). Use this to scaffold, correct, or demonstrate code in the editor — stay in your interviewer role and don't hand over the full solution unprompted.",
    parameters: z.object({
      code: z
        .string()
        .max(MAX_EDITOR_CHARS)
        .describe("The full new contents of the editor."),
    }),
    execute: async ({ code }) => {
      onEdit(code);
      return { applied: true };
    },
  });
}

export function createEndTool(onEnd: () => void) {
  return tool({
    name: "end_session",
    description:
      "End the interview. Call this when the candidate asks to stop or wrap up, or once they have fully solved the problem and analyzed complexity.",
    parameters: z.object({}),
    execute: async () => {
      onEnd();
      return { ended: true };
    },
  });
}
