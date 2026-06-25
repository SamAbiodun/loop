"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceControl, type VoiceControlController } from "realtime-voice-component";
import {
  MODE_LABELS,
  SESSION_CAP_MINUTES,
  type InterviewMode,
} from "@/features/voice";
import type { Problem } from "./problems";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  languageLabel,
  starterFor,
} from "./languages";
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
  mode: InterviewMode;
  onExit: () => void;
};

export function InterviewSurface({ problem, mode, onExit }: InterviewSurfaceProps) {
  const hintsRef = useRef(0);
  const [hints, setHints] = useState(0);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Each language keeps its own editor buffer, so switching languages shows
  // that language's default starter the first time and restores prior work on
  // return — never bleeding one language's code into another.
  const [codeByLang, setCodeByLang] = useState<Record<string, string>>({
    [DEFAULT_LANGUAGE]: problem.starterCode,
  });
  const code = codeByLang[language] ?? starterFor(language, problem.starterCode);

  // Stable writer used by both Monaco's onChange and the interviewer's
  // edit_code tool (captured once at controller creation), always targeting the
  // currently selected language via a ref.
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  const setCode = useCallback((next: string) => {
    setCodeByLang((m) => ({ ...m, [languageRef.current]: next }));
  }, []);

  // Authoritative live editor state for the interviewer's get_editor_state tool.
  // The controller (and its tools) are created once, so they read through this
  // ref rather than closing over a stale snapshot. Kept current via the effect
  // below.
  const editorStateRef = useRef({ code, language });
  useEffect(() => {
    editorStateRef.current = { code, language };
  }, [code, language]);

  // Lazy ref (not useMemo): the controller owns a WebRTC connection and is
  // destroyed on unmount, so it must survive re-renders and be recreated only
  // when this component remounts (keyed by problem id in InterviewApp).
  const controllerRef = useRef<VoiceControlController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createInterviewController({
      problem,
      mode,
      getEditorState: () => editorStateRef.current,
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

  const changeLanguage = (lang: string) => {
    // First visit to a language seeds its default starter; subsequent visits
    // restore whatever was last in that language's buffer.
    setCodeByLang((m) =>
      lang in m ? m : { ...m, [lang]: starterFor(lang, problem.starterCode) },
    );
    setLanguage(lang);
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

  // Session cost cap: start the clock on connect, auto-end at the limit.
  useEffect(() => {
    if (runtime.connected && startedAt === null) setStartedAt(Date.now());
  }, [runtime.connected, startedAt]);

  // Make the interviewer speak first. With VAD turn detection the model stays
  // silent until the candidate talks, so on connect we explicitly ask for the
  // opening response — the greeting / "how are you doing" intro exchange.
  const greetedRef = useRef(false);
  useEffect(() => {
    if (runtime.connected && !greetedRef.current) {
      greetedRef.current = true;
      controller.requestResponse();
    }
  }, [runtime.connected, controller]);

  useEffect(() => {
    if (startedAt === null) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [startedAt]);

  const capMs = SESSION_CAP_MINUTES * 60_000;
  const remainingMs = startedAt === null ? capMs : Math.max(0, capMs - (now - startedAt));

  useEffect(() => {
    if (startedAt !== null && remainingMs === 0 && !ended) setEnded(true);
  }, [remainingMs, startedAt, ended]);

  const remaining = `${Math.floor(remainingMs / 60000)}:${String(
    Math.floor((remainingMs % 60000) / 1000),
  ).padStart(2, "0")}`;

  // Push the candidate's code into the interviewer's context, debounced.
  useEffect(() => {
    const timer = setTimeout(() => {
      controller.updateInstructions(
        buildInterviewerInstructions(problem, code, languageLabel(language)),
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [code, language, problem, controller]);

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

        <span className="text-xs text-neutral-500">{MODE_LABELS[mode]}</span>

        {startedAt !== null && (
          <span className="text-xs text-neutral-400">⏱ {remaining}</span>
        )}

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
        <div className="flex min-h-0 flex-col border-r border-neutral-800">
          <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-1.5">
            <span className="text-xs text-neutral-500">Language</span>
            <select
              value={language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor value={code} language={language} onChange={setCode} />
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="border-b border-neutral-800 p-4 text-sm">
            <p className="text-neutral-200">{problem.statement}</p>
            <ul className="mt-2 list-inside list-disc text-neutral-400">
              {problem.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            {problem.examples.length > 0 && (
              <div className="mt-3 space-y-1">
                {problem.examples.map((e, i) => (
                  <div
                    key={i}
                    className="rounded bg-neutral-800/60 px-2 py-1 text-xs"
                  >
                    <code className="text-neutral-100">{e.input}</code>
                    <span className="text-neutral-400"> → </span>
                    <code className="text-neutral-100">{e.output}</code>
                    {e.explanation && (
                      <span className="text-neutral-500"> — {e.explanation}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
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
