"use client";

import { createVoiceControlController } from "realtime-voice-component";
import { SESSION_ENDPOINT, SMOKE_TEST_INSTRUCTIONS } from "./config";

/**
 * Phase 0 smoke-test controller: plain audio chat against the realtime API.
 * Phase 1 replaces the instructions and tools with the interviewer behaviour.
 */
export function createVoiceController() {
  return createVoiceControlController({
    auth: { sessionEndpoint: SESSION_ENDPOINT },
    instructions: SMOKE_TEST_INSTRUCTIONS,
    outputMode: "audio",
    activationMode: "vad",
    tools: [],
  });
}
