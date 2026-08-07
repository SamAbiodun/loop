import { NextRequest, NextResponse } from "next/server";
import {
  GATE_COOKIE,
  gateConfigurationError,
  gateRequired,
  unlockState,
  validatePasscode,
} from "@/lib/auth";
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
 * GET  → { required, unlocked }: whether a passcode is needed and whether this
 *         caller already holds a valid one (re-checked live, so a disabled
 *         code reads as locked).
 * POST { passcode } → on a valid code, set the gate cookie; else 401.
 */
export async function GET(request: NextRequest) {
  const configurationError = gateConfigurationError();
  if (configurationError) {
    return NextResponse.json(
      { required: true, unlocked: false, error: configurationError },
      { status: 503 },
    );
  }
  const { unlocked } = await unlockState(request);
  return NextResponse.json({ required: gateRequired(), unlocked });
}

export async function POST(request: NextRequest) {
  const configurationError = gateConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }

  const limit = await checkRateLimit({
    bucket: "gate-unlock-15m",
    identifier: hashIdentifier(requestIp(request)),
    limit: 12,
    windowSeconds: 15 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  let passcode = "";
  try {
    const body = await readJsonWithLimit<{ passcode?: unknown }>(request, 2_048);
    if (typeof body?.passcode === "string") passcode = body.passcode.trim();
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Invalid unlock request." }, { status });
  }

  const code = await validatePasscode(passcode);
  if (!gateRequired()) return NextResponse.json({ unlocked: true });
  if (!code) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  const res = NextResponse.json({ unlocked: true });
  res.cookies.set(GATE_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ unlocked: false });
  res.cookies.set(GATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
