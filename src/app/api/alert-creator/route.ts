import { NextRequest, NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { checkRateLimit, hashIdentifier, rateLimitResponse, requestIp } from "@/lib/security";

export const runtime = "nodejs";

/**
 * POST → ping the creator that the OpenAI account is out of credits. Public and
 * bodyless. Delivered at most once an hour overall (kv guard) and twice an
 * hour per IP, to ALERT_WEBHOOK_URL: an ntfy topic URL works as-is; any
 * endpoint that accepts a plain-text POST does too.
 */
export async function POST(request: NextRequest) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return NextResponse.json({ error: "Alerts are not configured." }, { status: 503 });

  const limit = await checkRateLimit({
    bucket: "creator-alert-hour",
    identifier: hashIdentifier(requestIp(request)),
    limit: 2,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  const first = await kv.setIfAbsent("creator-alert-sent", true, 60 * 60);
  if (!first) return NextResponse.json({ ok: true, deduped: true });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      Title: "loop is out of API credits",
      Priority: "high",
      Tags: "rotating_light",
    },
    body: `A visitor hit the out-of-credits wall on loop at ${new Date().toISOString()}. Top up: https://platform.openai.com/settings/organization/billing/`,
  });
  if (!res.ok) return NextResponse.json({ error: "Alert delivery failed." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
