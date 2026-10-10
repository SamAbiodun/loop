"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeSession } from "@openai/agents/realtime";
import {
  NOISE_GATE_DB,
  REALTIME_MODELS,
  SESSION_CAP_MINUTES,
  SESSION_ENDPOINT,
  createGatedMic,
  type GatedMic,
  type InterviewMode,
} from "@/features/voice";
import { Button, DotRing, Icon, Label } from "@/components/ui";
import type { Problem } from "./problems";
import { DEFAULT_LANGUAGE, LANGUAGES, starterFor } from "./languages";
import { createInterviewSession } from "./interviewController";
import { CodeEditor } from "./CodeEditor";
import { Caption } from "./room/Caption";
import { HintLadder } from "./room/HintLadder";
import { PhaseRail } from "./room/PhaseRail";
import { ProblemTabs, type ProblemTab } from "./room/ProblemTabs";
import { SettingsPopover } from "./room/SettingsPopover";
import { Transcript } from "./room/Transcript";
import { METER_LABEL, MeterAnnouncer, VoiceMeter, type MeterState } from "./room/VoiceMeter";
import { createStreamLevelReader, dbToUnit } from "./room/streamLevel";
import {
  EDITOR_SYNC_PREFIX,
  buildTurns,
  lastInterviewerLine,
  mergeEntries,
  type Note,
  type Phase,
  type Turn,
} from "./room/entries";

const CAP_MS = SESSION_CAP_MINUTES * 60_000;
const MAX_SYNC_OUTPUT_CHARS = 4_000;

const PRE_START_LINE = "Your interviewer won't tell you if you're right.";

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
  const [phase, setPhase] = useState<Phase>("clarify");
  const [hideClock, setHideClock] = useState(false);
  const [problemTab, setProblemTab] = useState<ProblemTab>("problem");
  const [dockTranscript, setDockTranscript] = useState(false);

  // Voice session state, derived from RealtimeSession events.
  const [status, setStatus] = useState<"idle" | "connecting" | "live">("idle");
  // `speaking` is the half-duplex latch (mic held closed); `audioPlaying` is
  // whether interviewer audio is actually arriving. They differ between the
  // moment a response is expected and its first audio frame.
  const [speaking, setSpeaking] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [manualMuted, setManualMuted] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
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
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const speakerLevelRef = useRef<ReturnType<typeof createStreamLevelReader> | null>(null);
  const cleanupSessionListenersRef = useRef<() => void>(() => {});
  const startingRef = useRef(false);
  const closingRef = useRef(false);
  const usageIdRef = useRef<string | null>(null);
  const hintsRef = useRef(0);
  // The SDK history has no timestamps; remember when each item first appeared.
  const seenAtRef = useRef<Map<string, number>>(new Map());

  const addNote = useCallback((note: Note["note"], text: string) => {
    const at = Date.now();
    setNotes((n) => [...n, { kind: "note", id: `${note}-${at}-${n.length}`, note, text, at }]);
  }, []);

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
    speakerLevelRef.current?.dispose();
    speakerLevelRef.current = null;
    audioElRef.current = null;
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
      addNote("code", `code updated (${language})`);
    }, 4000);
    return () => clearTimeout(t);
  }, [code, language, status, pushEditorState, addNote]);

  const finishInterview = useCallback(() => {
    flushUsage();
    closeRealtime();
    setSpeaking(false);
    setAudioPlaying(false);
    setStatus("idle");
    setEnded(true);
  }, [closeRealtime, flushUsage]);

  // Live-adjust the gate threshold from the settings slider.
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
    setProblemTab(null);
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

      // Own the playback element so the meter can analyse the interviewer's
      // track; the transport sets its srcObject once the remote track arrives.
      const audioEl = document.createElement("audio");
      audioElRef.current = audioEl;
      speakerLevelRef.current = createStreamLevelReader(() =>
        audioElRef.current?.srcObject instanceof MediaStream
          ? audioElRef.current.srcObject
          : null,
      );

      const session = createInterviewSession({
        problem,
        mode,
        micStream: mic.stream,
        audioElement: audioEl,
        getEditorState: () => editorStateRef.current,
        getTimeRemaining,
        onHintRequested: () => {
          hintsRef.current += 1;
          setHints(hintsRef.current);
          addNote("nudge", `Nudge ${hintsRef.current}`);
        },
        // Defer closure until the SDK has returned the tool result.
        onEndSession: () => setTimeout(finishInterview, 0),
        onEditCode: setCode,
        onPhase: setPhase,
      });
      sessionRef.current = session;

      const onHistory = (items: unknown[]) => {
        const seen = seenAtRef.current;
        const t = Date.now();
        setTurns(
          buildTurns(items, (id) => {
            const at = seen.get(id);
            if (at !== undefined) return at;
            seen.set(id, t);
            return t;
          }),
        );
      };
      const onAudioStart = () => {
        setSpeaking(true);
        setAudioPlaying(true);
      };
      const onAudioStopped = () => {
        setSpeaking(false);
        setAudioPlaying(false);
      };
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
    const t = setTimeout(() => {
      setSpeaking(false);
      setAudioPlaying(false);
    }, 20_000);
    return () => clearTimeout(t);
  }, [speaking]);

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
      const shown = text || "(no output)";
      setOutput(shown);
      // Let the interviewer see what was run and what it produced.
      if (status === "live") {
        lastSyncRef.current = `${language}\0${code}`;
        const boundedOutput = shown.slice(0, MAX_SYNC_OUTPUT_CHARS);
        pushEditorState(
          `${EDITOR_SYNC_PREFIX} The candidate ran the ${language} editor. Call get_editor_state for the code. Output:\n${boundedOutput}`,
        );
        addNote("ran", `ran: ${shown.split("\n")[0].slice(0, 80)}`);
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

  const elapsedMs = startedAt === null ? 0 : Math.min(CAP_MS, now - startedAt);
  const elapsed = `${Math.floor(elapsedMs / 60000)}:${String(
    Math.floor((elapsedMs % 60000) / 1000),
  ).padStart(2, "0")}`;

  const isLive = status === "live" || status === "connecting";
  const meterState: MeterState = error
    ? "error"
    : ended
      ? "ended"
      : status === "connecting"
        ? "connecting"
        : status !== "live"
          ? "idle"
          : audioPlaying
            ? "speaking"
            : manualMuted
              ? "muted"
              : speaking
                ? "micPaused"
                : "listening";

  const getMicLevel = useCallback(
    () => (micRef.current ? dbToUnit(micRef.current.getLevelDb()) : null),
    [],
  );
  const getSpeakerLevel = useCallback(
    () => speakerLevelRef.current?.getLevel() ?? null,
    [],
  );

  const entries = mergeEntries(turns, notes);
  const caption = lastInterviewerLine(turns);
  const preStart = !isLive && !ended;

  const stateStrip = (
    <div className="flex items-center justify-between gap-3">
      <Label className={meterState === "speaking" ? "text-ink" : undefined}>
        {METER_LABEL[meterState]}
      </Label>
      <HintLadder used={hints} />
    </div>
  );

  const preStartBlock = (
    <div className="flex flex-col items-start gap-4 px-4 py-6">
      <p className="font-serif text-[24px] font-light leading-[1.25] tracking-[-0.01em] text-ink">
        {PRE_START_LINE}
      </p>
      <Button variant="primary" onClick={startSession}>
        <Icon name="play" size={14} />
        Start session
      </Button>
    </div>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-bg text-ink">
      <MeterAnnouncer state={meterState} />

      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line px-4">
        <DotRing size={22} className="text-ink" />
        <span className="truncate text-sm font-medium text-ink">{problem.title}</span>
        <Label className="hidden text-ink-subtle sm:inline">{problem.difficulty}</Label>

        <PhaseRail phase={phase} className="mx-auto hidden w-full max-w-md md:flex" />

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          {!hideClock && (
            <span
              className="mr-1 font-mono text-xs tabular-nums text-ink-muted"
              aria-label="Elapsed time"
            >
              {elapsed}
            </span>
          )}
          <SettingsPopover
            gateDb={gateDb}
            onGateDb={setGateDb}
            gateEnabled={isLive && micReady}
            hideClock={hideClock}
            onHideClock={setHideClock}
          />
          {isLive && (
            <Button
              size="sm"
              variant={manualMuted ? "primary" : "secondary"}
              onClick={toggleMute}
              aria-pressed={manualMuted}
            >
              <Icon name={manualMuted ? "micOff" : "mic"} size={14} />
              {manualMuted ? "Muted" : "Mute"}
            </Button>
          )}
          {isLive && (
            <Button size="sm" variant="danger" onClick={stopSession}>
              <Icon name="stop" size={14} />
              End
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onExit}>
            <Icon name="arrowLeft" size={14} />
            Back
          </Button>
        </div>
      </header>

      <div className="border-b border-line px-4 py-2 md:hidden">
        <PhaseRail phase={phase} />
      </div>

      {error && (
        <div className="flex items-center gap-2 border-b border-line-strong bg-raised px-4 py-2 text-sm text-ink">
          <Icon name="warning" size={14} className="text-ink-muted" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[3fr_2fr] lg:grid-rows-1">
        {/* Editor column */}
        <div className="flex min-h-0 flex-col lg:border-r lg:border-line">
          <div className="flex h-10 items-center gap-2 border-b border-line bg-surface px-3">
            <Label className="text-ink-subtle">Language</Label>
            <select
              value={language}
              onChange={(e) => changeLanguage(e.target.value)}
              aria-label="Language"
              className="h-7 rounded-md border border-line bg-surface px-2 font-mono text-xs text-ink outline-none focus:border-ink-muted"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="primary"
              onClick={runCode}
              disabled={running}
              className="ml-auto h-7"
            >
              <Icon name="play" size={12} />
              {running ? "Running" : "Run"}
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor
              value={code}
              language={language}
              path={`${problem.id}/${language}`}
              onChange={setCode}
            />
          </div>
          <div className="flex shrink-0 flex-col bg-bg" style={{ height: outputHeight }}>
            <div
              onPointerDown={startResizeOutput}
              className="h-1.5 shrink-0 cursor-row-resize bg-raised hover:bg-line-strong"
              title="Drag to resize"
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <Label className="text-ink-subtle">Output</Label>
                {output !== null && !running && (
                  <button
                    type="button"
                    onClick={() => setOutput(null)}
                    className="font-mono text-[11px] text-ink-subtle hover:text-ink"
                  >
                    clear
                  </button>
                )}
              </div>
              <pre className="whitespace-pre-wrap break-words text-xs text-ink">
                {running ? (
                  <span className="text-ink-muted">Running</span>
                ) : output !== null ? (
                  output
                ) : (
                  <span className="text-ink-subtle">Press Run to execute your code.</span>
                )}
              </pre>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-subtle">
                Run sends the current code to Paiza&apos;s public execution service.
                Do not include secrets or private data.
              </p>
            </div>
          </div>
        </div>

        {/* Interviewer column (lg and up) */}
        <aside className="hidden min-h-0 flex-col lg:flex" aria-label="Interviewer">
          <div className="flex flex-col gap-3 border-b border-line px-4 pb-3 pt-4">
            <VoiceMeter
              state={meterState}
              getMicLevel={getMicLevel}
              getSpeakerLevel={getSpeakerLevel}
            />
            {stateStrip}
          </div>

          {preStart ? (
            <div className="min-h-0 flex-1 overflow-y-auto">{preStartBlock}</div>
          ) : (
            <>
              <div className="border-b border-line px-4 py-4">
                <Caption text={caption} className="min-h-[2.5em]" />
              </div>
              <Transcript
                entries={entries}
                startedAt={startedAt}
                ended={ended}
                className="min-h-0 flex-1"
              />
            </>
          )}

          <ProblemTabs problem={problem} open={problemTab} onChange={setProblemTab} />
        </aside>

        {/* Bottom dock (below lg) */}
        <div className="flex max-h-[55dvh] flex-col border-t border-line lg:hidden">
          {preStart ? (
            preStartBlock
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 pt-3">
                <VoiceMeter
                  state={meterState}
                  getMicLevel={getMicLevel}
                  getSpeakerLevel={getSpeakerLevel}
                  height={28}
                />
                <Label className={meterState === "speaking" ? "text-ink" : undefined}>
                  {METER_LABEL[meterState]}
                </Label>
                <HintLadder used={hints} />
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setDockTranscript((s) => !s)}
                  aria-expanded={dockTranscript}
                >
                  Transcript
                  <Icon
                    name="chevronDown"
                    size={12}
                    className={dockTranscript ? "" : "-rotate-90"}
                  />
                </Button>
              </div>
              <div className="px-4 py-3">
                <Caption text={caption} className="line-clamp-3 text-[20px]!" />
              </div>
              {dockTranscript && (
                <Transcript
                  entries={entries}
                  startedAt={startedAt}
                  ended={ended}
                  className="min-h-0 flex-1 border-t border-line"
                />
              )}
            </>
          )}
          <ProblemTabs problem={problem} open={problemTab} onChange={setProblemTab} />
        </div>
      </div>
    </div>
  );
}
