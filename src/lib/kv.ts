/**
 * Tiny key/value + set store used by the passcode system (src/lib/codes.ts).
 *
 * Backed by Upstash Redis when its REST env vars are present (production on
 * Vercel — add the Upstash integration and it injects them). With no Redis
 * configured it falls back to an in-process store so local dev and tests run
 * with zero setup. The in-memory backend is per-instance and non-persistent,
 * so it is NOT suitable for production (Vercel runs many short-lived
 * instances) — it exists only so the app boots and is testable without a DB.
 *
 * Server-only.
 */
import { Redis } from "@upstash/redis";

export interface Kv {
  getJSON<T>(key: string): Promise<T | null>;
  setJSON(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  sadd(key: string, member: string): Promise<void>;
  srem(key: string, member: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
}

/** True when a real Redis is wired up (so callers can warn in dev). */
export function kvIsPersistent(): boolean {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
  );
}

function upstashKv(): Kv {
  // Support both the Upstash-native and Vercel-KV env var names.
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL!;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN!;
  const redis = new Redis({ url, token });
  return {
    async getJSON<T>(key: string) {
      // Upstash auto-deserializes JSON written via set().
      return (await redis.get<T>(key)) ?? null;
    },
    async setJSON(key, value) {
      await redis.set(key, value);
    },
    async del(key) {
      await redis.del(key);
    },
    async sadd(key, member) {
      await redis.sadd(key, member);
    },
    async srem(key, member) {
      await redis.srem(key, member);
    },
    async smembers(key) {
      return await redis.smembers(key);
    },
  };
}

function memoryKv(): Kv {
  const values = new Map<string, unknown>();
  const sets = new Map<string, Set<string>>();
  return {
    async getJSON<T>(key: string) {
      return (values.get(key) as T | undefined) ?? null;
    },
    async setJSON(key, value) {
      values.set(key, value);
    },
    async del(key) {
      values.delete(key);
    },
    async sadd(key, member) {
      (sets.get(key) ?? sets.set(key, new Set()).get(key)!).add(member);
    },
    async srem(key, member) {
      sets.get(key)?.delete(member);
    },
    async smembers(key) {
      return [...(sets.get(key) ?? [])];
    },
  };
}

// One instance per server process. Reused across requests (and preserved
// across hot reloads in dev via globalThis) so the in-memory fallback doesn't
// reset on every request.
const g = globalThis as unknown as { __loopKv?: Kv };
export const kv: Kv = g.__loopKv ?? (g.__loopKv = kvIsPersistent() ? upstashKv() : memoryKv());
