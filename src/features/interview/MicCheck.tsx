"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Frame, Icon, Label, Logo, Pill, Statement } from "@/components/ui";
import { MODE_LABELS, NOISE_GATE_DB, type InterviewMode } from "@/features/voice";
import { createLevelReader, type LevelReader } from "@/features/voice/micGate";
import type { Problem } from "./problems";
import {
  GATE_MAX_DB,
  GATE_MIN_DB,
  LevelMeter,
  formatDb,
} from "./miccheck/LevelMeter";

export type MicCheckProps = {
  problem: Problem;
  mode: InterviewMode;
  onReady: (opts: { gateDb: number; deviceId?: string }) => void;
  onBack: () => void;
};

type Status = "idle" | "requesting" | "ready" | "blocked" | "error";

const AUTO_SAMPLE_MS = 1500;
const AUTO_MARGIN_DB = 8;
const METER_TICK_MS = 50;

function clampGate(db: number): number {
  return Math.min(GATE_MAX_DB, Math.max(GATE_MIN_DB, Math.round(db)));
}

export function MicCheck({ problem, mode, onReady, onBack }: MicCheckProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [gateDb, setGateDb] = useState<number>(NOISE_GATE_DB);
  const [levelDb, setLevelDb] = useState<number>(-Infinity);
  const [sampling, setSampling] = useState(false);
  const [errorText, setErrorText] = useState<string>("");

  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<LevelReader | null>(null);

  const release = useCallback(() => {
    readerRef.current?.dispose();
    readerRef.current = null;
    for (const t of streamRef.current?.getTracks() ?? []) t.stop();
    streamRef.current = null;
  }, []);

  // Never on load: the browser prompt only appears after a click.
  const acquire = useCallback(
    async (wantedDeviceId?: string) => {
      // Swapping devices keeps the panel on screen; only a first grant shows the prompt state.
      setStatus((s) => (s === "ready" ? s : "requesting"));
      setErrorText("");
      release();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(wantedDeviceId ? { deviceId: { exact: wantedDeviceId } } : {}),
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        streamRef.current = stream;
        const reader = createLevelReader(stream);
        await reader.resume();
        readerRef.current = reader;

        const track = stream.getAudioTracks()[0];
        const activeId = track?.getSettings().deviceId ?? wantedDeviceId ?? "";
        setDeviceId(activeId);

        // Labels are only populated once permission is granted.
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === "audioinput"));
        setStatus("ready");
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setStatus("blocked");
        } else {
          setErrorText(
            name === "NotFoundError"
              ? "No microphone was found. Plug one in and try again."
              : "The microphone could not be opened. Close other apps using it and try again.",
          );
          setStatus("error");
        }
      }
    },
    [release],
  );

  useEffect(() => release, [release]);

  useEffect(() => {
    if (status !== "ready") return;
    const id = setInterval(() => {
      setLevelDb(readerRef.current?.getLevelDb() ?? -Infinity);
    }, METER_TICK_MS);
    return () => clearInterval(id);
  }, [status]);

  const autoSet = useCallback(async () => {
    const reader = readerRef.current;
    if (!reader) return;
    setSampling(true);
    const start = performance.now();
    const floor: number[] = [];
    await new Promise<void>((resolve) => {
      const id = setInterval(() => {
        const db = reader.getLevelDb();
        if (Number.isFinite(db)) floor.push(db);
        if (performance.now() - start >= AUTO_SAMPLE_MS) {
          clearInterval(id);
          resolve();
        }
      }, 40);
    });
    setSampling(false);
    if (floor.length === 0) return;
    // Loudest moment of 1.5s of "quiet" is the noise floor we must sit above.
    const noiseFloor = Math.max(...floor);
    setGateDb(clampGate(noiseFloor + AUTO_MARGIN_DB));
  }, []);

  const start = () => {
    // The room acquires its own stream via createGatedMic.
    release();
    onReady({ gateDb, deviceId: deviceId || undefined });
  };

  const ready = status === "ready";

  return (
    <div data-theme="paper" className="bg-bg text-ink min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col border-x border-line">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <Logo size={28} />
          <div className="flex items-center gap-3">
            <Label className="hidden text-ink-subtle sm:inline">
              {problem.title} · {MODE_LABELS[mode]}
            </Label>
            <Pill>{problem.difficulty}</Pill>
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-10 px-6 py-12 sm:px-10">
          <header className="flex max-w-2xl flex-col gap-4">
            <Label>Step 2 of 2 · audio</Label>
            <Statement className="text-[40px] font-normal sm:text-[56px] sm:font-light">
              Check your mic.
            </Statement>
            <p className="font-sans text-base leading-relaxed text-ink-muted">
              Your audio is sent to OpenAI to run the interview. Set the mic
              up once, like hardware, and the room will use it.
            </p>
          </header>

          <section className="flex flex-col gap-6">
            {status === "idle" || status === "requesting" ? (
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  variant="primary"
                  onClick={() => void acquire()}
                  disabled={status === "requesting"}
                >
                  <Icon name="mic" />
                  {status === "requesting"
                    ? "Waiting for permission"
                    : "Allow microphone"}
                </Button>
                <Label className="text-ink-subtle">
                  your browser will ask once
                </Label>
              </div>
            ) : null}

            {status === "blocked" && (
              <Frame caption="microphone blocked" readout="recovery">
                <div className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-ink-muted">
                  <p className="flex items-start gap-2 text-ink">
                    <Icon name="warning" className="mt-0.5" />
                    The browser refused the microphone, so the interview cannot
                    hear you.
                  </p>
                  <ol className="list-decimal space-y-1 pl-5">
                    <li>
                      Click the lock or site icon at the left of the address
                      bar.
                    </li>
                    <li>Set Microphone to Allow for this site.</li>
                    <li>
                      On macOS also check System Settings, Privacy and
                      Security, Microphone, and allow your browser.
                    </li>
                    <li>Reload the page, then click Allow microphone again.</li>
                  </ol>
                  <div>
                    <Button variant="secondary" onClick={() => void acquire()}>
                      <Icon name="refresh" />
                      Try again
                    </Button>
                  </div>
                </div>
              </Frame>
            )}

            {status === "error" && (
              <Frame caption="microphone error">
                <div className="flex flex-col gap-3 p-5 text-sm leading-relaxed text-ink-muted">
                  <p className="flex items-start gap-2 text-ink">
                    <Icon name="warning" className="mt-0.5" />
                    {errorText}
                  </p>
                  <div>
                    <Button variant="secondary" onClick={() => void acquire()}>
                      <Icon name="refresh" />
                      Try again
                    </Button>
                  </div>
                </div>
              </Frame>
            )}

            {ready && (
              <Frame caption="fig. 1 · input" readout={formatDb(levelDb)}>
                <div className="flex flex-col gap-6 p-5">
                  <label className="flex flex-col gap-2">
                    <Label>device</Label>
                    <div className="relative">
                      <select
                        value={deviceId}
                        onChange={(e) => void acquire(e.target.value)}
                        className="h-10 w-full appearance-none rounded-lg border border-line-strong bg-raised pl-3 pr-9 font-sans text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink-muted/40"
                      >
                        {devices.map((d, i) => (
                          <option key={d.deviceId || i} value={d.deviceId}>
                            {d.label || `Microphone ${i + 1}`}
                          </option>
                        ))}
                      </select>
                      <Icon
                        name="chevronDown"
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
                      />
                    </div>
                  </label>

                  <LevelMeter
                    levelDb={levelDb}
                    gateDb={gateDb}
                    onGateChange={setGateDb}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="max-w-md text-sm leading-relaxed text-ink-muted">
                      Sound quieter than the gate never reaches the interviewer.
                      Say a sentence: the bars should pass the marker while you
                      talk and fall below it when you stop.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void autoSet()}
                      disabled={sampling}
                    >
                      <Icon name="spark" size={14} />
                      {sampling ? "Listening, stay quiet" : "Auto-set"}
                    </Button>
                  </div>
                </div>
              </Frame>
            )}

            <div className="flex items-start gap-3 border-t border-line pt-5 text-sm leading-relaxed text-ink-muted">
              <Icon name="headphones" className="mt-0.5 shrink-0 text-ink" />
              <p>
                <span className="text-ink">Use headphones if you can.</span> On
                speakers the interviewer pauses your mic while it talks, so you
                can&apos;t cut in.
              </p>
            </div>
          </section>
        </main>

        <footer className="flex items-center justify-between gap-4 border-t border-line px-6 py-4 sm:px-10">
          <Button variant="ghost" onClick={onBack}>
            <Icon name="arrowLeft" />
            Back
          </Button>
          <div className="flex items-center gap-4">
            {ready && (
              <Label className="hidden text-ink-subtle sm:inline">
                gate {formatDb(gateDb)}
              </Label>
            )}
            <Button variant="primary" onClick={start} disabled={!ready}>
              Start interview
              <Icon name="arrowRight" />
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
