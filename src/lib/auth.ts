/**
 * Access control for the paid routes and the admin panel.
 *
 * Gate mode is resolved from the environment:
 *   - "codes"    — ADMIN_PASSCODE is set: the multi-code system in
 *                  src/lib/codes.ts is the source of truth (generate/disable
 *                  per code, track usage), managed via /admin. This is the
 *                  production path. The code store is Upstash when configured,
 *                  else an in-memory fallback (dev/test only — see kv.ts).
 *                  Tied to ADMIN_PASSCODE because codes can only be minted from
 *                  the admin panel; without it, codes mode would lock everyone
 *                  out with no way to add a code.
 *   - "passcode" — no ADMIN_PASSCODE but APP_PASSCODE is set: a single static
 *                  passcode (legacy fallback, no usage tracking).
 *   - "open"     — neither configured: the app runs open (local dev).
 *
 * The gate cookie is re-validated against the source of truth on EVERY paid
 * request, so disabling or deleting a code locks its holder out immediately.
 *
 * Server-only.
 */
import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { codeIsValid } from "./codes";

export const GATE_COOKIE = "loop_gate";
export const ADMIN_COOKIE = "loop_admin";

type GateMode = "codes" | "passcode" | "open";

export function gateMode(): GateMode {
  if (process.env.ADMIN_PASSCODE) return "codes";
  if (process.env.APP_PASSCODE) return "passcode";
  return "open";
}

/** Whether visitors must enter a passcode at all. */
export function gateRequired(): boolean {
  return gateMode() !== "open";
}

/** Constant-time compare for equal-length strings. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Validate a submitted or cookie-stored passcode. Returns the canonical code
 * string (used to attribute usage) when valid, or null when invalid. In open
 * mode every call is allowed and returns null (nothing to attribute).
 */
export async function validatePasscode(passcode: string): Promise<string | null> {
  const mode = gateMode();
  if (mode === "open") return null;
  if (!passcode) return null;
  if (mode === "codes") {
    return (await codeIsValid(passcode)) ? passcode : null;
  }
  return safeEqual(passcode, process.env.APP_PASSCODE as string) ? passcode : null;
}

export type UnlockState = { unlocked: boolean; code: string | null };

/** Read the gate cookie and re-check it against the live source of truth. */
export async function unlockState(request: NextRequest): Promise<UnlockState> {
  if (gateMode() === "open") return { unlocked: true, code: null };
  const cookie = request.cookies.get(GATE_COOKIE)?.value ?? "";
  const code = await validatePasscode(cookie);
  return { unlocked: code !== null, code };
}

// --- Admin panel -------------------------------------------------------------

export function adminEnabled(): boolean {
  return !!process.env.ADMIN_PASSCODE;
}

/** Opaque admin cookie value: a hash of ADMIN_PASSCODE (never the raw value). */
export function adminTokenFor(passcode: string): string {
  return createHash("sha256").update(passcode).digest("hex");
}

function expectedAdminToken(): string {
  return adminTokenFor(process.env.ADMIN_PASSCODE as string);
}

export function adminPasscodeValid(passcode: string): boolean {
  if (!adminEnabled()) return false;
  return safeEqual(adminTokenFor(passcode), expectedAdminToken());
}

export function isAdmin(request: NextRequest): boolean {
  if (!adminEnabled()) return false;
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  return !!token && safeEqual(token, expectedAdminToken());
}
