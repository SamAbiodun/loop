import { InterviewApp } from "@/features/interview";
import { PasscodeGate } from "@/features/interview/PasscodeGate";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <PasscodeGate>
        <InterviewApp />
      </PasscodeGate>
    </main>
  );
}
