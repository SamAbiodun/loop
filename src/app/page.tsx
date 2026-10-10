import { InterviewApp } from "@/features/interview";
import { PasscodeGate } from "@/features/interview/PasscodeGate";

// No theme forced here: the picker and mic check set paper on their own
// wrapper; the room keeps the night default from :root.
export default function Home() {
  return (
    <main className="min-h-screen">
      <PasscodeGate>
        <InterviewApp />
      </PasscodeGate>
    </main>
  );
}
