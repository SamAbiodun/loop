"use client";

import {
  OpenAIRealtimeWebRTC,
  RealtimeAgent,
  RealtimeSession,
} from "@openai/agents/realtime";
import {
  INTERRUPT_RESPONSE,
  INTERVIEWER_VOICE,
  NOISE_REDUCTION,
  REALTIME_MODELS,
  TRANSCRIPTION,
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
  /** Noise-gated mic stream (micGate.ts). Omitted → the transport captures
   *  the default microphone itself (fallback when mic access fails early). */
  micStream?: MediaStream;
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
  micStream,
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
    transport: new OpenAIRealtimeWebRTC({ mediaStream: micStream }),
    model: REALTIME_MODELS[mode],
    config: {
      outputModalities: ["audio"],
      audio: {
        input: {
          noiseReduction: { type: NOISE_REDUCTION },
          transcription: { ...TRANSCRIPTION },
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
