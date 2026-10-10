import { DotRing, Label } from "@/components/ui";

/** Centred loading state: the ring and a mono label, paper register. */
export function Checking({ label }: { label: string }) {
  return (
    <div
      data-theme="paper"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-ink"
    >
      <DotRing size={32} className="text-ink" />
      <Label>{label}</Label>
    </div>
  );
}
