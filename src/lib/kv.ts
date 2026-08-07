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
  setJSON(
    key: string,
    value: unknown,
    options?: { ttlSeconds?: number },
  ): Promise<void>;
  /** Set only when the key does not already exist. */
  setIfAbsent(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  /** Atomic integer increment. */
  incrBy(key: string, amount: number): Promise<number>;
  /** Atomic increment whose expiry is set on the first hit. */
  increment(key: string, ttlSeconds: number): Promise<number>;
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
    async setJSON(key, value, options) {
      if (options?.ttlSeconds) {
        await redis.set(key, value, { ex: options.ttlSeconds });
      } else {
        await redis.set(key, value);
      }
    },
    async setIfAbsent(key, value, ttlSeconds) {
      const result = await redis.set(key, value, {
        nx: true,
        ex: ttlSeconds,
      });
      return result === "OK";
    },
    async exists(key) {
      return (await redis.exists(key)) > 0;
    },
    async incrBy(key, amount) {
      return await redis.incrby(key, amount);
    },
    async increment(key, ttlSeconds) {
      const script = `
        local current = redis.call('INCR', KEYS[1])
        if current == 1 then
          redis.call('EXPIRE', KEYS[1], ARGV[1])
        end
        return current
      `;
      return Number(await redis.eval(script, [key], [ttlSeconds]));
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
  const expires = new Map<string, number>();
  const sets = new Map<string, Set<string>>();

  const purgeIfExpired = (key: string) => {
    const expiresAt = expires.get(key);
    if (expiresAt !== undefined && expiresAt <= Date.now()) {
      values.delete(key);
      expires.delete(key);
    }
  };

  return {
    async getJSON<T>(key: string) {
      purgeIfExpired(key);
      return (values.get(key) as T | undefined) ?? null;
    },
    async setJSON(key, value, options) {
      values.set(key, value);
      if (options?.ttlSeconds) {
        expires.set(key, Date.now() + options.ttlSeconds * 1000);
      } else {
        expires.delete(key);
      }
    },
    async setIfAbsent(key, value, ttlSeconds) {
      purgeIfExpired(key);
      if (values.has(key)) return false;
      values.set(key, value);
      expires.set(key, Date.now() + ttlSeconds * 1000);
      return true;
    },
    async exists(key) {
      purgeIfExpired(key);
      return values.has(key);
    },
    async incrBy(key, amount) {
      purgeIfExpired(key);
      const next = Number(values.get(key) ?? 0) + amount;
      values.set(key, next);
      return next;
    },
    async increment(key, ttlSeconds) {
      purgeIfExpired(key);
      const isNew = !values.has(key);
      const next = Number(values.get(key) ?? 0) + 1;
      values.set(key, next);
      if (isNew) expires.set(key, Date.now() + ttlSeconds * 1000);
      return next;
    },
    async del(key) {
      values.delete(key);
      expires.delete(key);
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
