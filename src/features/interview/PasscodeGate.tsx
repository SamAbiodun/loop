"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button, Icon, Label, Logo, Statement } from "@/components/ui";
import { Input, Textarea } from "@/features/admin/ui/Field";
import { Notice } from "@/features/admin/ui/Notice";
import { Checking } from "@/features/admin/ui/Checking";

type Status = "checking" | "locked" | "unlocked";
type GateContextValue = { required: boolean; logout: () => Promise<void> };
const GateContext = createContext<GateContextValue>({
  required: false,
  logout: async () => {},
});

export function usePasscodeGate() {
  return useContext(GateContext);
}

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
  const [required, setRequired] = useState(false);

  // Access-request form (shown when a locked-out visitor has no code).
  const [requesting, setRequesting] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqNote, setReqNote] = useState("");
  const [reqError, setReqError] = useState<string | null>(null);
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqSent, setReqSent] = useState(false);

  async function submitRequest(e: FormEvent) {
    e.preventDefault();
    setReqSubmitting(true);
    setReqError(null);
    try {
      const res = await fetch("/api/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: reqName, email: reqEmail, note: reqNote }),
      });
      if (res.ok) {
        setReqSent(true);
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setReqError(d.error ?? "Couldn't send that. Please try again.");
      }
    } catch {
      setReqError("Something went wrong. Please try again.");
    } finally {
      setReqSubmitting(false);
    }
  }

  useEffect(() => {
    fetch("/api/unlock")
      .then(async (response) => {
        const data = (await response.json()) as {
          required: boolean;
          unlocked: boolean;
          error?: string;
        };
        if (!response.ok) throw new Error(data.error ?? "Access gate unavailable.");
        return data;
      })
      .then((d) => {
        setRequired(d.required);
        setStatus(!d.required || d.unlocked ? "unlocked" : "locked");
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Access gate unavailable.");
        setStatus("locked");
      });
  }, []);

  // If the admin opens public access while someone is sitting at the gate,
  // let them through without requiring a manual refresh. Paid routes still
  // enforce the setting independently on every request.
  useEffect(() => {
    if (status !== "locked") return;
    const interval = window.setInterval(() => {
      fetch("/api/unlock", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { required?: boolean; unlocked?: boolean } | null) => {
          if (data && data.required === false) {
            setRequired(false);
            setError(null);
            setStatus("unlocked");
          }
        })
        .catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    const onLocked = () => {
      setRequired(true);
      setError("This access code is no longer valid. Enter another code.");
      setStatus("locked");
    };
    window.addEventListener("loop:locked", onLocked);
    return () => window.removeEventListener("loop:locked", onLocked);
  }, []);

  async function logout() {
    await fetch("/api/unlock", { method: "DELETE" });
    setPasscode("");
    setError(null);
    setStatus(required ? "locked" : "unlocked");
  }

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
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "unlocked") {
    return (
      <GateContext.Provider value={{ required, logout }}>
        {children}
      </GateContext.Provider>
    );
  }

  if (status === "checking") {
    return <Checking label="checking access" />;
  }

  return (
    <div data-theme="paper" className="min-h-screen bg-bg text-ink">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <Logo size={26} />
        <Label className="text-ink-subtle">preview</Label>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-col px-6 pb-24 pt-10 sm:pt-20">
        <form onSubmit={submit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Label>access</Label>
            <Statement className="text-4xl sm:text-5xl">Enter your code.</Statement>
            <p className="text-sm leading-6 text-ink-muted">
              loop is open by invitation while it&apos;s in preview.
            </p>
          </div>

          <Input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
            autoComplete="one-time-code"
            placeholder="access code"
            aria-label="Access code"
            className="h-12 font-mono tracking-[0.18em] placeholder:font-sans placeholder:tracking-normal"
          />

          {error && <Notice>{error}</Notice>}

          <Button type="submit" variant="primary" disabled={submitting || !passcode} className="w-full">
            {submitting ? "Checking" : "Unlock"}
          </Button>
        </form>

        <hr className="my-10 border-line" />

        {reqSent ? (
          <div className="flex items-start gap-2.5 text-sm leading-6 text-ink">
            <Icon name="check" size={16} className="mt-1 text-ink-muted" />
            <p>Your request is in. You&apos;ll get a code by email soon.</p>
          </div>
        ) : requesting ? (
          <form onSubmit={submitRequest} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>no code?</Label>
              <p className="text-sm leading-6 text-ink-muted">
                Leave your details and I&apos;ll send you one.
              </p>
            </div>
            <Input
              type="text"
              value={reqName}
              onChange={(e) => setReqName(e.target.value)}
              autoFocus
              autoComplete="name"
              placeholder="Your name"
              aria-label="Your name"
            />
            <Input
              type="email"
              value={reqEmail}
              onChange={(e) => setReqEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              aria-label="Email"
            />
            <Textarea
              value={reqNote}
              onChange={(e) => setReqNote(e.target.value)}
              placeholder="Anything I should know? (optional)"
              aria-label="Note"
              rows={2}
            />
            {reqError && <Notice>{reqError}</Notice>}
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                disabled={reqSubmitting || !reqName || !reqEmail}
                className="flex-1"
              >
                {reqSubmitting ? "Sending" : "Request access"}
              </Button>
              <Button variant="ghost" onClick={() => setRequesting(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <Label>no code?</Label>
            <Button variant="ghost" onClick={() => setRequesting(true)}>
              Request one
              <Icon name="arrowRight" size={14} />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
