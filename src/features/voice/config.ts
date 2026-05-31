/**
 * Single source of truth for the realtime voice layer. The controller and any
 * future caller read from here so model/prompt changes happen in one place.
 */

/** Server proxy that exchanges the WebRTC offer for a session — see app/api/session/route.ts. */
export const SESSION_ENDPOINT = "/api/session";

/**
 * Phase 0 smoke-test prompt: plain audio chat to prove the realtime loop works
 * end-to-end. Phase 1 swaps this for the interviewer behaviour.
 */
export const SMOKE_TEST_INSTRUCTIONS =
  "You are a helpful assistant. Reply briefly and clearly out loud.";
