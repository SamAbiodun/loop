"use client";

import { useState } from "react";
import type { InterviewMode } from "@/features/voice";
import { type Problem } from "./problems";
import { ProblemPicker } from "./ProblemPicker";
import { InterviewSurface } from "./InterviewSurface";

type Session = { problem: Problem; mode: InterviewMode };

export function InterviewApp() {
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <ProblemPicker
          onStart={(problem, mode) => setSession({ problem, mode })}
        />
      </div>
    );
  }

  return (
    <InterviewSurface
      key={session.problem.id}
      problem={session.problem}
      mode={session.mode}
      onExit={() => setSession(null)}
    />
  );
}
