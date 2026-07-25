import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { deleteRequest, listRequests } from "@/lib/requests";

export const runtime = "nodejs";

/** All routes here require a signed-in admin. */
function guard(request: NextRequest): NextResponse | null {
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
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  await deleteRequest(id);
  return NextResponse.json({ ok: true });
}
