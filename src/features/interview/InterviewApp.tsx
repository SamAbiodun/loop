"use client";

import { useState } from "react";
import type { InterviewMode } from "@/features/voice";
import { type Problem } from "./problems";
import { ProblemPicker } from "./ProblemPicker";
import { MicCheck } from "./MicCheck";
import { InterviewSurface } from "./InterviewSurface";

type Pick = { problem: Problem; mode: InterviewMode };
type Session = Pick & { gateDb: number; deviceId?: string };

/**
 * Hand-off from the mic check to the room. InterviewSurface takes only
 * `{ problem, mode, onExit }`, so the chosen gate threshold and input device
 * travel via sessionStorage; the room reads them on mount if present.
 *   loop.gateDb       string of a number, dBFS, e.g. "-53"
 *   loop.micDeviceId  MediaDeviceInfo.deviceId of the chosen audioinput
 */
export const GATE_DB_KEY = "loop.gateDb";
export const MIC_DEVICE_KEY = "loop.micDeviceId";

function remember(gateDb: number, deviceId?: string) {
  try {
    sessionStorage.setItem(GATE_DB_KEY, String(gateDb));
    if (deviceId) sessionStorage.setItem(MIC_DEVICE_KEY, deviceId);
    else sessionStorage.removeItem(MIC_DEVICE_KEY);
  } catch {
    // Private mode or blocked storage: the room falls back to its defaults.
  }
}

export function InterviewApp() {
  const [pick, setPick] = useState<Pick | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  if (session) {
    return (
      <InterviewSurface
        key={session.problem.id}
        problem={session.problem}
        mode={session.mode}
        onExit={() => {
          setSession(null);
          setPick(null);
        }}
      />
    );
  }

  if (pick) {
    return (
      <MicCheck
        problem={pick.problem}
        mode={pick.mode}
        onBack={() => setPick(null)}
        onReady={({ gateDb, deviceId }) => {
          remember(gateDb, deviceId);
          setSession({ ...pick, gateDb, deviceId });
        }}
      />
    );
  }

  return <ProblemPicker onStart={(problem, mode) => setPick({ problem, mode })} />;
}
