import { NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Mints a short-lived ephemeral client secret so the browser can open a
 * Realtime WebRTC session (via @openai/agents/realtime) without ever seeing the
 * real API key. The client passes the returned `value` to session.connect().
 */
export async function POST(request: NextRequest) {
  let apiKey: string;
  try {
    apiKey = serverEnv.openaiApiKey;
  } catch (error) {
    return new Response((error as Error).message, { status: 500 });
  }

  let model = "gpt-realtime-mini";
  try {
    const body = await request.json();
    if (typeof body?.model === "string") model = body.model;
  } catch {
    // no body / not JSON — fall back to the default model
  }

  const upstream = await fetch(
    "https://api.openai.com/v1/realtime/client_secrets",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session: { type: "realtime", model } }),
    },
  );

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
