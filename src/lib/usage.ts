import { randomBytes } from "crypto";
import { SESSION_CAP_MINUTES } from "@/features/voice/config";
import { recordSeconds, recordSession } from "./codes";
import { kv } from "./kv";
import { hashIdentifier } from "./security";

const SESSION_TTL_SECONDS = 60 * 60 * 2;
const MAX_REPORTED_SECONDS = SESSION_CAP_MINUTES * 60 + 10;
const ID_RE = /^[A-Za-z0-9_-]{20,64}$/;

const prefix = (code: string, id: string) =>
  `usage-session:${hashIdentifier(code)}:${id}`;

export async function issueUsageSession(code: string | null): Promise<string | null> {
  if (!code) return null;
  const id = randomBytes(18).toString("base64url");
  await kv.setJSON(`${prefix(code, id)}:issued`, true, {
    ttlSeconds: SESSION_TTL_SECONDS,
  });
  return id;
}

export async function markUsageSessionConnected(
  code: string,
  id: string,
): Promise<boolean> {
  if (!ID_RE.test(id) || !(await kv.exists(`${prefix(code, id)}:issued`))) {
    return false;
  }
  const first = await kv.setIfAbsent(
    `${prefix(code, id)}:connected`,
    true,
    SESSION_TTL_SECONDS,
  );
  if (first) await recordSession(code);
  return true;
}

export async function finalizeUsageSession(
  code: string,
  id: string,
  seconds: number,
): Promise<boolean> {
  if (
    !ID_RE.test(id) ||
    !(await kv.exists(`${prefix(code, id)}:connected`))
  ) {
    return false;
  }
  const first = await kv.setIfAbsent(
    `${prefix(code, id)}:finalized`,
    true,
    SESSION_TTL_SECONDS,
  );
  if (!first) return true;
  const clamped = Math.min(MAX_REPORTED_SECONDS, Math.max(0, Math.round(seconds)));
  if (clamped > 0) await recordSeconds(code, clamped);
  return true;
}
