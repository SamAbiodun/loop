"use client";

import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";
import {
  INTERRUPT_RESPONSE,
  INTERVIEWER_VOICE,
  NOISE_REDUCTION,
  REALTIME_MODELS,
  VAD_EAGERNESS,
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

type InterviewSessionOptions = {
  problem: Problem;
  mode: InterviewMode;
  getEditorState: () => EditorState;
  onHintRequested: () => void;
  onEndSession: () => void;
  onEditCode: (code: string) => void;
};

/**
 * Builds the conversational voice layer on @openai/agents/realtime: a
 * RealtimeAgent (instructions + app-owned tools) driven by a RealtimeSession
 * that owns the WebRTC connection, mic capture, audio playback, and turn-taking.
 */
export function createInterviewSession({
  problem,
  mode,
  getEditorState,
  onHintRequested,
  onEndSession,
  onEditCode,
}: InterviewSessionOptions) {
  const { code, language } = getEditorState();

  const agent = new RealtimeAgent({
    name: "Interviewer",
    instructions: buildInterviewerInstructions(
      problem,
      code,
      languageLabel(language),
    ),
    voice: INTERVIEWER_VOICE,
    tools: [
      createGetEditorStateTool(getEditorState),
      createHintTool(onHintRequested),
      createEditCodeTool(onEditCode),
      createEndTool(onEndSession),
    ],
  });

  const session = new RealtimeSession(agent, {
    transport: "webrtc",
    model: REALTIME_MODELS[mode],
    config: {
      outputModalities: ["audio"],
      audio: {
        input: {
          noiseReduction: { type: NOISE_REDUCTION },
          transcription: { model: "gpt-4o-mini-transcribe" },
          turnDetection: {
            type: "semantic_vad",
            eagerness: VAD_EAGERNESS,
            createResponse: true,
            interruptResponse: INTERRUPT_RESPONSE,
          },
        },
        output: { voice: INTERVIEWER_VOICE },
      },
    },
  });

  return session;
}
