import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  REALTIME_MODELS,
  isAllowedRealtimeModel,
} from "../features/voice/config";
import { digestCode, generateCode, normalizeCode } from "./codes";
import { RequestBodyError, hashIdentifier, readJsonWithLimit } from "./security";

describe("security boundaries", () => {
  it("accepts only the two product realtime models", () => {
    expect(isAllowedRealtimeModel(REALTIME_MODELS.practice)).toBe(true);
    expect(isAllowedRealtimeModel(REALTIME_MODELS.hard)).toBe(true);
    expect(isAllowedRealtimeModel("gpt-realtime")).toBe(false);
    expect(isAllowedRealtimeModel(undefined)).toBe(false);
  });

  it("generates normalized high-entropy access-code shapes", () => {
    const code = generateCode();
    expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
    expect(normalizeCode(`  ${code.toLowerCase()}  `)).toBe(code);
    expect(digestCode(code)).toHaveLength(64);
    expect(digestCode(code)).not.toContain(code);
  });

  it("uses stable, bounded identifiers for rate-limit keys", () => {
    expect(hashIdentifier("203.0.113.1")).toHaveLength(24);
    expect(hashIdentifier("same")).toBe(hashIdentifier("same"));
    expect(hashIdentifier("same")).not.toBe(hashIdentifier("different"));
  });

  it("parses bounded JSON and rejects oversized streamed bodies", async () => {
    const valid = new NextRequest("http://localhost/api/test", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });
    await expect(readJsonWithLimit(valid, 64)).resolves.toEqual({ ok: true });

    const oversized = new NextRequest("http://localhost/api/test", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(100) }),
    });
    await expect(readJsonWithLimit(oversized, 32)).rejects.toMatchObject({
      status: 413,
    } satisfies Partial<RequestBodyError>);
  });
});
