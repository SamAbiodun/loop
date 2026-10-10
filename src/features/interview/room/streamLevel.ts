/**
 * Lazily attach an AnalyserNode to a MediaStream (the interviewer's remote
 * WebRTC track, which the transport plays through an <audio> element) and
 * read its RMS level as 0..1. Returns null until the stream exists so the
 * meter can fall back to a deterministic pattern.
 */
export function createStreamLevelReader(getStream: () => MediaStream | null) {
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let attached: MediaStream | null = null;
  let buf: Float32Array<ArrayBuffer> | null = null;

  const attach = (stream: MediaStream) => {
    try {
      ctx = ctx ?? new AudioContext();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      buf = new Float32Array(analyser.fftSize);
      attached = stream;
      if (ctx.state === "suspended") void ctx.resume();
    } catch {
      analyser = null;
    }
  };

  return {
    getLevel(): number | null {
      const stream = getStream();
      if (!stream) return null;
      if (stream !== attached) attach(stream);
      if (!analyser || !buf) return null;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const db = 20 * Math.log10(Math.sqrt(sum / buf.length) || 1e-6);
      return dbToUnit(db);
    },
    dispose() {
      void ctx?.close();
      ctx = null;
      analyser = null;
      attached = null;
    },
  };
}

/** Map dBFS to a 0..1 meter level: silence under -60, full at -15. */
export function dbToUnit(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db + 60) / 45));
}
