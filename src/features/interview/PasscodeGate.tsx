"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

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
        setReqError(d.error ?? "Couldn't send that — please try again.");
      }
    } catch {
      setReqError("Something went wrong — please try again.");
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
      setError("Something went wrong — please try again.");
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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-neutral-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-5">
        <form onSubmit={submit} className="space-y-5">
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

        <div className="border-t border-neutral-800/80 pt-5">
          {reqSent ? (
            <p className="text-sm text-emerald-400">
              Your request is in. You&apos;ll get a passcode by email soon.
            </p>
          ) : requesting ? (
            <form onSubmit={submitRequest} className="space-y-3">
              <p className="text-sm text-neutral-400">
                Don&apos;t have a passcode? Leave your details and I&apos;ll send
                you one.
              </p>
              <input
                type="text"
                value={reqName}
                onChange={(e) => setReqName(e.target.value)}
                autoFocus
                placeholder="Your name"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
              />
              <input
                type="email"
                value={reqEmail}
                onChange={(e) => setReqEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
              />
              <textarea
                value={reqNote}
                onChange={(e) => setReqNote(e.target.value)}
                placeholder="Anything I should know? (optional)"
                rows={2}
                className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
              />
              {reqError && <p className="text-sm text-rose-400">{reqError}</p>}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={reqSubmitting || !reqName || !reqEmail}
                  className="flex-1 rounded-lg bg-neutral-100 px-3.5 py-2.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reqSubmitting ? "Sending…" : "Request access"}
                </button>
                <button
                  type="button"
                  onClick={() => setRequesting(false)}
                  className="text-sm text-neutral-500 hover:text-neutral-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setRequesting(true)}
              className="text-sm text-neutral-400 underline-offset-4 hover:text-neutral-200 hover:underline"
            >
              Don&apos;t have a passcode? Request one →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
