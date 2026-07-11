"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type CodeRecord = {
  code: string;
  label: string;
  enabled: boolean;
  created: string;
  sessions: number;
  runs: number;
  seconds: number;
  lastUsed: string | null;
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
  const [persistent, setPersistent] = useState(true);

  const loadCodes = useCallback(async () => {
    const res = await fetch("/api/admin/codes");
    if (res.ok) {
      const d = (await res.json()) as { codes: CodeRecord[]; persistent: boolean };
      setCodes(d.codes);
      setPersistent(d.persistent);
    }
  }, []);

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
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (res.ok) {
        const d = (await res.json()) as { code: CodeRecord };
        setJustCreated(d.code.code);
        setLabel("");
        await loadCodes();
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggle(rec: CodeRecord) {
    setCodes((cs) =>
      cs.map((c) => (c.code === rec.code ? { ...c, enabled: !c.enabled } : c)),
    );
    await fetch("/api/admin/codes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: rec.code, enabled: !rec.enabled }),
    });
    void loadCodes();
  }

  async function remove(rec: CodeRecord) {
    if (!confirm(`Delete code "${rec.label}" (${rec.code})? This can't be undone.`)) {
      return;
    }
    setCodes((cs) => cs.filter((c) => c.code !== rec.code));
    await fetch("/api/admin/codes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: rec.code }),
    });
  }

  if (gate === "checking") {
    return (
      <p className="p-8 text-sm text-neutral-600">Loading…</p>
    );
  }

  if (gate === "disabled") {
    return (
      <div className="mx-auto max-w-md p-8">
        <h1 className="text-lg font-semibold">Admin disabled</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Set <code className="text-neutral-200">ADMIN_PASSCODE</code> in the
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
            <p className="text-sm text-neutral-400">Enter the admin passcode.</p>
          </div>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
            placeholder="Admin passcode"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={!passcode}
            className="w-full rounded-lg bg-blue-600 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
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
        <h1 className="text-xl font-semibold tracking-tight">Access codes</h1>
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
          ← app
        </Link>
      </div>

      {!persistent && (
        <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
          ⚠ No Redis configured — codes live in memory and reset on restart/redeploy.
          Add the Upstash integration on Vercel to persist them.
        </div>
      )}

      <form onSubmit={generate} className="mb-6 flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. 'Recruiter — Acme', 'Twitter demo')"
          className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3.5 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-blue-500/60"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {busy ? "…" : "Generate code"}
        </button>
      </form>

      {codes.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No codes yet — generate one to share.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
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
            <tbody className="divide-y divide-neutral-800/60">
              {codes.map((c) => (
                <tr
                  key={c.code}
                  className={c.enabled ? "" : "text-neutral-500"}
                >
                  <td className="px-3 py-2">{c.label}</td>
                  <td className="px-3 py-2">
                    <code
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        justCreated === c.code
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-neutral-800 text-neutral-200"
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
                  <td className="px-3 py-2 text-xs text-neutral-400">
                    {fmtWhen(c.lastUsed)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(c)}
                      className={`rounded-md border px-2 py-0.5 text-xs ${
                        c.enabled
                          ? "border-emerald-600/50 bg-emerald-600/15 text-emerald-300"
                          : "border-neutral-700 text-neutral-400 hover:bg-neutral-800"
                      }`}
                    >
                      {c.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      className="text-xs text-neutral-500 hover:text-rose-400"
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
      <p className="mt-4 text-xs text-neutral-600">
        Disabling a code locks out its holder on their next session — even if
        they&apos;re already unlocked. Minutes are estimated voice time.
      </p>
    </div>
  );
}
