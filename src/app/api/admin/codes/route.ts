import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { kvIsPersistent } from "@/lib/kv";
import { createCode, deleteCode, listCodes, setEnabled } from "@/lib/codes";

export const runtime = "nodejs";

/** All routes here require a signed-in admin. */
function guard(request: NextRequest): NextResponse | null {
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
  let label = "";
  try {
    const body = await request.json();
    if (typeof body?.label === "string") label = body.label;
  } catch {
    // fine — label defaults to "unnamed"
  }
  return NextResponse.json({ code: await createCode(label) });
}

/** PATCH { code, enabled } → enable/disable a code (takes effect immediately). */
export async function PATCH(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;
  const { code, enabled } = (await request.json().catch(() => ({}))) as {
    code?: string;
    enabled?: boolean;
  };
  if (!code || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "code and enabled required" }, { status: 400 });
  }
  await setEnabled(code, enabled);
  return NextResponse.json({ ok: true });
}

/** DELETE { code } → remove a code entirely. */
export async function DELETE(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;
  const { code } = (await request.json().catch(() => ({}))) as { code?: string };
  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }
  await deleteCode(code);
  return NextResponse.json({ ok: true });
}
