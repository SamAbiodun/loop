import { useState } from "react";
import { Button, DotRing, Icon } from "@/components/ui";

type AlertState = "idle" | "sending" | "sent" | "failed";

export function OutOfCredits({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<AlertState>("idle");

  async function alertCreator() {
    setState("sending");
    try {
      const res = await fetch("/api/alert-creator", { method: "POST" });
      setState(res.ok || res.status === 429 ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="out-of-credits-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-md flex-col gap-5 rounded-xl border border-line-strong bg-surface p-6 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
        <DotRing size={28} className="text-ink-subtle" />
        <div className="flex flex-col gap-2">
          <h2 id="out-of-credits-title" className="font-serif text-[28px] font-normal leading-tight text-ink">
            Oops. The creator is out of API credits.
          </h2>
          <p className="font-sans text-sm leading-relaxed text-ink-muted">
            loop runs on OpenAI&apos;s voice models and the account behind it has run dry. Nothing
            is wrong on your end. One tap pings Sam to top it up.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {state === "sent" ? (
            <span className="inline-flex items-center gap-2 font-sans text-sm text-ink">
              <Icon name="check" size={14} />
              Sam has been pinged. Thanks.
            </span>
          ) : (
            <Button variant="primary" size="md" onClick={alertCreator} disabled={state === "sending"}>
              <Icon name="send" size={14} />
              {state === "sending" ? "Pinging…" : state === "failed" ? "Try again" : "Alert Sam"}
            </Button>
          )}
          <Button variant="ghost" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
        {state === "failed" && (
          <p className="font-sans text-xs text-ink-subtle">
            The ping didn&apos;t go through. Email hisamuelab@gmail.com instead.
          </p>
        )}
      </div>
    </div>
  );
}
