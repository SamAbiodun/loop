import { z } from "zod";
import { tool } from "@openai/agents/realtime";

export type EditorState = { code: string; language: string };

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
        code: code.trim().length === 0 ? "(the editor is empty)" : code,
      };
    },
  });
}

export function createHintTool(onRequested: () => void) {
  return tool({
    name: "request_hint",
    description:
      'Record that the candidate explicitly asked for a hint. Call this ONLY when they ask (e.g. "can I get a hint?"), never proactively. After calling it, give the smallest possible nudge out loud — never the answer.',
    parameters: z.object({}),
    execute: async () => {
      onRequested();
      return { acknowledged: true };
    },
  });
}

export function createEditCodeTool(onEdit: (code: string) => void) {
  return tool({
    name: "edit_code",
    description:
      "Replace the entire contents of the candidate's code editor. Pass the COMPLETE new file contents (not a diff). Use this to scaffold, correct, or demonstrate code in the editor — stay in your interviewer role and don't hand over the full solution unprompted.",
    parameters: z.object({
      code: z.string().describe("The full new contents of the editor."),
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
