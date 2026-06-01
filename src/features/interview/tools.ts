import { z } from "zod";
import { defineVoiceTool } from "realtime-voice-component";

export function createHintTool(onRequested: () => void) {
  return defineVoiceTool({
    name: "request_hint",
    description:
      "Record that the candidate explicitly asked for a hint. Call this ONLY when they ask (e.g. \"can I get a hint?\"), never proactively. After calling it, give the smallest possible nudge out loud — never the answer.",
    parameters: z.object({
      reason: z
        .string()
        .optional()
        .describe("What the candidate said they were stuck on, if stated."),
    }),
    execute: () => {
      onRequested();
      return { acknowledged: true };
    },
  });
}

export function createEndTool(onEnd: () => void) {
  return defineVoiceTool({
    name: "end_session",
    description:
      "End the interview. Call this when the candidate asks to stop or wrap up, or once they have fully solved the problem and analyzed complexity.",
    parameters: z.object({}),
    execute: () => {
      onEnd();
      return { ended: true };
    },
  });
}
