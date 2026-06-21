import type { OutputMode, RealtimeAudioConfig } from "realtime-voice-component";

/** Server proxy that exchanges the WebRTC offer for a session — see app/api/session/route.ts. */
export const SESSION_ENDPOINT = "/api/session";

/**
 * Cost vs quality. mini is several times cheaper and the default; gpt-realtime-2
 * is "hard mode". Both confirmed on the account (2026-06-01, GET /v1/models).
 */
export const REALTIME_MODELS = {
  practice: "gpt-realtime-mini",
  hard: "gpt-realtime-2",
} as const;

export type InterviewMode = keyof typeof REALTIME_MODELS;

export const MODE_LABELS: Record<InterviewMode, string> = {
  practice: "Practice (cheaper)",
  hard: "Hard (gpt-realtime-2)",
};

export const DEFAULT_MODE: InterviewMode = "practice";

/** Auto-end a session after this long so a forgotten tab can't run up the bill. */
export const SESSION_CAP_MINUTES = 30;

/** Interviewer must speak freely, so audio out (not tool-only). */
export const OUTPUT_MODE: OutputMode = "audio";

/**
 * Turn-taking. The library default ends a turn after 200ms of silence, which
 * fragments short or paused speech into several turns (and several replies).
 * Semantic VAD detects end-of-turn from meaning, so it won't cut the candidate
 * off mid-thought or split a single utterance. Lower `eagerness` = more patient.
 */
export const AUDIO_CONFIG: RealtimeAudioConfig = {
  input: {
    // Cut false "user is talking" triggers from speaker echo / room noise.
    noiseReduction: { type: "near_field" },
    turnDetection: {
      type: "semantic_vad",
      eagerness: "medium",
      createResponse: true,
      // Don't let detected audio cancel the interviewer mid-response. On
      // speakers, the model hears itself and would otherwise cut its own reply
      // off over and over. It now finishes its turn, then listens. (With
      // headphones there's no echo, so this could be flipped back to true for
      // barge-in.)
      interruptResponse: false,
    },
  },
};
