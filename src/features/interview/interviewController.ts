"use client";

import { createVoiceControlController } from "realtime-voice-component";
import {
  AUDIO_CONFIG,
  OUTPUT_MODE,
  REALTIME_MODELS,
  SESSION_ENDPOINT,
  type InterviewMode,
} from "@/features/voice";
import type { Problem } from "./problems";
import { buildInterviewerInstructions } from "./prompts";
import { createEditCodeTool, createEndTool, createHintTool } from "./tools";

type InterviewControllerOptions = {
  problem: Problem;
  mode: InterviewMode;
  onHintRequested: () => void;
  onEndSession: () => void;
  onEditCode: (code: string) => void;
  onError?: (message: string) => void;
};

export function createInterviewController({
  problem,
  mode,
  onHintRequested,
  onEndSession,
  onEditCode,
  onError,
}: InterviewControllerOptions) {
  return createVoiceControlController({
    auth: { sessionEndpoint: SESSION_ENDPOINT },
    model: REALTIME_MODELS[mode],
    instructions: buildInterviewerInstructions(problem, problem.starterCode),
    outputMode: OUTPUT_MODE,
    activationMode: "vad",
    audio: AUDIO_CONFIG,
    tools: [
      createHintTool(onHintRequested),
      createEditCodeTool(onEditCode),
      createEndTool(onEndSession),
    ],
    onError: (error) => {
      onError?.(error.message);
    },
  });
}
