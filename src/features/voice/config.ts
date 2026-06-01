import type { OutputMode } from "realtime-voice-component";

/** Server proxy that exchanges the WebRTC offer for a session — see app/api/session/route.ts. */
export const SESSION_ENDPOINT = "/api/session";

/**
 * The build skill is canonical and calls for gpt-realtime-2. It's not in the
 * library's KnownRealtimeModel union (tops out at gpt-realtime-1.5) but the
 * model type accepts any string. Unverified until a live, funded key confirms
 * the model exists on the account.
 */
export const REALTIME_MODEL = "gpt-realtime-2";

/** Interviewer must speak freely, so audio out (not tool-only). */
export const OUTPUT_MODE: OutputMode = "audio";
