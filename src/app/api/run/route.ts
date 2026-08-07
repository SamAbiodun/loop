import { NextRequest } from "next/server";
import { z } from "zod";
import { gateConfigurationError, unlockState } from "@/lib/auth";
import { recordRun } from "@/lib/codes";
import {
  RequestBodyError,
  checkRateLimit,
  isAbortError,
  rateLimitResponse,
  readJsonWithLimit,
  requestActor,
} from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 25;

const PAIZA = "https://api.paiza.io/runners";
const API_KEY = "guest";
const MAX_CODE_BYTES = 100_000;
const MAX_STDIN_BYTES = 32_000;

const LANGS = {
  typescript: "typescript",
  javascript: "javascript",
  python: "python3",
  java: "java",
  cpp: "cpp",
  csharp: "csharp",
  go: "go",
  rust: "rust",
} as const;

const Body = z
  .object({
    language: z.enum(Object.keys(LANGS) as [keyof typeof LANGS, ...(keyof typeof LANGS)[]]),
    code: z.string().max(MAX_CODE_BYTES),
    stdin: z.string().max(MAX_STDIN_BYTES).optional().default(""),
  })
  .strict();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Details = {
  status?: string;
  build_stderr?: string | null;
  stdout?: string | null;
  stderr?: string | null;
};

export async function POST(request: NextRequest) {
  const configurationError = gateConfigurationError();
  if (configurationError) {
    return Response.json({ error: configurationError }, { status: 503 });
  }

  const { unlocked, code: accessCode } = await unlockState(request);
  if (!unlocked) {
    return Response.json({ error: "Locked — enter the passcode." }, { status: 401 });
  }

  const actor = requestActor(request, accessCode);
  const burst = await checkRateLimit({
    bucket: "code-run-10m",
    identifier: actor,
    limit: 30,
    windowSeconds: 10 * 60,
  });
  if (!burst.allowed) return rateLimitResponse(burst);
  const daily = await checkRateLimit({
    bucket: "code-run-day",
    identifier: actor,
    limit: 200,
    windowSeconds: 24 * 60 * 60,
  });
  if (!daily.allowed) return rateLimitResponse(daily);

  let body: z.infer<typeof Body>;
  try {
    const raw = await readJsonWithLimit<unknown>(
      request,
      MAX_CODE_BYTES + MAX_STDIN_BYTES + 2_048,
    );
    body = Body.parse(raw);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return Response.json({ error: "Invalid code-run request." }, { status });
  }

  const paizaLang = LANGS[body.language];
  const source =
    paizaLang === "typescript" ? `// @ts-nocheck\n${body.code}` : body.code;

  try {
    const created = await fetch(`${PAIZA}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        source_code: source,
        language: paizaLang,
        input: body.stdin,
        api_key: API_KEY,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!created.ok) {
      return Response.json(
        { error: `Runner unavailable (${created.status}).` },
        { status: 502 },
      );
    }

    const createdBody = (await created.json()) as { id?: string };
    if (!createdBody.id) {
      return Response.json({ error: "Runner returned an invalid job." }, { status: 502 });
    }

    const params = new URLSearchParams({ id: createdBody.id, api_key: API_KEY });
    let details: Details | null = null;
    for (let i = 0; i < 18; i++) {
      await sleep(500);
      const result = await fetch(`${PAIZA}/get_details?${params}`, {
        signal: AbortSignal.timeout(4_000),
      });
      if (!result.ok) continue;
      const candidate = (await result.json()) as Details;
      if (candidate.status === "completed") {
        details = candidate;
        break;
      }
    }

    if (!details) {
      return Response.json(
        { error: "Run timed out — please try again." },
        { status: 504 },
      );
    }

    if (accessCode) await recordRun(accessCode).catch(() => {});
    return Response.json({
      stdout: details.stdout ?? "",
      stderr: details.stderr ?? "",
      compileOutput: details.build_stderr ?? "",
    });
  } catch (error) {
    return Response.json(
      {
        error: isAbortError(error)
          ? "Runner timed out — please try again."
          : "Runner is unavailable — please try again.",
      },
      { status: 502 },
    );
  }
}
