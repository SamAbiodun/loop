import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminEnabled,
  adminPasscodeValid,
  adminTokenFor,
  isAdmin,
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
  const limit = await checkRateLimit({
    bucket: "admin-unlock-15m",
    identifier: hashIdentifier(requestIp(request)),
    limit: 8,
    windowSeconds: 15 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  let passcode = "";
  try {
    const body = await readJsonWithLimit<{ passcode?: unknown }>(request, 2_048);
    if (typeof body?.passcode === "string") passcode = body.passcode.trim();
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Invalid sign-in request." }, { status });
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

export async function DELETE() {
  const res = NextResponse.json({ authed: false });
  res.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
