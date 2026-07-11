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

/** The modes pick which model powers the interviewer — same problems, same
 *  interview; the difference is interviewer sharpness vs per-minute cost. */
export const MODE_LABELS: Record<InterviewMode, string> = {
  practice: "Standard",
  hard: "Sharper",
};

export const MODE_DESCRIPTIONS: Record<InterviewMode, string> = {
  practice: "gpt-realtime-mini · quick and inexpensive — great for reps",
  hard: "gpt-realtime-2 · probes harder and follows up better — costs more per minute",
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
 * Mic noise gate (see micGate.ts): sound quieter than this many dBFS never
 * reaches the interviewer, so background noise can't register as a turn.
 * Speech at a laptop mic typically peaks well above -40; steady room noise
 * sits below -55. Adjustable live via the "gate" slider in the session header.
 * -53 = Sam's tuned-by-ear value on his setup (2026-07-06).
 */
export const NOISE_GATE_DB = -53;

/**
 * Transcription of the CANDIDATE's speech — display-only (the transcript
 * panel). The interviewer model listens to the raw audio directly and doesn't
 * use this. Pinning the language and priming with interview vocabulary cuts
 * the hallucinated lines ASR models produce on quiet or clipped audio.
 */
export const TRANSCRIPTION = {
  model: "gpt-4o-mini-transcribe",
  language: "en",
  prompt:
    "A software engineering candidate reasoning out loud in a data-structures-and-algorithms coding interview. Expect terms like: array, hash map, hash set, pointer, two pointers, sliding window, linked list, binary search, binary tree, BFS, DFS, heap, stack, queue, recursion, dynamic programming, time complexity, space complexity, big O, O(n), O(log n), O(n squared), edge case, null, index, iterate.",
} as const;

/**
 * Barge-in OFF. On speakers the interviewer's own voice echoes into the mic;
 * with barge-in on, that echo makes the VAD think the candidate is talking, so
 * the interviewer interrupts itself and reacts to its own audio — the
 * conversation falls apart. With it off, the interviewer finishes its turn, then
 * listens. (On headphones there's no echo and this could be flipped back to true
 * for natural barge-in.)
 */
export const INTERRUPT_RESPONSE = false;
