import { NextRequest, NextResponse } from "next/server";
import { gateRequired } from "@/lib/auth";
import { createRequest } from "@/lib/requests";

export const runtime = "nodejs";

/**
 * POST { name, email, note? } → record an access request from a locked-out
 * visitor. Public (the whole point is that they can't get in yet), so it does
 * only light validation + clamping in createRequest. Returns 200 on success,
 * 400 on bad input or a full inbox. No-ops (still 200) when the gate is off, so
 * the UI never shows an error on an open deployment.
 */
export async function POST(request: NextRequest) {
  if (!gateRequired()) return NextResponse.json({ ok: true });

  let name = "";
  let email = "";
  let note = "";
  try {
    const body = await request.json();
    if (typeof body?.name === "string") name = body.name;
    if (typeof body?.email === "string") email = body.email;
    if (typeof body?.note === "string") note = body.note;
  } catch {
    // not JSON — falls through to validation below
  }

  const created = await createRequest({ name, email, note });
  if (!created) {
    return NextResponse.json(
      { error: "Please enter your name and a valid email." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
