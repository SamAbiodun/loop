import { NextRequest } from "next/server";
import { unlockState } from "@/lib/auth";
import { recordRun } from "@/lib/codes";

export const runtime = "nodejs";

/**
 * Code runner proxy. Forwards the editor contents to the public Paiza.io
 * runner (guest key, no signup) and returns its output. Proxying server-side
 * keeps it CORS-free. NOTE: code is sent to a third-party public service.
 *
 * (We originally targeted Piston, but its public API went whitelist-only in
 * Feb 2026. Paiza.io is a free public alternative covering all our languages.)
 */
const PAIZA = "https://api.paiza.io/runners";
const API_KEY = "guest";

// Monaco language id -> Paiza language code.
const LANGS: Record<string, string> = {
  typescript: "typescript",
  javascript: "javascript",
  python: "python3",
  java: "java",
  cpp: "cpp",
  csharp: "csharp",
  go: "go",
  rust: "rust",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Details = {
  status?: string;
  build_stderr?: string | null;
  stdout?: string | null;
  stderr?: string | null;
};

export async function POST(request: NextRequest) {
  const { unlocked, code: accessCode } = await unlockState(request);
  if (!unlocked) {
    return Response.json({ error: "Locked — enter the passcode." }, { status: 401 });
  }

  const { language, code, stdin } = (await request.json()) as {
    language?: string;
    code?: string;
    stdin?: string;
  };

  const paizaLang = language ? LANGS[language] : undefined;
  if (!paizaLang || typeof code !== "string") {
    return Response.json(
      { error: `Unsupported or missing language: ${language}` },
      { status: 400 },
    );
  }

  if (accessCode) await recordRun(accessCode).catch(() => {});

  // Paiza compiles TypeScript with strict `tsc`, which rejects the empty
  // function bodies in the starters (TS2355). Suppress type-checking at run
  // time only — Monaco still type-checks in the editor.
  const source =
    paizaLang === "typescript" ? `// @ts-nocheck\n${code}` : code;

  const created = await fetch(`${PAIZA}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      source_code: source,
      language: paizaLang,
      input: stdin ?? "",
      api_key: API_KEY,
    }),
  });
  if (!created.ok) {
    return Response.json(
      { error: `Runner error (${created.status})` },
      { status: 502 },
    );
  }
  const { id } = (await created.json()) as { id?: string };
  if (!id) {
    return Response.json({ error: "Runner did not return a job id" }, { status: 502 });
  }

  // Poll until the job finishes (jobs typically complete in 1-4s).
  const params = new URLSearchParams({ id, api_key: API_KEY });
  let details: Details | null = null;
  for (let i = 0; i < 25; i++) {
    await sleep(700);
    const res = await fetch(`${PAIZA}/get_details?${params}`);
    if (!res.ok) continue;
    const d = (await res.json()) as Details;
    if (d.status === "completed") {
      details = d;
      break;
    }
  }

  if (!details) {
    return Response.json(
      { error: "Run timed out — please try again." },
      { status: 504 },
    );
  }

  return Response.json({
    stdout: details.stdout ?? "",
    stderr: details.stderr ?? "",
    compileOutput: details.build_stderr ?? "",
  });
}
