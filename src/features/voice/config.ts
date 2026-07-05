/** Server proxy that mints an ephemeral Realtime client secret — see
 *  app/api/session/route.ts. */
export const SESSION_ENDPOINT = "/api/session";

/**
 * Cost vs quality. mini is several times cheaper and the default; gpt-realtime-2
 * is "hard mode". Both confirmed on the account.
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

/** The interviewer's spoken voice (OpenAI Realtime voice id). */
export const INTERVIEWER_VOICE = "cedar";

/**
 * Turn-taking. Semantic VAD ends a turn by meaning rather than a fixed silence,
 * so it won't cut the candidate off mid-thought. `low` eagerness keeps it
 * patient — the candidate reasons out loud with pauses, and we don't want it
 * replying before they've finished.
 */
export const VAD_EAGERNESS = "low" as const;

/** far_field suits a laptop / external-speaker setup (mic across the desk). */
export const NOISE_REDUCTION = "far_field" as const;

/**
 * Barge-in OFF. On speakers the interviewer's own voice echoes into the mic;
 * with barge-in on, that echo makes the VAD think the candidate is talking, so
 * the interviewer interrupts itself and reacts to its own audio — the
 * conversation falls apart. With it off, the interviewer finishes its turn, then
 * listens. (On headphones there's no echo and this could be flipped back to true
 * for natural barge-in.)
 */
export const INTERRUPT_RESPONSE = false;
