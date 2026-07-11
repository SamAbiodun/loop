import { NextRequest, NextResponse } from "next/server";
import {
  GATE_COOKIE,
  gateRequired,
  unlockState,
  validatePasscode,
} from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET  → { required, unlocked }: whether a passcode is needed and whether this
 *         caller already holds a valid one (re-checked live, so a disabled
 *         code reads as locked).
 * POST { passcode } → on a valid code, set the gate cookie; else 401.
 */
export async function GET(request: NextRequest) {
  const { unlocked } = await unlockState(request);
  return NextResponse.json({ required: gateRequired(), unlocked });
}

export async function POST(request: NextRequest) {
  let passcode = "";
  try {
    const body = await request.json();
    if (typeof body?.passcode === "string") passcode = body.passcode.trim();
  } catch {
    // no body / not JSON — treated as empty, fails validation below
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
