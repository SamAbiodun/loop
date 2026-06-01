"use client";

import { useState } from "react";
import { PROBLEMS, type Problem } from "./problems";
import { ProblemPicker } from "./ProblemPicker";
import { InterviewSurface } from "./InterviewSurface";

export function InterviewApp() {
  const [problem, setProblem] = useState<Problem | null>(null);

  if (!problem) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <ProblemPicker problems={PROBLEMS} onStart={setProblem} />
      </div>
    );
  }

  return <InterviewSurface problem={problem} onExit={() => setProblem(null)} />;
}
