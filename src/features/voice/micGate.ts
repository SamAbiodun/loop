/**
 * Decibel-gated microphone. Captures the mic, measures its level ~25×/s, and
 * only lets audio through while it's louder than a threshold (with a short
 * hold so word tails aren't chopped). The gated stream is handed to the
 * Realtime WebRTC transport as its input, so background noise below the
 * threshold never reaches the server VAD at all — it can't be committed as a
 * turn or interrupt the interviewer.
 */

export type GatedMic = {
  /** Gated stream — pass this to the transport as its mic input. */
  stream: MediaStream;
  /** Latest input level in dBFS (about -90 silent … 0 clipping). */
  getLevelDb: () => number;
  /** Move the gate threshold live (dBFS; lower = more permissive). */
  setThresholdDb: (db: number) => void;
  /**
   * AudioContexts start suspended until a user gesture; call this from the
   * click handler that starts the session or the gate stays silent.
   */
  resume: () => Promise<void>;
  /** Stop the mic and tear down the audio graph. */
  dispose: () => void;
};

/** Keep the gate open this long after the level last crossed the threshold,
 *  so natural dips between words don't chop the candidate mid-sentence. */
const HOLD_MS = 450;
/** Gain ramp time constant — fast enough to feel instant, slow enough to
 *  avoid audible clicks when the gate opens/closes. */
const RAMP_S = 0.03;
const TICK_MS = 40;

export async function createGatedMic(thresholdDb: number): Promise<GatedMic> {
  const raw = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(raw);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  const gate = ctx.createGain();
  gate.gain.value = 0;
  const dest = ctx.createMediaStreamDestination();
  source.connect(analyser);
  source.connect(gate);
  gate.connect(dest);

  const samples = new Float32Array(analyser.fftSize);
  let threshold = thresholdDb;
  let levelDb = -Infinity;
  let openedAt = 0;
  let open = false;

  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / samples.length);
    levelDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;

    const now = performance.now();
    if (levelDb >= threshold) {
      openedAt = now;
      if (!open) {
        open = true;
        gate.gain.setTargetAtTime(1, ctx.currentTime, RAMP_S);
      }
    } else if (open && now - openedAt > HOLD_MS) {
      open = false;
      gate.gain.setTargetAtTime(0, ctx.currentTime, RAMP_S);
    }
  }, TICK_MS);

  return {
    stream: dest.stream,
    getLevelDb: () => levelDb,
    setThresholdDb: (db) => {
      threshold = db;
    },
    resume: async () => {
      if (ctx.state === "suspended") await ctx.resume();
    },
    dispose: () => {
      clearInterval(timer);
      for (const track of raw.getTracks()) track.stop();
      void ctx.close();
    },
  };
}
