"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type CodeRecord = {
  id: string;
  code: string;
  label: string;
  enabled: boolean;
  created: string;
  sessions: number;
  runs: number;
  seconds: number;
  lastUsed: string | null;
};

type AccessRequest = {
  id: string;
  name: string;
  email: string;
  note: string;
  created: string;
};

type Gate = "checking" | "disabled" | "locked" | "authed";

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminPanel() {
  const [gate, setGate] = useState<Gate>("checking");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<CodeRecord[]>([]);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [publicAccess, setPublicAccess] = useState(false);
  const [accessBusy, setAccessBusy] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [confirmingPublicAccess, setConfirmingPublicAccess] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { publicAccess: boolean };
        if (typeof data.publicAccess === "boolean") {
          setPublicAccess(data.publicAccess);
          setSettingsStatus("ready");
        } else {
          setSettingsStatus("error");
          setActionError("Unable to load access settings.");
        }
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSettingsStatus("error");
        setActionError(data.error ?? "Unable to load access settings.");
      }
    } catch {
      setSettingsStatus("error");
      setActionError("Unable to load access settings.");
    }
  }, []);

  const loadRequests = useCallback(async () => {
    const res = await fetch("/api/admin/requests");
    if (res.ok) {
      const d = (await res.json()) as { requests: AccessRequest[] };
      setRequests(d.requests);
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setActionError(data.error ?? "Unable to load access requests.");
    }
  }, []);

  const loadCodes = useCallback(async () => {
    const res = await fetch("/api/admin/codes");
    if (res.ok) {
      const d = (await res.json()) as { codes: CodeRecord[]; persistent: boolean };
      setCodes(d.codes);
      setPersistent(d.persistent);
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setActionError(data.error ?? "Unable to load access codes.");
    }
    void Promise.all([loadRequests(), loadSettings()]);
  }, [loadRequests, loadSettings]);

  async function updatePublicAccess(next: boolean) {
    if (settingsStatus !== "ready") return;
    setAccessBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicAccess: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        publicAccess?: boolean;
        error?: string;
      };
      if (!res.ok || typeof data.publicAccess !== "boolean") {
        setActionError(data.error ?? "Unable to update visitor access.");
        return;
      }
      setPublicAccess(data.publicAccess);
      setConfirmingPublicAccess(false);
    } catch {
      setActionError("Unable to update visitor access.");
    } finally {
      setAccessBusy(false);
    }
  }

  async function dismissRequest(id: string) {
    setActionError(null);
    const res = await fetch("/api/admin/requests", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setRequests((rs) => rs.filter((r) => r.id !== id));
    } else {
      setActionError("Unable to dismiss that request.");
    }
  }

  function fillFromRequest(r: AccessRequest) {
    setLabel(`${r.name} — ${r.email}`);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  useEffect(() => {
    fetch("/api/admin/unlock")
      .then((r) => r.json())
      .then((d: { enabled: boolean; authed: boolean }) => {
        if (!d.enabled) setGate("disabled");
        else if (d.authed) {
          setGate("authed");
          void loadCodes();
        } else setGate("locked");
      })
      .catch(() => setGate("locked"));
  }, [loadCodes]);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (res.ok) {
      setGate("authed");
      void loadCodes();
    } else setError("Incorrect passcode.");
  }

  async function generate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (res.ok) {
        const d = (await res.json()) as { code: CodeRecord; plaintext: string };
        setJustCreated(d.plaintext);
        setJustCreatedId(d.code.id);
        setLabel("");
        await loadCodes();
      } else setActionError("Unable to generate a code.");
    } catch {
      setActionError("Unable to generate a code.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(rec: CodeRecord) {
    setActionError(null);
    const res = await fetch("/api/admin/codes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rec.id, enabled: !rec.enabled }),
    });
    if (res.ok) {
      setCodes((cs) =>
        cs.map((c) => (c.id === rec.id ? { ...c, enabled: !c.enabled } : c)),
      );
    } else setActionError("Unable to update that code.");
  }

  async function remove(rec: CodeRecord) {
    if (!confirm(`Delete code "${rec.label}" (${rec.code})? This can't be undone.`)) {
      return;
    }
    setActionError(null);
    const res = await fetch("/api/admin/codes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: rec.id }),
    });
    if (res.ok) {
      setCodes((cs) => cs.filter((c) => c.id !== rec.id));
    } else setActionError("Unable to delete that code.");
  }

  async function logout() {
    await fetch("/api/admin/unlock", { method: "DELETE" });
    setPasscode("");
    setGate("locked");
  }

  if (gate === "checking") {
    return (
      <p className="p-8 text-sm text-ink-subtle">Loading…</p>
    );
  }

  if (gate === "disabled") {
    return (
      <div className="mx-auto max-w-md p-8">
        <h1 className="text-lg font-semibold">Admin disabled</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Set <code className="text-ink">ADMIN_PASSCODE</code> in the
          environment to enable the access-code panel.
        </p>
      </div>
    );
  }

  if (gate === "locked") {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <form onSubmit={signIn} className="w-full max-w-sm space-y-5">
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
            <p className="text-sm text-ink-muted">Enter the admin passcode.</p>
          </div>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
            placeholder="Admin passcode"
            className="w-full rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-ink-muted focus:ring-2 focus:ring-ink-muted/30"
          />
          {error && <p className="text-sm text-ink">{error}</p>}
          <button
            type="submit"
            disabled={!passcode}
            className="w-full rounded-lg bg-live px-3.5 py-2.5 text-sm font-medium text-live-fg hover:bg-g-2 disabled:opacity-50"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Access control</h1>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-ink-muted hover:text-ink">
            ← app
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-sm text-ink-subtle hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg border border-line-strong bg-raised px-3 py-2 text-sm text-ink">
          {actionError}
        </div>
      )}

      {!persistent && (
        <div className="mb-4 rounded-lg border border-line-strong bg-raised px-3 py-2 text-xs text-ink">
          ⚠ No Redis configured — codes live in memory and reset on restart/redeploy.
          Add the Upstash integration on Vercel to persist them.
        </div>
      )}

      <section
        className={`mb-6 flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
          publicAccess
            ? "border-line-strong bg-raised"
            : "border-line bg-surface"
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-ink">
              Visitor access
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                publicAccess
                  ? "bg-raised text-ink"
                  : "bg-raised text-ink"
              }`}
            >
              {settingsStatus !== "ready"
                ? settingsStatus === "error"
                  ? "Unavailable"
                  : "Checking"
                : publicAccess
                  ? "Public"
                  : "Codes required"}
            </span>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-5 text-ink-muted">
            {publicAccess
              ? "Anyone with the URL can use interviews and code execution. The admin panel remains protected."
              : "Visitors must enter an enabled access code. You can open the app publicly at any time without deleting codes."}
          </p>
        </div>
        {confirmingPublicAccess && !publicAccess ? (
          <div className="shrink-0 space-y-2 sm:text-right">
            <p className="max-w-xs text-xs text-ink">
              Anyone with the URL will be able to start paid voice sessions.
            </p>
            <div className="flex gap-2 sm:justify-end">
              <button
                type="button"
                disabled={accessBusy}
                onClick={() => void updatePublicAccess(true)}
                className="rounded-lg bg-live px-3.5 py-2 text-sm font-medium text-live-fg hover:bg-g-2 disabled:opacity-50"
              >
                {accessBusy ? "Opening…" : "Yes, open access"}
              </button>
              <button
                type="button"
                disabled={accessBusy}
                onClick={() => setConfirmingPublicAccess(false)}
                className="rounded-lg border border-line-strong px-3.5 py-2 text-sm text-ink-muted hover:bg-raised disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={accessBusy || settingsStatus !== "ready"}
            onClick={() =>
              publicAccess
                ? void updatePublicAccess(false)
                : setConfirmingPublicAccess(true)
            }
            className={`shrink-0 rounded-lg border px-3.5 py-2 text-sm font-medium disabled:opacity-50 ${
              publicAccess
                ? "border-line-strong text-ink hover:bg-raised"
                : "border-line-strong bg-raised text-ink hover:bg-raised"
            }`}
          >
            {accessBusy
              ? "Updating…"
              : publicAccess
                ? "Require access codes"
                : "Open to everyone"}
          </button>
        )}
      </section>

      {requests.length > 0 && (
        <div className="mb-6 rounded-xl border border-line-strong bg-raised">
          <div className="border-b border-line-strong px-3 py-2 text-xs font-medium uppercase tracking-wider text-ink">
            Access requests · {requests.length}
          </div>
          <ul className="divide-y divide-line">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm"
              >
                <span className="font-medium text-ink">{r.name}</span>
                <a
                  href={`mailto:${r.email}`}
                  className="text-ink hover:underline"
                >
                  {r.email}
                </a>
                {r.note && (
                  <span className="text-ink-muted">— {r.note}</span>
                )}
                <span className="text-xs text-ink-subtle">
                  {fmtWhen(r.created)}
                </span>
                <span className="ml-auto flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fillFromRequest(r)}
                    className="rounded-md border border-line-strong bg-raised px-2 py-0.5 text-xs text-ink hover:bg-line"
                  >
                    Use as label
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissRequest(r.id)}
                    className="text-xs text-ink-subtle hover:text-ink"
                  >
                    dismiss
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className="px-3 py-2 text-xs text-ink-subtle">
            Generate a code below, share it, then dismiss the request.
          </p>
        </div>
      )}

      <form onSubmit={generate} className="mb-6 flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. 'Recruiter — Acme', 'Twitter demo')"
          className="flex-1 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-ink-muted"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-live px-4 py-2 text-sm font-medium text-live-fg hover:bg-g-2 disabled:opacity-50"
        >
          {busy ? "…" : "Generate code"}
        </button>
      </form>

      {codes.length === 0 ? (
        <p className="text-sm text-ink-subtle">
          No codes yet — generate one to share.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wider text-ink-subtle">
              <tr>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 text-right font-medium">Sessions</th>
                <th className="px-3 py-2 text-right font-medium">Runs</th>
                <th className="px-3 py-2 text-right font-medium">Minutes</th>
                <th className="px-3 py-2 font-medium">Last used</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {codes.map((c) => (
                <tr
                  key={c.id}
                  className={c.enabled ? "" : "text-ink-subtle"}
                >
                  <td className="px-3 py-2">{c.label}</td>
                  <td className="px-3 py-2">
                    <code
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        justCreatedId === c.id
                          ? "bg-raised text-ink"
                          : "bg-raised text-ink"
                      }`}
                    >
                      {c.code}
                    </code>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.sessions}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.runs}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(c.seconds / 60).toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-xs text-ink-muted">
                    {fmtWhen(c.lastUsed)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(c)}
                      className={`rounded-md border px-2 py-0.5 text-xs ${
                        c.enabled
                          ? "border-line-strong bg-raised text-ink"
                          : "border-line-strong text-ink-muted hover:bg-raised"
                      }`}
                    >
                      {c.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      className="text-xs text-ink-subtle hover:text-ink"
                    >
                      delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {justCreated && (
        <div className="mt-4 rounded-lg border border-line-strong bg-raised p-3 text-sm text-ink">
          <p className="font-medium">Copy this code now—it is shown only once.</p>
          <code className="mt-2 block select-all text-base tracking-wider">
            {justCreated}
          </code>
        </div>
      )}
      <p className="mt-4 text-xs text-ink-subtle">
        Disabling a code locks out its holder on their next session — even if
        they&apos;re already unlocked. Minutes are estimated voice time.
      </p>
    </div>
  );
}
