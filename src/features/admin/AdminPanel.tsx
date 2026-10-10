"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, Frame, Icon, Label, Logo, Statement } from "@/components/ui";
import { Input } from "@/features/admin/ui/Field";
import { Notice } from "@/features/admin/ui/Notice";
import { Checking } from "@/features/admin/ui/Checking";

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
  if (!iso) return "never";
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
  const [copied, setCopied] = useState(false);
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
    setLabel(`${r.name} (${r.email})`);
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
        setCopied(false);
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

  async function copyJustCreated() {
    if (!justCreated) return;
    try {
      await navigator.clipboard.writeText(justCreated);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setActionError("Unable to copy. Select the code and copy it by hand.");
    }
  }

  async function logout() {
    await fetch("/api/admin/unlock", { method: "DELETE" });
    setPasscode("");
    setGate("locked");
  }

  const accessWord =
    settingsStatus !== "ready"
      ? settingsStatus === "error"
        ? "Unavailable"
        : "Checking"
      : publicAccess
        ? "Public"
        : "Codes required";

  if (gate === "checking") {
    return <Checking label="checking admin" />;
  }

  if (gate === "disabled") {
    return (
      <div data-theme="paper" className="min-h-screen bg-bg text-ink">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Logo size={26} />
          <Label className="text-ink-subtle">admin</Label>
        </header>
        <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 pb-24 pt-10 sm:pt-20">
          <div className="flex flex-col gap-3">
            <Label>admin</Label>
            <Statement className="text-4xl sm:text-5xl">Disabled.</Statement>
            <p className="text-sm leading-6 text-ink-muted">
              Set <code className="text-ink">ADMIN_PASSCODE</code> in the
              environment to enable the access-code panel.
            </p>
          </div>
          <hr className="border-line" />
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
            <Icon name="arrowLeft" size={14} />
            Back to the app
          </Link>
        </main>
      </div>
    );
  }

  if (gate === "locked") {
    return (
      <div data-theme="paper" className="min-h-screen bg-bg text-ink">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Logo size={26} />
          <Label className="text-ink-subtle">admin</Label>
        </header>
        <main className="mx-auto flex w-full max-w-md flex-col px-6 pb-24 pt-10 sm:pt-20">
          <form onSubmit={signIn} className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Label>access</Label>
              <Statement className="text-4xl sm:text-5xl">Admin.</Statement>
              <p className="text-sm leading-6 text-ink-muted">
                Enter the admin passcode.
              </p>
            </div>
            <Input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoFocus
              autoComplete="current-password"
              placeholder="admin passcode"
              aria-label="Admin passcode"
              className="h-12 font-mono tracking-[0.18em] placeholder:font-sans placeholder:tracking-normal"
            />
            {error && <Notice>{error}</Notice>}
            <Button type="submit" variant="primary" disabled={!passcode} className="w-full">
              Sign in
            </Button>
          </form>
          <hr className="my-10 border-line" />
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
            <Icon name="arrowLeft" size={14} />
            Back to the app
          </Link>
        </main>
      </div>
    );
  }

  const enabledCount = codes.filter((c) => c.enabled).length;

  return (
    <div data-theme="paper" className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Logo size={26} />
          <div className="flex items-center gap-5">
            <Label className="hidden sm:inline">access {accessWord.toLowerCase()}</Label>
            <Label className="hidden sm:inline">{codes.length} codes</Label>
            <Label className="hidden sm:inline">{requests.length} requests</Label>
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
              <Icon name="arrowLeft" size={14} />
              app
            </Link>
            <Button variant="ghost" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-24 pt-12">
        <div className="flex flex-col gap-3">
          <Label>admin</Label>
          <Statement className="text-4xl sm:text-5xl">Access control.</Statement>
        </div>

        {actionError && <Notice>{actionError}</Notice>}

        {!persistent && (
          <Notice>
            No Redis configured. Codes live in memory and reset on every
            restart or redeploy. Add the Upstash integration on Vercel to
            persist them.
          </Notice>
        )}

        <Frame caption="visitor access" readout={accessWord}>
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2">
              <p className="font-serif text-2xl font-light leading-tight text-ink">
                {publicAccess ? "Anyone with the URL can start." : "Visitors need an enabled code."}
              </p>
              <p className="max-w-xl text-sm leading-6 text-ink-muted">
                {publicAccess
                  ? "Interviews and code execution are open to everyone. The admin panel remains protected."
                  : "You can open the app publicly at any time without deleting codes."}
              </p>
            </div>
            {confirmingPublicAccess && !publicAccess ? (
              <div className="flex shrink-0 flex-col gap-3 sm:items-end">
                <Notice className="max-w-xs">
                  Anyone with the URL will be able to start paid voice sessions.
                </Notice>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    disabled={accessBusy}
                    onClick={() => void updatePublicAccess(true)}
                  >
                    {accessBusy ? "Opening" : "Yes, open access"}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={accessBusy}
                    onClick={() => setConfirmingPublicAccess(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant={publicAccess ? "secondary" : "primary"}
                disabled={accessBusy || settingsStatus !== "ready"}
                onClick={() =>
                  publicAccess
                    ? void updatePublicAccess(false)
                    : setConfirmingPublicAccess(true)
                }
              >
                {accessBusy
                  ? "Updating"
                  : publicAccess
                    ? "Require access codes"
                    : "Open to everyone"}
              </Button>
            )}
          </div>
        </Frame>

        {requests.length > 0 && (
          <Frame caption="access requests" readout={`${requests.length} waiting`}>
            <ul className="divide-y divide-line">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-sm"
                >
                  <span className="font-medium text-ink">{r.name}</span>
                  <a
                    href={`mailto:${r.email}`}
                    className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                  >
                    {r.email}
                  </a>
                  {r.note && <span className="text-ink-muted">{r.note}</span>}
                  <span className="font-mono text-xs text-ink-subtle">
                    {fmtWhen(r.created)}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => fillFromRequest(r)}>
                      Use as label
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void dismissRequest(r.id)}>
                      Dismiss
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-2.5 text-xs text-ink-subtle">
              Generate a code below, share it, then dismiss the request.
            </p>
          </Frame>
        )}

        <form onSubmit={generate} className="flex flex-col gap-3">
          <Label>new code</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label, e.g. Recruiter at Acme, Twitter demo"
              aria-label="Code label"
              className="h-10 flex-1"
            />
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Generating" : "Generate code"}
            </Button>
          </div>
        </form>

        {justCreated && (
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-raised p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2">
              <Label>new code, shown once</Label>
              <code className="select-all font-mono text-lg tracking-wider text-ink">
                {justCreated}
              </code>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void copyJustCreated()}
              aria-label="Copy code to clipboard"
            >
              <Icon name={copied ? "check" : "copy"} size={14} />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}

        <Frame
          caption="access codes"
          readout={`${codes.length} codes`}
        >
          {codes.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-subtle">
              No codes yet. Generate one to share.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line">
                  <tr>
                    <th className="px-5 py-2.5"><Label>Label</Label></th>
                    <th className="px-3 py-2.5"><Label>Code</Label></th>
                    <th className="px-3 py-2.5 text-right"><Label>Sessions</Label></th>
                    <th className="px-3 py-2.5 text-right"><Label>Runs</Label></th>
                    <th className="px-3 py-2.5 text-right"><Label>Minutes</Label></th>
                    <th className="px-3 py-2.5"><Label>Last used</Label></th>
                    <th className="px-3 py-2.5"><Label>Status</Label></th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {codes.map((c) => (
                    <tr key={c.id} className={c.enabled ? "text-ink" : "text-ink-subtle"}>
                      <td className="px-5 py-2.5">{c.label}</td>
                      <td className="px-3 py-2.5">
                        <code
                          className={`font-mono text-xs tracking-wide ${
                            justCreatedId === c.id ? "text-ink underline underline-offset-4" : ""
                          }`}
                        >
                          {c.code}
                        </code>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">{c.sessions}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">{c.runs}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                        {(c.seconds / 60).toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-ink-muted">
                        {fmtWhen(c.lastUsed)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Button
                          size="sm"
                          variant={c.enabled ? "secondary" : "ghost"}
                          onClick={() => void toggle(c)}
                        >
                          {c.enabled ? "Enabled" : "Disabled"}
                        </Button>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Button size="sm" variant="danger" onClick={() => void remove(c)}>
                          <Icon name="trash" size={14} />
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-line px-5 py-2.5 font-mono text-[11px] text-ink-subtle">
            {enabledCount} enabled
          </p>
        </Frame>

        <p className="text-xs leading-5 text-ink-subtle">
          Disabling a code locks out its holder on their next session, even if
          they&apos;re already unlocked. Minutes are estimated voice time.
        </p>
      </main>
    </div>
  );
}
