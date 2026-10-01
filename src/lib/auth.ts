/**
 * Access control for the paid routes and the admin panel.
 *
 * Base gate mode is resolved from the environment:
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
 * In codes mode, an admin-controlled Redis setting can temporarily make the
 * visitor experience public without removing ADMIN_PASSCODE or deleting any
 * codes. The admin panel always stays protected.
 *
 * The effective gate state and gate cookie are re-validated against the source
 * of truth on EVERY paid request, so public/codes mode changes and code
 * revocations take effect immediately.
 *
 * Server-only.
 */
import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { codeIsValid, normalizeCode } from "./codes";
import { kv, kvIsPersistent } from "./kv";

export const GATE_COOKIE = "loop_gate";
export const ADMIN_COOKIE = "loop_admin";

type GateMode = "codes" | "passcode" | "open";
const PUBLIC_ACCESS_KEY = "settings:public-access";

export function gateMode(): GateMode {
  if (process.env.ADMIN_PASSCODE) return "codes";
  if (process.env.APP_PASSCODE) return "passcode";
  return "open";
}

/** Whether the admin has temporarily opened codes mode to all visitors. */
export async function publicAccessEnabled(): Promise<boolean> {
  if (gateMode() !== "codes") return gateMode() === "open";
  return (await kv.getJSON<boolean>(PUBLIC_ACCESS_KEY)) === true;
}

/** Persistently open or close visitor access. Admin authentication is separate. */
export async function setPublicAccessEnabled(enabled: boolean): Promise<void> {
  await kv.setJSON(PUBLIC_ACCESS_KEY, enabled);
}

/** Whether visitors must enter a passcode at all. Fails closed on store errors. */
export async function gateRequired(): Promise<boolean> {
  const mode = gateMode();
  if (mode === "open") return false;
  if (mode === "passcode") return true;
  return !(await publicAccessEnabled());
}

/** Deployed codes mode must never silently use per-instance memory. */
export function gateConfigurationError(): string | null {
  if (gateMode() === "codes" && process.env.VERCEL && !kvIsPersistent()) {
    return "Access-code storage is unavailable. Configure Upstash Redis for this Vercel environment.";
  }
  return null;
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
    const normalized = normalizeCode(passcode);
    return (await codeIsValid(normalized)) ? normalized : null;
  }
  return safeEqual(passcode, process.env.APP_PASSCODE as string) ? passcode : null;
}

export type UnlockState = { unlocked: boolean; code: string | null };

/** Read the gate cookie and re-check it against the live source of truth. */
export async function unlockState(
  request: NextRequest,
  required?: boolean,
): Promise<UnlockState> {
  const mustUnlock = required ?? (await gateRequired());
  if (!mustUnlock) return { unlocked: true, code: null };
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
