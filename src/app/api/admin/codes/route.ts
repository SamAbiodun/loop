import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gateConfigurationError, isAdmin } from "@/lib/auth";
import { kvIsPersistent } from "@/lib/kv";
import { createCode, deleteCode, listCodes, setEnabled } from "@/lib/codes";
import { RequestBodyError, readJsonWithLimit } from "@/lib/security";

export const runtime = "nodejs";

/** All routes here require a signed-in admin. */
function guard(request: NextRequest): NextResponse | null {
  const configurationError = gateConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** GET → { codes, persistent }: every code with its usage, plus whether the
 *  store survives restarts (false = in-memory fallback; warn the operator). */
export async function GET(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;
  return NextResponse.json({
    codes: await listCodes(),
    persistent: kvIsPersistent(),
  });
}

/** POST { label } → generate and register a new code. */
export async function POST(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;
  let label: string;
  try {
    const body = z
      .object({ label: z.string().max(160).default("") })
      .strict()
      .parse(await readJsonWithLimit(request, 2_048));
    label = body.label;
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Invalid code request." }, { status });
  }
  const created = await createCode(label);
  return NextResponse.json({
    code: created.record,
    plaintext: created.plaintext,
  });
}

/** PATCH { code, enabled } → enable/disable a code (takes effect immediately). */
export async function PATCH(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;
  const parsed = z
    .object({ id: z.string().length(64), enabled: z.boolean() })
    .strict()
    .safeParse(await readJsonWithLimit(request, 2_048).catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "id and enabled required" }, { status: 400 });
  }
  const { id, enabled } = parsed.data;
  if (!(await setEnabled(id, enabled))) {
    return NextResponse.json({ error: "Code not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE { code } → remove a code entirely. */
export async function DELETE(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;
  const parsed = z
    .object({ id: z.string().length(64) })
    .strict()
    .safeParse(await readJsonWithLimit(request, 2_048).catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const { id } = parsed.data;
  if (!(await deleteCode(id))) {
    return NextResponse.json({ error: "Code not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
