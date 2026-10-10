import { InterviewApp } from "@/features/interview";
import { PasscodeGate } from "@/features/interview/PasscodeGate";

export default function Home() {
  return (
    <main className="min-h-screen bg-bg text-ink">
      <PasscodeGate>
        <InterviewApp />
      </PasscodeGate>
    </main>
  );
}
