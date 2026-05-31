import { VoicePanel } from "@/features/voice";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 p-8 text-neutral-100">
      <div className="w-full max-w-xl">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">
          loop &middot; DSA voice interview
        </h1>
        <p className="mb-6 text-sm text-neutral-400">
          Phase 0 smoke test &mdash; prove the OpenAI Realtime audio loop works
          end-to-end before wiring the interviewer prompt.
        </p>
        <VoicePanel />
      </div>
    </main>
  );
}
