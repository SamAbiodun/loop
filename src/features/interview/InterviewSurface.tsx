"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeSession } from "@openai/agents/realtime";
import {
  MODE_LABELS,
  NOISE_GATE_DB,
  REALTIME_MODELS,
  SESSION_CAP_MINUTES,
  SESSION_ENDPOINT,
  createGatedMic,
  type GatedMic,
  type InterviewMode,
} from "@/features/voice";
import type { Problem } from "./problems";
import { DEFAULT_LANGUAGE, LANGUAGES, starterFor } from "./languages";
import { createInterviewSession } from "./interviewController";
import { CodeEditor } from "./CodeEditor";

const ACTIVITY_COLOR: Record<string, string> = {
  idle: "bg-neutral-500",
  connecting: "bg-yellow-400",
  listening: "bg-green-500",
  speaking: "bg-blue-400",
  muted: "bg-amber-500",
  error: "bg-red-500",
};

const CAP_MS = SESSION_CAP_MINUTES * 60_000;
const MAX_SYNC_OUTPUT_CHARS = 4_000;

// Editor-state updates we silently push into the session so the interviewer
// always sees the live code (and run output) without being asked. Prefixed so
// they can be filtered out of the visible transcript and recognized by the
// model as silent context (see prompts.ts EDITOR AWARENESS).
const EDITOR_SYNC_PREFIX = "[EDITOR]";

/** Flatten the realtime conversation history into a readable transcript. */
function buildTranscript(items: unknown[]): string {
  const lines: string[] = [];
  for (const raw of items) {
    const item = raw as {
      type?: string;
      role?: string;
      content?: { type?: string; text?: string; transcript?: string | null }[];
    };
    if (item.type !== "message") continue;
    const who =
      item.role === "assistant"
        ? "Interviewer"
        : item.role === "user"
          ? "You"
          : null;
    if (!who) continue;
    const text = (item.content ?? [])
      .map((c) =>
        c.type === "output_text" || c.type === "input_text"
          ? (c.text ?? "")
          : c.type === "output_audio" || c.type === "input_audio"
            ? (c.transcript ?? "")
            : "",
      )
      .join("")
      .trim();
    // Skip the silent editor-sync messages — they're context for the model,
    // not part of the spoken conversation.
    if (text && !text.startsWith(EDITOR_SYNC_PREFIX)) lines.push(`${who}: ${text}`);
  }
  return lines.join("\n\n");
}

type InterviewSurfaceProps = {
  problem: Problem;
  mode: InterviewMode;
  onExit: () => void;
};

export function InterviewSurface({ problem, mode, onExit }: InterviewSurfaceProps) {
  const [hints, setHints] = useState(0);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Voice session state, derived from RealtimeSession events.
  const [status, setStatus] = useState<"idle" | "connecting" | "live">("idle");
  const [speaking, setSpeaking] = useState(false);
  const [manualMuted, setManualMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const [gateDb, setGateDb] = useState(NOISE_GATE_DB);

  // Each language keeps its own editor buffer, so switching languages shows
  // that language's default starter the first time and restores prior work on
  // return — never bleeding one language's code into another.
  const [codeByLang, setCodeByLang] = useState<Record<string, string>>({
    [DEFAULT_LANGUAGE]: problem.starterCode,
  });
  const code = codeByLang[language] ?? starterFor(language, problem.starterCode);

  // Stable writer used by both Monaco's onChange and the interviewer's
  // edit_code tool (captured once at session creation), always targeting the
  // currently selected language via a ref.
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  const setCode = useCallback((next: string) => {
    setCodeByLang((m) => ({ ...m, [languageRef.current]: next }));
  }, []);

  // Authoritative live editor state for the interviewer's get_editor_state tool.
  // The session (and its tools) are created once, so they read through this ref
  // rather than closing over a stale snapshot.
  const editorStateRef = useRef({ code, language });
  useEffect(() => {
    editorStateRef.current = { code, language };
  }, [code, language]);

  const sessionRef = useRef<RealtimeSession | null>(null);
  const micRef = useRef<GatedMic | null>(null);
  const cleanupSessionListenersRef = useRef<() => void>(() => {});
  const startingRef = useRef(false);
  const closingRef = useRef(false);
  const usageIdRef = useRef<string | null>(null);

  // Wall-clock start of the current live stretch. Set when the session goes
  // live, cleared when it ends — so we can report elapsed voice time (the
  // OpenAI cost driver) to per-code usage tracking.
  const liveSinceRef = useRef<number | null>(null);
  const flushUsage = useCallback(() => {
    const since = liveSinceRef.current;
    const usageId = usageIdRef.current;
    if (since === null || !usageId) return;
    liveSinceRef.current = null;
    const seconds = Math.round((Date.now() - since) / 1000);
    if (seconds > 0 && typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/usage",
        JSON.stringify({ event: "final", usageId, seconds }),
      );
    }
  }, []);

  const closeRealtime = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    cleanupSessionListenersRef.current();
    cleanupSessionListenersRef.current = () => {};
    sessionRef.current?.close();
    micRef.current?.dispose();
    sessionRef.current = null;
    micRef.current = null;
    setMicReady(false);
    closingRef.current = false;
  }, []);

  // Start of the session clock (the cap timer), mirrored in a ref so the
  // interviewer's get_time_remaining tool — captured once at session creation —
  // reads the live value rather than a stale snapshot.
  const startedAtRef = useRef<number | null>(null);
  const getTimeRemaining = useCallback(() => {
    const started = startedAtRef.current;
    if (started === null) {
      return {
        started: false,
        minutesRemaining: SESSION_CAP_MINUTES,
        minutesElapsed: 0,
        capMinutes: SESSION_CAP_MINUTES,
      };
    }
    const elapsedMin = (Date.now() - started) / 60000;
    return {
      started: true,
      minutesRemaining: Math.max(0, Math.ceil(SESSION_CAP_MINUTES - elapsedMin)),
      minutesElapsed: Math.floor(elapsedMin),
      capMinutes: SESSION_CAP_MINUTES,
    };
  }, []);

  // Send a lightweight invalidation rather than repeatedly appending the full
  // file to conversation history. The model can call get_editor_state for the
  // authoritative contents when it needs to review the code.
  const lastSyncRef = useRef<string>("");
  const pushEditorState = useCallback((body: string) => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      session.transport.sendMessage(body, {}, { triggerResponse: false });
    } catch {
      // transport not connected yet — ignore
    }
  }, []);

  // A few seconds after the candidate stops typing, tell the interviewer that
  // its editor view changed without inflating context with full-file snapshots.
  useEffect(() => {
    if (status !== "live") return;
    const t = setTimeout(() => {
      const signature = `${language}\0${code}`;
      if (signature === lastSyncRef.current) return;
      lastSyncRef.current = signature;
      pushEditorState(
        `${EDITOR_SYNC_PREFIX} The candidate updated the ${language} editor. Call get_editor_state before reviewing or testing it.`,
      );
    }, 4000);
    return () => clearTimeout(t);
  }, [code, language, status, pushEditorState]);

  const finishInterview = useCallback(() => {
    flushUsage();
    closeRealtime();
    setSpeaking(false);
    setStatus("idle");
    setEnded(true);
  }, [closeRealtime, flushUsage]);

  // Live-adjust the gate threshold from the header slider.
  useEffect(() => {
    micRef.current?.setThresholdDb(gateDb);
  }, [gateDb, micReady]);

  // A hidden/backgrounded voice tab is an uncontrolled cost risk. End the
  // interview immediately and report usage rather than relying on throttled
  // timers to enforce the cap.
  useEffect(() => {
    const onHide = () => {
      if (liveSinceRef.current !== null) finishInterview();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flushUsage();
      closeRealtime();
    };
  }, [closeRealtime, finishInterview, flushUsage]);

  const fetchKey = useCallback(async () => {
    const res = await fetch(SESSION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: REALTIME_MODELS[mode] }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      value?: string;
      usage_id?: string | null;
      error?: string;
    };
    if (!res.ok || !data.value) {
      if (res.status === 401 && typeof window !== "undefined") {
        window.dispatchEvent(new Event("loop:locked"));
      }
      throw new Error(data.error ?? "Unable to create a voice session.");
    }
    return { value: data.value, usageId: data.usage_id ?? null };
  }, [mode]);

  const startSession = async () => {
    if (startingRef.current || ended) return;
    startingRef.current = true;
    setError(null);
    setStatus("connecting");
    try {
      // Microphone access happens only after the explicit Start gesture.
      const mic = await createGatedMic(gateDb).catch(() => {
        throw new Error(
          "Microphone access is required. Allow it in your browser settings and try again.",
        );
      });
      micRef.current = mic;
      setMicReady(true);
      await mic.resume();

      const session = createInterviewSession({
        problem,
        mode,
        micStream: mic.stream,
        getEditorState: () => editorStateRef.current,
        getTimeRemaining,
        onHintRequested: () => setHints((h) => h + 1),
        // Defer closure until the SDK has returned the tool result.
        onEndSession: () => setTimeout(finishInterview, 0),
        onEditCode: setCode,
      });
      sessionRef.current = session;

      const onHistory = (items: unknown[]) => setTranscript(buildTranscript(items));
      const onAudioStart = () => setSpeaking(true);
      const onAudioStopped = () => setSpeaking(false);
      const onErr = (event: unknown) => {
        if (closingRef.current) return;
        const err = event as { error?: { message?: string }; message?: string };
        setError(
          typeof event === "string"
            ? event
            : (err?.error?.message ?? err?.message ?? "Voice session error"),
        );
        if (liveSinceRef.current !== null) {
          finishInterview();
        } else {
          closeRealtime();
          setStatus("idle");
        }
      };
      session.on("history_updated", onHistory);
      session.on("audio_start", onAudioStart);
      session.on("audio_stopped", onAudioStopped);
      session.on("audio_interrupted", onAudioStopped);
      session.on("error", onErr);
      cleanupSessionListenersRef.current = () => {
        session.off("history_updated", onHistory);
        session.off("audio_start", onAudioStart);
        session.off("audio_stopped", onAudioStopped);
        session.off("audio_interrupted", onAudioStopped);
        session.off("error", onErr);
      };

      const credential = await fetchKey();
      usageIdRef.current = credential.usageId;
      await session.connect({
        apiKey: credential.value,
        model: REALTIME_MODELS[mode],
      });
      setStatus("live");
      const connectedAt = Date.now();
      setStartedAt(connectedAt);
      setNow(connectedAt);
      startedAtRef.current = connectedAt;
      liveSinceRef.current = connectedAt;
      if (credential.usageId) {
        await fetch("/api/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "connected",
            usageId: credential.usageId,
          }),
        }).catch(() => undefined);
      }
      // Treat the greeting as already in flight: the half-duplex effect keys
      // off `speaking`, so this keeps the mic closed from the very first live
      // moment — otherwise room noise in the seconds before the greeting's
      // audio_start would be committed as a phantom first candidate turn.
      setSpeaking(true);
      // Let the audio path settle so the greeting's first word isn't clipped,
      // then make the interviewer speak first rather than waiting for the
      // candidate to talk.
      await new Promise((r) => setTimeout(r, 500));
      session.transport.sendEvent({ type: "response.create" });
    } catch (e) {
      // A failure can happen after WebRTC connected (for example while sending
      // the first response event), so finalize any live usage before teardown.
      flushUsage();
      closeRealtime();
      setError(e instanceof Error ? e.message : String(e));
      setStatus("idle");
    } finally {
      startingRef.current = false;
    }
  };

  const toggleMute = () => setManualMuted((m) => !m);

  // Half-duplex: keep the mic muted while the interviewer is speaking (so its
  // own voice / room echo can't leak in and get mistaken for the candidate),
  // and whenever the candidate has manually muted.
  useEffect(() => {
    if (status !== "live") return;
    sessionRef.current?.mute(manualMuted || speaking);
  }, [manualMuted, speaking, status]);

  // Safety net: if an audio_stopped event is ever missed, never leave the mic
  // stuck muted — force "speaking" off after a turn could plausibly last.
  useEffect(() => {
    if (!speaking) return;
    const t = setTimeout(() => setSpeaking(false), 20_000);
    return () => clearTimeout(t);
  }, [speaking]);

  // Keep the transcript pinned to the latest exchange.
  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  const stopSession = finishInterview;

  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [outputHeight, setOutputHeight] = useState(192);

  const startResizeOutput = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = outputHeight;
    const onMove = (ev: PointerEvent) => {
      // Drag up grows the panel, down shrinks it.
      setOutputHeight(Math.min(700, Math.max(80, startH + (startY - ev.clientY))));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const runCode = async () => {
    setRunning(true);
    setOutput(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 && typeof window !== "undefined") {
          window.dispatchEvent(new Event("loop:locked"));
        }
        setOutput(data.error ?? `Run failed (${res.status})`);
        return;
      }
      const text = [data.compileOutput, data.stdout, data.stderr]
        .filter((s: string) => s && s.length)
        .join("\n")
        .trimEnd();
      setOutput(text || "(no output)");
      // Let the interviewer see what was run and what it produced.
      if (status === "live") {
        lastSyncRef.current = `${language}\0${code}`;
        const boundedOutput = (text || "(no output)").slice(
          0,
          MAX_SYNC_OUTPUT_CHARS,
        );
        pushEditorState(
          `${EDITOR_SYNC_PREFIX} The candidate ran the ${language} editor. Call get_editor_state for the code. Output:\n${boundedOutput}`,
        );
      }
    } catch (e) {
      setOutput(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const changeLanguage = (lang: string) => {
    // First visit to a language seeds its default starter; subsequent visits
    // restore whatever was last in that language's buffer.
    setCodeByLang((m) =>
      lang in m ? m : { ...m, [lang]: starterFor(lang, problem.starterCode) },
    );
    setLanguage(lang);
  };

  // Session clock. The tick also enforces the hard cap so a forgotten tab
  // can't run up the bill.
  useEffect(() => {
    if (startedAt === null || ended) return;
    const tick = setInterval(() => {
      setNow(Date.now());
      if (Date.now() - startedAt >= CAP_MS) finishInterview();
    }, 1000);
    return () => clearInterval(tick);
  }, [startedAt, ended, finishInterview]);

  const remainingMs =
    startedAt === null ? CAP_MS : Math.max(0, CAP_MS - (now - startedAt));

  const remaining = `${Math.floor(remainingMs / 60000)}:${String(
    Math.floor((remainingMs % 60000) / 1000),
  ).padStart(2, "0")}`;

  const isLive = status === "live" || status === "connecting";
  const activity = error
    ? "error"
    : status === "connecting"
      ? "connecting"
      : status !== "live"
        ? "idle"
        : speaking
          ? "speaking"
          : manualMuted
            ? "muted"
            : "listening";

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              ACTIVITY_COLOR[activity] ?? "bg-neutral-500"
            }`}
          />
          <span className="text-sm font-medium">{problem.title}</span>
          <span className="text-xs text-neutral-500">{problem.difficulty}</span>
        </div>

        <span className="text-xs uppercase tracking-wide text-neutral-400">
          {ended ? "ended" : activity}
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
          {isLive && micReady && (
            <label
              className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-2 text-xs text-neutral-400"
              title="Noise gate — mic sounds quieter than this never reach the interviewer. Raise it if background noise still gets through; lower it if it clips your voice."
            >
              gate
              <input
                type="range"
                min={-70}
                max={-30}
                step={1}
                value={gateDb}
                onChange={(e) => setGateDb(Number(e.target.value))}
                className="w-20 accent-blue-500"
              />
              <span className="w-12 tabular-nums text-neutral-500">
                {gateDb} dB
              </span>
            </label>
          )}
          {isLive && (
            <button
              type="button"
              onClick={toggleMute}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                manualMuted
                  ? "border-red-600 bg-red-600/20 text-red-200"
                  : "border-neutral-600 hover:bg-neutral-800"
              }`}
            >
              {manualMuted ? "🔇 Muted" : "🎤 Mute"}
            </button>
          )}
          {isLive && (
            <button
              type="button"
              onClick={stopSession}
              className="rounded-md border border-neutral-600 px-3 py-1.5 text-sm hover:bg-neutral-800"
            >
              End session
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
          <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/40 px-3 py-1.5">
            <span className="text-xs text-neutral-500">Language</span>
            <select
              value={language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-blue-500/60"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={runCode}
              disabled={running}
              className="ml-auto rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {running ? "Running…" : "Run ▶"}
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor
              value={code}
              language={language}
              path={`${problem.id}/${language}`}
              onChange={setCode}
            />
          </div>
          <div
            className="flex shrink-0 flex-col bg-neutral-950"
            style={{ height: outputHeight }}
          >
            <div
              onPointerDown={startResizeOutput}
              className="h-1.5 shrink-0 cursor-row-resize bg-neutral-800 hover:bg-neutral-600"
              title="Drag to resize"
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-neutral-500">
                  Output
                </span>
                {output !== null && !running && (
                  <button
                    type="button"
                    onClick={() => setOutput(null)}
                    className="text-xs text-neutral-500 hover:text-neutral-300"
                  >
                    clear
                  </button>
                )}
              </div>
              <pre className="whitespace-pre-wrap break-words text-xs text-neutral-200">
                {running ? (
                  "Running…"
                ) : output !== null ? (
                  output
                ) : (
                  <span className="text-neutral-600">
                    Press Run ▶ to execute your code.
                  </span>
                )}
              </pre>
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-600">
                Run sends the current code to Paiza&apos;s public execution service.
                Do not include secrets or private data.
              </p>
            </div>
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
          </div>

          <div className="flex items-center justify-between border-b border-neutral-800/60 px-4 py-2">
            <h2 className="text-xs uppercase tracking-wide text-neutral-500">
              Transcript
            </h2>
            <button
              type="button"
              onClick={() => setShowTranscript((s) => !s)}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                showTranscript
                  ? "border-blue-600/60 bg-blue-600/15 text-blue-200"
                  : "border-neutral-700 text-neutral-400 hover:bg-neutral-800"
              }`}
            >
              {showTranscript ? "Hide" : "Show"}
            </button>
          </div>
          {showTranscript && (
            <div
              ref={transcriptRef}
              className="min-h-0 flex-1 overflow-y-auto p-4"
            >
              {ended && (
                <p className="mb-2 rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300">
                  Interview ended.
                </p>
              )}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">
                {transcript || (
                  <span className="text-neutral-500">
                    Click Start session, allow the mic, and begin talking
                    through the problem.
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
