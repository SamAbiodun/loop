import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gateConfigurationError, isAdmin } from "@/lib/auth";
import { deleteRequest, listRequests } from "@/lib/requests";
import { readJsonWithLimit } from "@/lib/security";

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

/** GET → { requests }: every pending access request, newest first. */
export async function GET(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;
  return NextResponse.json({ requests: await listRequests() });
}

/** DELETE { id } → dismiss a request (after minting a code, or as spam). */
export async function DELETE(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;
  const parsed = z
    .object({ id: z.string().min(8).max(64) })
    .strict()
    .safeParse(await readJsonWithLimit(request, 2_048).catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  await deleteRequest(parsed.data.id);
  return NextResponse.json({ ok: true });
}
