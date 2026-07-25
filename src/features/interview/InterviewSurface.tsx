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
  // Resolves once the mic + session exist; Start awaits it so clicking early
  // can't race the async setup.
  const readyRef = useRef<Promise<void>>(Promise.resolve());

  // Wall-clock start of the current live stretch. Set when the session goes
  // live, cleared when it ends — so we can report elapsed voice time (the
  // OpenAI cost driver) to per-code usage tracking.
  const liveSinceRef = useRef<number | null>(null);
  const flushUsage = useCallback(() => {
    const since = liveSinceRef.current;
    if (since === null) return;
    liveSinceRef.current = null;
    const seconds = Math.round((Date.now() - since) / 1000);
    if (seconds > 0 && typeof navigator !== "undefined" && navigator.sendBeacon) {
      // Beacon (not fetch) so it still sends during unload; cookies ride along
      // so the server attributes the minutes to this visitor's access code.
      navigator.sendBeacon("/api/usage", JSON.stringify({ seconds }));
    }
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

  // Push the live editor state (and run output) into the session as silent
  // context so the interviewer always sees the code without being asked.
  // triggerResponse:false means it never makes the interviewer start talking.
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

  // A few seconds after the candidate stops typing, sync the current code to
  // the interviewer (only when it actually changed, and only while live).
  useEffect(() => {
    if (status !== "live") return;
    const t = setTimeout(() => {
      if (code === lastSyncRef.current) return;
      lastSyncRef.current = code;
      const body = code.trim().length ? code : "(empty)";
      pushEditorState(
        `${EDITOR_SYNC_PREFIX} The candidate's ${language} editor now contains:\n\`\`\`\n${body}\n\`\`\``,
      );
    }, 3000);
    return () => clearTimeout(t);
  }, [code, language, status, pushEditorState]);

  const finishInterview = useCallback(() => {
    flushUsage();
    sessionRef.current?.close();
    setSpeaking(false);
    setStatus("idle");
    setEnded(true);
  }, [flushUsage]);

  // The session owns the WebRTC connection. It's an external system, so it's
  // created (and its events subscribed) in a mount effect and reached through
  // sessionRef from handlers. One session per mount — the component is keyed
  // by problem id in InterviewApp, so a new problem gets a fresh session.
  // The mic is acquired here too (not at Start) so the permission prompt and
  // device warm-up are already done when the candidate clicks Start.
  useEffect(() => {
    let cancelled = false;
    let mic: GatedMic | null = null;
    let session: RealtimeSession | null = null;

    const onHistory = (items: unknown[]) => setTranscript(buildTranscript(items));
    const onAudioStart = () => setSpeaking(true);
    const onAudioStopped = () => setSpeaking(false);
    const onErr = (e: unknown) => {
      setSpeaking(false);
      const err = e as { error?: { message?: string }; message?: string };
      setError(
        typeof e === "string"
          ? e
          : (err?.error?.message ?? err?.message ?? "Voice session error"),
      );
    };

    readyRef.current = (async () => {
      try {
        mic = await createGatedMic(NOISE_GATE_DB);
      } catch {
        // Mic blocked or unavailable — fall back to the transport's own
        // capture (no gate); the browser will prompt again on connect.
        mic = null;
      }
      if (cancelled) {
        mic?.dispose();
        return;
      }
      micRef.current = mic;
      setMicReady(mic !== null);

      session = createInterviewSession({
        problem,
        mode,
        micStream: mic?.stream,
        getEditorState: () => editorStateRef.current,
        getTimeRemaining,
        onHintRequested: () => setHints((h) => h + 1),
        onEndSession: finishInterview,
        onEditCode: setCode,
      });
      sessionRef.current = session;

      session.on("history_updated", onHistory);
      session.on("audio_start", onAudioStart);
      session.on("audio_stopped", onAudioStopped);
      session.on("audio_interrupted", onAudioStopped);
      session.on("error", onErr);
    })();

    return () => {
      cancelled = true;
      if (session) {
        session.off("history_updated", onHistory);
        session.off("audio_start", onAudioStart);
        session.off("audio_stopped", onAudioStopped);
        session.off("audio_interrupted", onAudioStopped);
        session.off("error", onErr);
        session.close();
      }
      mic?.dispose();
      sessionRef.current = null;
      micRef.current = null;
    };
  }, [problem, mode, setCode, finishInterview, getTimeRemaining]);

  // Live-adjust the gate threshold from the header slider.
  useEffect(() => {
    micRef.current?.setThresholdDb(gateDb);
  }, [gateDb, micReady]);

  // Report in-progress voice time if the tab closes or the surface unmounts
  // (e.g. "Back to problems") without an explicit Stop. flushUsage no-ops when
  // there's nothing pending, so overlapping with Stop/End is safe.
  useEffect(() => {
    const onHide = () => flushUsage();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flushUsage();
    };
  }, [flushUsage]);

  // Prefetch the ephemeral client key so Start doesn't pay the mint
  // round-trip. Keys live 10 minutes and are single-use; startSession
  // consumes the cached one and falls back to a fresh fetch when stale.
  const keyRef = useRef<{ value: string; expiresAt: number } | null>(null);
  const fetchKey = useCallback(async () => {
    const res = await fetch(SESSION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: REALTIME_MODELS[mode] }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { value: string; expires_at?: number };
    keyRef.current = {
      value: data.value,
      expiresAt: (data.expires_at ?? 0) * 1000,
    };
    return data.value;
  }, [mode]);
  useEffect(() => {
    // Warm the cache; a failure here isn't an error yet — Start retries.
    fetchKey().catch(() => {});
  }, [fetchKey]);

  const startSession = async () => {
    setError(null);
    setStatus("connecting");
    try {
      await readyRef.current;
      const session = sessionRef.current;
      if (!session) throw new Error("Session setup failed — reload the page.");
      // The gate's AudioContext needs a user gesture to run; this click is it.
      await micRef.current?.resume();
      // Use the prefetched key when it's still comfortably valid (they're
      // single-use, so drop it either way); otherwise mint a fresh one.
      const cached = keyRef.current;
      const value =
        cached && cached.expiresAt - Date.now() > 30_000
          ? cached.value
          : await fetchKey();
      keyRef.current = null; // consumed by this connect either way
      await session.connect({ apiKey: value, model: REALTIME_MODELS[mode] });
      setStatus("live");
      setStartedAt(Date.now());
      startedAtRef.current = Date.now();
      liveSinceRef.current = Date.now();
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
      setError(e instanceof Error ? e.message : String(e));
      setStatus("idle");
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

  const stopSession = () => {
    flushUsage();
    sessionRef.current?.close();
    setSpeaking(false);
    setStatus("idle");
  };

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
        lastSyncRef.current = code;
        pushEditorState(
          `${EDITOR_SYNC_PREFIX} The candidate ran their code. Editor (${language}):\n\`\`\`\n${code}\n\`\`\`\nOutput:\n${text || "(no output)"}`,
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
    <div className="flex h-screen flex-col">
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
            <p className="mt-2 text-neutral-500">
              Target: {problem.targetComplexity}
            </p>
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
