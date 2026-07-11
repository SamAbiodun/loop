/**
 * Access codes: the multi-passcode system behind the app.
 *
 * Each code is a record in the KV store (src/lib/kv.ts) holding a label, an
 * enabled flag, and usage counters (sessions started, code runs, and voice
 * seconds — the OpenAI cost driver). Codes are checked against the store on
 * every paid request, so disabling one takes effect immediately, even for a
 * visitor who already unlocked.
 *
 * Server-only.
 */
import { randomBytes } from "crypto";
import { kv } from "./kv";

export type CodeRecord = {
  code: string;
  label: string;
  enabled: boolean;
  created: string; // ISO
  sessions: number; // voice sessions started
  runs: number; // code executions
  seconds: number; // total voice seconds (÷60 for minutes)
  lastUsed: string | null; // ISO
};

const INDEX = "codes"; // set of all code strings
const key = (code: string) => `code:${code}`;

// Crockford base32 minus ambiguous chars, so codes are safe to read aloud
// and type. 10 chars ≈ 50 bits of entropy — plenty for a demo gate.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateCode(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
    if (i === 4) out += "-";
  }
  return out; // e.g. "K7P2M-9RXQ4"
}

export async function listCodes(): Promise<CodeRecord[]> {
  const codes = await kv.smembers(INDEX);
  const records = await Promise.all(codes.map((c) => kv.getJSON<CodeRecord>(key(c))));
  return records
    .filter((r): r is CodeRecord => r !== null)
    .sort((a, b) => b.created.localeCompare(a.created));
}

export async function createCode(label: string): Promise<CodeRecord> {
  let code = generateCode();
  // Vanishingly unlikely, but never reuse an existing code.
  while (await kv.getJSON<CodeRecord>(key(code))) code = generateCode();
  const record: CodeRecord = {
    code,
    label: label.trim() || "unnamed",
    enabled: true,
    created: new Date().toISOString(),
    sessions: 0,
    runs: 0,
    seconds: 0,
    lastUsed: null,
  };
  await kv.setJSON(key(code), record);
  await kv.sadd(INDEX, code);
  return record;
}

export async function setEnabled(code: string, enabled: boolean): Promise<void> {
  const record = await kv.getJSON<CodeRecord>(key(code));
  if (!record) return;
  record.enabled = enabled;
  await kv.setJSON(key(code), record);
}

export async function deleteCode(code: string): Promise<void> {
  await kv.del(key(code));
  await kv.srem(INDEX, code);
}

/** True only when the code exists AND is enabled — the unlock/gate check. */
export async function codeIsValid(code: string): Promise<boolean> {
  const record = await kv.getJSON<CodeRecord>(key(code));
  return !!record && record.enabled;
}

/**
 * Bump usage counters for a code. Read-modify-write (not atomic) — fine at
 * personal-project traffic where concurrent writes to the same code are rare;
 * a lost increment only undercounts a stat, it never affects access.
 */
async function bump(code: string, patch: Partial<CodeRecord>): Promise<void> {
  const record = await kv.getJSON<CodeRecord>(key(code));
  if (!record) return;
  await kv.setJSON(key(code), {
    ...record,
    sessions: record.sessions + (patch.sessions ?? 0),
    runs: record.runs + (patch.runs ?? 0),
    seconds: record.seconds + (patch.seconds ?? 0),
    lastUsed: new Date().toISOString(),
  });
}

export const recordSession = (code: string) => bump(code, { sessions: 1 });
export const recordRun = (code: string) => bump(code, { runs: 1 });
export const recordSeconds = (code: string, seconds: number) =>
  bump(code, { seconds: Math.max(0, Math.round(seconds)) });
