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
import { languageLabel } from "./languages";
import { buildInterviewerInstructions } from "./prompts";
import {
  createEditCodeTool,
  createEndTool,
  createGetEditorStateTool,
  createHintTool,
  type EditorState,
} from "./tools";

type InterviewControllerOptions = {
  problem: Problem;
  mode: InterviewMode;
  getEditorState: () => EditorState;
  onHintRequested: () => void;
  onEndSession: () => void;
  onEditCode: (code: string) => void;
  onError?: (message: string) => void;
};

export function createInterviewController({
  problem,
  mode,
  getEditorState,
  onHintRequested,
  onEndSession,
  onEditCode,
  onError,
}: InterviewControllerOptions) {
  const { code, language } = getEditorState();
  return createVoiceControlController({
    auth: { sessionEndpoint: SESSION_ENDPOINT },
    model: REALTIME_MODELS[mode],
    instructions: buildInterviewerInstructions(
      problem,
      code,
      languageLabel(language),
    ),
    outputMode: OUTPUT_MODE,
    activationMode: "vad",
    audio: AUDIO_CONFIG,
    tools: [
      createGetEditorStateTool(getEditorState),
      createHintTool(onHintRequested),
      createEditCodeTool(onEditCode),
      createEndTool(onEndSession),
    ],
    onError: (error) => {
      // Benign: fires when the candidate talks over the interviewer while
      // interruptResponse is off — the API rejects the duplicate response, but
      // the conversation continues fine. Don't surface it to the user.
      if (/active response in progress/i.test(error.message)) return;
      onError?.(error.message);
    },
  });
}
