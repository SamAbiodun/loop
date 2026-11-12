import { Button, DotRing, Icon } from "@/components/ui";

export const CREATOR_ALERT_HREF =
  "mailto:hisamuelab@gmail.com?subject=loop%20is%20out%20of%20API%20credits";

export function OutOfCredits({ onClose }: { onClose: () => void }) {
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
            is wrong on your end. A quick nudge gets it topped up.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" size="md" onClick={() => window.open(CREATOR_ALERT_HREF, "_blank")}>
            <Icon name="send" size={14} />
            Alert Sam
          </Button>
          <Button variant="ghost" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
