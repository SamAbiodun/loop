import { NextRequest, NextResponse } from "next/server";
import { gateConfigurationError, gateRequired } from "@/lib/auth";
import { kv } from "@/lib/kv";
import { createRequest, isValidEmail } from "@/lib/requests";
import {
  RequestBodyError,
  checkRateLimit,
  hashIdentifier,
  rateLimitResponse,
  readJsonWithLimit,
  requestIp,
} from "@/lib/security";

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
  const configurationError = gateConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }

  const limit = await checkRateLimit({
    bucket: "access-request-hour",
    identifier: hashIdentifier(requestIp(request)),
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  let name = "";
  let email = "";
  let note = "";
  try {
    const body = await readJsonWithLimit<Record<string, unknown>>(request, 4_096);
    if (typeof body?.name === "string") name = body.name;
    if (typeof body?.email === "string") email = body.email;
    if (typeof body?.note === "string") note = body.note;
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Invalid access request." }, { status });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!name.trim() || !isValidEmail(normalizedEmail)) {
    return NextResponse.json(
      { error: "Please enter your name and a valid email." },
      { status: 400 },
    );
  }
  const firstForEmail = await kv.setIfAbsent(
    `access-request-email:${hashIdentifier(normalizedEmail)}`,
    true,
    24 * 60 * 60,
  );
  if (!firstForEmail) {
    // Idempotent response avoids leaking whether an address is already queued.
    return NextResponse.json({ ok: true });
  }

  const created = await createRequest({ name, email: normalizedEmail, note });
  if (!created) {
    return NextResponse.json(
      { error: "Please enter your name and a valid email." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
