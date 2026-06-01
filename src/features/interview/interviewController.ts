"use client";

import { createVoiceControlController } from "realtime-voice-component";
import { OUTPUT_MODE, REALTIME_MODEL, SESSION_ENDPOINT } from "@/features/voice";
import type { Problem } from "./problems";
import { buildInterviewerInstructions } from "./prompts";
import { createEndTool, createHintTool } from "./tools";

type InterviewControllerOptions = {
  problem: Problem;
  onHintRequested: () => void;
  onEndSession: () => void;
};

export function createInterviewController({
  problem,
  onHintRequested,
  onEndSession,
}: InterviewControllerOptions) {
  return createVoiceControlController({
    auth: { sessionEndpoint: SESSION_ENDPOINT },
    model: REALTIME_MODEL,
    instructions: buildInterviewerInstructions(problem, problem.starterCode),
    outputMode: OUTPUT_MODE,
    activationMode: "vad",
    tools: [createHintTool(onHintRequested), createEndTool(onEndSession)],
  });
}
