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
  SESSION_CAP_MINUTES,
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
  createGetTimeTool,
  createHintTool,
  createSetPhaseTool,
  type EditorState,
  type Phase,
  type TimeState,
} from "./tools";

type InterviewSessionOptions = {
  problem: Problem;
  mode: InterviewMode;
  /** Noise-gated mic stream (micGate.ts). Omitted → the transport captures
   *  the default microphone itself (fallback when mic access fails early). */
  micStream?: MediaStream;
  /** Element the transport plays the interviewer through. Supplying one lets
   *  the room meter the interviewer's audio. Omitted → the transport makes its own. */
  audioElement?: HTMLAudioElement;
  getEditorState: () => EditorState;
  /** Live session-clock state so the interviewer can pace itself. */
  getTimeRemaining: () => TimeState;
  onHintRequested: () => void;
  onEndSession: () => void;
  onEditCode: (code: string) => void;
  /** Silent set_phase tool: the interviewer reports which phase it is in. */
  onPhase: (phase: Phase) => void;
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
  audioElement,
  getEditorState,
  getTimeRemaining,
  onHintRequested,
  onEndSession,
  onEditCode,
  onPhase,
}: InterviewSessionOptions) {
  const { code, language } = getEditorState();

  const agent = new RealtimeAgent({
    name: "Interviewer",
    instructions: buildInterviewerInstructions(
      problem,
      code,
      languageLabel(language),
      SESSION_CAP_MINUTES,
    ),
    voice: INTERVIEWER_VOICE,
    tools: [
      createGetEditorStateTool(getEditorState),
      createGetTimeTool(getTimeRemaining),
      createHintTool(onHintRequested),
      createEditCodeTool(onEditCode),
      createEndTool(onEndSession),
      createSetPhaseTool(onPhase),
    ],
  });

  const session = new RealtimeSession(agent, {
    transport: new OpenAIRealtimeWebRTC({
      mediaStream: micStream,
      audioElement,
    }),
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
