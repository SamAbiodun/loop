"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

type Status = "checking" | "locked" | "unlocked";

/**
 * Shared-passcode gate. On mount it asks /api/unlock whether a passcode is
 * required and whether this browser already holds a valid cookie; if the gate
 * is off or already unlocked it renders the app straight through. Otherwise it
 * shows a passcode prompt. The real enforcement lives on /api/session and
 * /api/run — this is the UX in front of it.
 */
export function PasscodeGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/unlock")
      .then((r) => r.json())
      .then((d: { required: boolean; unlocked: boolean }) => {
        setStatus(!d.required || d.unlocked ? "unlocked" : "locked");
      })
      .catch(() => setStatus("locked"));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        setStatus("unlocked");
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Incorrect passcode.");
      }
    } catch {
      setError("Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "unlocked") return <>{children}</>;

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-neutral-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">loop</h1>
          <p className="text-sm text-neutral-400">
            Voice-first DSA mock interviews. Enter the passcode to start.
          </p>
        </div>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoFocus
          placeholder="Passcode"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
        />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !passcode}
          className="w-full rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
