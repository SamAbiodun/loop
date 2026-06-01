"use client";

import { useEffect, useRef, useState } from "react";
import { useVoiceControl, type VoiceControlController } from "realtime-voice-component";
import type { Problem } from "./problems";
import { buildInterviewerInstructions } from "./prompts";
import { createInterviewController } from "./interviewController";
import { CodeEditor } from "./CodeEditor";

const ACTIVITY_COLOR: Record<string, string> = {
  idle: "bg-neutral-500",
  connecting: "bg-yellow-400",
  listening: "bg-green-500",
  processing: "bg-blue-400",
  executing: "bg-blue-400",
  error: "bg-red-500",
};

type InterviewSurfaceProps = {
  problem: Problem;
  onExit: () => void;
};

export function InterviewSurface({ problem, onExit }: InterviewSurfaceProps) {
  const hintsRef = useRef(0);
  const [hints, setHints] = useState(0);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState(problem.starterCode);

  // Lazy ref (not useMemo): the controller owns a WebRTC connection and is
  // destroyed on unmount, so it must survive re-renders and be recreated only
  // when this component remounts (keyed by problem id in InterviewApp).
  const controllerRef = useRef<VoiceControlController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createInterviewController({
      problem,
      onHintRequested: () => {
        hintsRef.current += 1;
        setHints(hintsRef.current);
      },
      onEndSession: () => setEnded(true),
      onEditCode: setCode,
      onError: setError,
    });
  }
  const controller = controllerRef.current;

  const runtime = useVoiceControl(controller);

  const startSession = () => {
    setError(null);
    runtime.connect().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  };

  useEffect(() => {
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, [controller]);

  useEffect(() => {
    if (ended) controller.disconnect();
  }, [ended, controller]);

  // Push the candidate's code into the interviewer's context, debounced.
  useEffect(() => {
    const timer = setTimeout(() => {
      controller.updateInstructions(buildInterviewerInstructions(problem, code));
    }, 500);
    return () => clearTimeout(timer);
  }, [code, problem, controller]);

  const isLive = runtime.connected || runtime.status === "connecting";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              ACTIVITY_COLOR[runtime.activity] ?? "bg-neutral-500"
            }`}
          />
          <span className="text-sm font-medium">{problem.title}</span>
          <span className="text-xs text-neutral-500">{problem.difficulty}</span>
        </div>

        <span className="text-xs uppercase tracking-wide text-neutral-400">
          {ended ? "ended" : runtime.activity}
        </span>

        <span className="text-xs text-neutral-400">Hints: {hints}</span>

        <div className="ml-auto flex gap-2">
          {!isLive && !ended && (
            <button
              type="button"
              onClick={startSession}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              Start session
            </button>
          )}
          {isLive && (
            <button
              type="button"
              onClick={() => runtime.disconnect()}
              className="rounded-md border border-neutral-600 px-3 py-1.5 text-sm hover:bg-neutral-800"
            >
              Stop session
            </button>
          )}
          <button
            type="button"
            onClick={onExit}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Back to problems
          </button>
        </div>
      </header>

      {error && (
        <div className="border-b border-red-900 bg-red-950/60 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="min-h-0 border-r border-neutral-800">
          <CodeEditor value={code} onChange={setCode} />
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="border-b border-neutral-800 p-4 text-sm">
            <p className="text-neutral-200">{problem.statement}</p>
            <ul className="mt-2 list-inside list-disc text-neutral-400">
              {problem.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p className="mt-2 text-neutral-500">
              Target: {problem.targetComplexity}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
              Interviewer transcript
            </h2>
            {ended && (
              <p className="mb-2 rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300">
                Interview ended.
              </p>
            )}
            <p className="whitespace-pre-wrap text-sm text-neutral-200">
              {runtime.transcript || (
                <span className="text-neutral-500">
                  Click Start session, allow the mic, and begin talking through
                  the problem.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
