import { NextRequest, NextResponse } from "next/server";
import {
  GATE_COOKIE,
  gateEnabled,
  isUnlocked,
  passcodeValid,
  tokenFor,
} from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET  → { required, unlocked }: whether a passcode is needed at all and
 *         whether this caller already holds a valid cookie. Lets the client
 *         skip the prompt when the gate is off or already unlocked.
 * POST { passcode } → sets the gate cookie on success, 401 otherwise.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    required: gateEnabled(),
    unlocked: isUnlocked(request),
  });
}

export async function POST(request: NextRequest) {
  let passcode = "";
  try {
    const body = await request.json();
    if (typeof body?.passcode === "string") passcode = body.passcode;
  } catch {
    // no body / not JSON — treat as empty, which fails validation below
  }

  if (!passcodeValid(passcode)) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  const res = NextResponse.json({ unlocked: true });
  if (gateEnabled()) {
    res.cookies.set(GATE_COOKIE, tokenFor(passcode), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
  return res;
}
