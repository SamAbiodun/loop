import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminEnabled,
  adminPasscodeValid,
  adminTokenFor,
  isAdmin,
} from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET  → { enabled, authed }: whether an admin passcode is configured and
 *         whether this caller is already signed in.
 * POST { passcode } → on match, set the admin cookie; else 401.
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    enabled: adminEnabled(),
    authed: isAdmin(request),
  });
}

export async function POST(request: NextRequest) {
  let passcode = "";
  try {
    const body = await request.json();
    if (typeof body?.passcode === "string") passcode = body.passcode.trim();
  } catch {
    // empty — fails validation
  }

  if (!adminPasscodeValid(passcode)) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  const res = NextResponse.json({ authed: true });
  res.cookies.set(ADMIN_COOKIE, adminTokenFor(passcode), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
