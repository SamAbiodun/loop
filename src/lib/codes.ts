/**
 * Access-code records and atomic usage counters.
 *
 * New codes are stored by SHA-256 digest, never as plaintext. Legacy plaintext
 * records are migrated lazily when they are listed or used. The browser still
 * carries the plaintext code as an httpOnly bearer cookie, but a Redis leak no
 * longer reveals newly issued credentials.
 */
import { createHash, randomBytes } from "crypto";
import { kv } from "./kv";

export type CodeRecord = {
  /** Opaque admin identifier (the credential digest). */
  id: string;
  /** Masked value for display; the plaintext is returned only at creation. */
  code: string;
  label: string;
  enabled: boolean;
  created: string;
  sessions: number;
  runs: number;
  seconds: number;
  lastUsed: string | null;
};

type StoredCodeRecord = CodeRecord & { version: 2 };
type LegacyCodeRecord = Omit<CodeRecord, "id">;

const INDEX = "codes";
const key = (id: string) => `code:${id}`;
const usageKey = (id: string, field: "sessions" | "runs" | "seconds") =>
  `code-usage:${id}:${field}`;
const lastUsedKey = (id: string) => `code-usage:${id}:last-used`;

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGEST_RE = /^[a-f0-9]{64}$/;
const MAX_LABEL = 160;

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export function digestCode(code: string): string {
  return createHash("sha256").update(normalizeCode(code)).digest("hex");
}

function previewCode(code: string): string {
  const normalized = normalizeCode(code);
  return `•••••-${normalized.slice(-5)}`;
}

export function generateCode(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
    if (i === 4) out += "-";
  }
  return out;
}

async function hydrate(record: StoredCodeRecord): Promise<CodeRecord> {
  const [sessions, runs, seconds, lastUsed] = await Promise.all([
    kv.getJSON<number>(usageKey(record.id, "sessions")),
    kv.getJSON<number>(usageKey(record.id, "runs")),
    kv.getJSON<number>(usageKey(record.id, "seconds")),
    kv.getJSON<string>(lastUsedKey(record.id)),
  ]);
  const { version: _version, ...publicRecord } = record;
  void _version;
  return {
    ...publicRecord,
    sessions: record.sessions + (sessions ?? 0),
    runs: record.runs + (runs ?? 0),
    seconds: record.seconds + (seconds ?? 0),
    lastUsed: lastUsed ?? record.lastUsed,
  };
}

/** Migrate a v1 record whose set member and key contain the plaintext code. */
async function migrateLegacy(
  plaintext: string,
  legacy: LegacyCodeRecord,
): Promise<StoredCodeRecord> {
  const normalized = normalizeCode(plaintext);
  const id = digestCode(normalized);
  const existing = await kv.getJSON<StoredCodeRecord>(key(id));
  if (existing) return existing;

  const migrated: StoredCodeRecord = {
    version: 2,
    id,
    code: previewCode(normalized),
    label: String(legacy.label || "unnamed").slice(0, MAX_LABEL),
    enabled: legacy.enabled !== false,
    created: legacy.created || new Date().toISOString(),
    sessions: Number(legacy.sessions || 0),
    runs: Number(legacy.runs || 0),
    seconds: Number(legacy.seconds || 0),
    lastUsed: legacy.lastUsed || null,
  };
  await kv.setJSON(key(id), migrated);
  await kv.sadd(INDEX, id);
  await kv.del(key(plaintext));
  await kv.srem(INDEX, plaintext);
  return migrated;
}

async function storedForPlaintext(code: string): Promise<StoredCodeRecord | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const id = digestCode(normalized);
  const current = await kv.getJSON<StoredCodeRecord>(key(id));
  if (current) return current;

  // Backwards compatibility with codes issued before digest storage.
  const legacy = await kv.getJSON<LegacyCodeRecord>(key(normalized));
  return legacy ? migrateLegacy(normalized, legacy) : null;
}

async function recordForIndexMember(member: string): Promise<StoredCodeRecord | null> {
  if (DIGEST_RE.test(member)) {
    return await kv.getJSON<StoredCodeRecord>(key(member));
  }
  const legacy = await kv.getJSON<LegacyCodeRecord>(key(member));
  return legacy ? migrateLegacy(member, legacy) : null;
}

export async function listCodes(): Promise<CodeRecord[]> {
  const members = await kv.smembers(INDEX);
  const stored = await Promise.all(members.map(recordForIndexMember));
  const records = await Promise.all(
    stored.filter((r): r is StoredCodeRecord => r !== null).map(hydrate),
  );
  return records.sort((a, b) => b.created.localeCompare(a.created));
}

export async function createCode(label: string): Promise<{
  record: CodeRecord;
  plaintext: string;
}> {
  let plaintext = generateCode();
  let id = digestCode(plaintext);
  while (await kv.exists(key(id))) {
    plaintext = generateCode();
    id = digestCode(plaintext);
  }

  const stored: StoredCodeRecord = {
    version: 2,
    id,
    code: previewCode(plaintext),
    label: label.trim().slice(0, MAX_LABEL) || "unnamed",
    enabled: true,
    created: new Date().toISOString(),
    sessions: 0,
    runs: 0,
    seconds: 0,
    lastUsed: null,
  };
  await kv.setJSON(key(id), stored);
  await kv.sadd(INDEX, id);
  return { record: await hydrate(stored), plaintext };
}

export async function setEnabled(id: string, enabled: boolean): Promise<boolean> {
  if (!DIGEST_RE.test(id)) return false;
  const record = await kv.getJSON<StoredCodeRecord>(key(id));
  if (!record) return false;
  await kv.setJSON(key(id), { ...record, enabled });
  return true;
}

export async function deleteCode(id: string): Promise<boolean> {
  if (!DIGEST_RE.test(id)) return false;
  if (!(await kv.exists(key(id)))) return false;
  await Promise.all([
    kv.del(key(id)),
    kv.del(usageKey(id, "sessions")),
    kv.del(usageKey(id, "runs")),
    kv.del(usageKey(id, "seconds")),
    kv.del(lastUsedKey(id)),
    kv.srem(INDEX, id),
  ]);
  return true;
}

export async function codeIsValid(code: string): Promise<boolean> {
  const record = await storedForPlaintext(code);
  return !!record && record.enabled;
}

async function bump(
  code: string,
  field: "sessions" | "runs" | "seconds",
  amount: number,
): Promise<void> {
  const record = await storedForPlaintext(code);
  if (!record || !record.enabled) return;
  await Promise.all([
    kv.incrBy(usageKey(record.id, field), Math.max(0, Math.round(amount))),
    kv.setJSON(lastUsedKey(record.id), new Date().toISOString()),
  ]);
}

export const recordSession = (code: string) => bump(code, "sessions", 1);
export const recordRun = (code: string) => bump(code, "runs", 1);
export const recordSeconds = (code: string, seconds: number) =>
  bump(code, "seconds", seconds);
