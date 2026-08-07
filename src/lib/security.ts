import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { kv } from "./kv";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

/** Privacy-preserving identifier suitable for Redis keys and logs. */
export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function requestIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function requestActor(request: NextRequest, code?: string | null): string {
  return code
    ? `code:${hashIdentifier(code)}`
    : `ip:${hashIdentifier(requestIp(request))}`;
}

export async function checkRateLimit(options: {
  bucket: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const count = await kv.increment(
    `rate:${options.bucket}:${options.identifier}`,
    options.windowSeconds,
  );
  return {
    allowed: count <= options.limit,
    limit: options.limit,
    remaining: Math.max(0, options.limit - count),
    retryAfterSeconds: options.windowSeconds,
  };
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return Response.json(
    { error: "Too many requests — please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}

export async function readJsonWithLimit<T>(
  request: NextRequest,
  maxBytes: number,
): Promise<T> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new RequestBodyError("Request body is too large.", 413);

  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = request.body?.getReader();
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError("Request body is too large.", 413);
      }
      chunks.push(value);
    }
  }

  const raw = Buffer.concat(chunks, received).toString("utf8");
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new RequestBodyError("Request body must be valid JSON.", 400);
  }
}

export class RequestBodyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}
