/**
 * Access requests: visitors who hit the passcode gate can ask for a code by
 * leaving their name and email. Each request is a record in the KV store
 * (src/lib/kv.ts); the admin reviews them in /admin and either mints a code
 * (src/lib/codes.ts) or dismisses the request.
 *
 * This is a lightweight inbox, not an auth path — nothing here grants access.
 *
 * Server-only.
 */
import { randomBytes } from "crypto";
import { kv } from "./kv";

export type AccessRequest = {
  id: string;
  name: string;
  email: string;
  note: string;
  created: string; // ISO
};

const INDEX = "requests"; // set of all request ids
const key = (id: string) => `request:${id}`;

// Keep the inbox from being flooded from a single open endpoint.
const MAX_REQUESTS = 200;
const MAX_NAME = 120;
const MAX_EMAIL = 200;
const MAX_NOTE = 500;

// Deliberately lax — just enough to reject obvious junk, not to validate
// deliverability. Something@something.something.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export async function listRequests(): Promise<AccessRequest[]> {
  const ids = await kv.smembers(INDEX);
  const records = await Promise.all(ids.map((id) => kv.getJSON<AccessRequest>(key(id))));
  return records
    .filter((r): r is AccessRequest => r !== null)
    .sort((a, b) => b.created.localeCompare(a.created));
}

/**
 * Store a new access request. Returns null when the input is invalid or the
 * inbox is full (caller maps that to a 4xx). Trims and clamps every field so an
 * open endpoint can't stuff the store with oversized values.
 */
export async function createRequest(input: {
  name: string;
  email: string;
  note?: string;
}): Promise<AccessRequest | null> {
  const name = input.name.trim().slice(0, MAX_NAME);
  const email = input.email.trim().slice(0, MAX_EMAIL);
  const note = (input.note ?? "").trim().slice(0, MAX_NOTE);
  if (!name || !isValidEmail(email)) return null;

  const ids = await kv.smembers(INDEX);
  if (ids.length >= MAX_REQUESTS) return null;

  const id = randomBytes(9).toString("base64url"); // 12 url-safe chars
  const record: AccessRequest = {
    id,
    name,
    email,
    note,
    created: new Date().toISOString(),
  };
  await kv.setJSON(key(id), record);
  await kv.sadd(INDEX, id);
  return record;
}

export async function deleteRequest(id: string): Promise<void> {
  await kv.del(key(id));
  await kv.srem(INDEX, id);
}
