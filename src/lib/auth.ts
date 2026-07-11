/**
 * Shared-passcode gate for the paid API routes.
 *
 * The gate is active ONLY when APP_PASSCODE is set. Left unset (e.g. local
 * dev) the app runs fully open. In production APP_PASSCODE guards
 * /api/session and /api/run so a public URL can't drain OpenAI credit —
 * a caller must first unlock with the shared passcode.
 *
 * Server-only: imports node:crypto and reads process.env. Never import from
 * the client.
 */
import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

export const GATE_COOKIE = "loop_gate";

/** Gate is enforced only when a passcode is configured. */
export function gateEnabled(): boolean {
  return !!process.env.APP_PASSCODE;
}

/** Opaque cookie value: a hash of the passcode, so the raw passcode never
 *  sits in the browser. */
export function tokenFor(passcode: string): string {
  return createHash("sha256").update(passcode).digest("hex");
}

function expectedToken(): string {
  return tokenFor(process.env.APP_PASSCODE as string);
}

/** Constant-time string compare (both are fixed-length sha256 hex here). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** True when the caller may hit the paid APIs: gate off, or a valid cookie. */
export function isUnlocked(request: NextRequest): boolean {
  if (!gateEnabled()) return true;
  const token = request.cookies.get(GATE_COOKIE)?.value;
  return !!token && safeEqual(token, expectedToken());
}

/** Validate a submitted passcode against APP_PASSCODE. */
export function passcodeValid(passcode: string): boolean {
  if (!gateEnabled()) return true;
  return safeEqual(tokenFor(passcode), expectedToken());
}
