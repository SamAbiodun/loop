import { NextRequest } from "next/server";
import { z } from "zod";
import {
  REALTIME_MODELS,
  isAllowedRealtimeModel,
} from "@/features/voice/config";
import { serverEnv } from "@/lib/env";
import {
  gateConfigurationError,
  unlockState,
} from "@/lib/auth";
import {
  RequestBodyError,
  checkRateLimit,
  isAbortError,
  rateLimitResponse,
  readJsonWithLimit,
  requestActor,
} from "@/lib/security";
import { issueUsageSession } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 20;

const Body = z.object({ model: z.string().optional() }).strict();

export async function POST(request: NextRequest) {
  const configurationError = gateConfigurationError();
  if (configurationError) {
    return Response.json({ error: configurationError }, { status: 503 });
  }

  const { unlocked, code } = await unlockState(request);
  if (!unlocked) {
    return Response.json(
      { error: "Locked — enter the passcode." },
      { status: 401 },
    );
  }

  const actor = requestActor(request, code);
  const burst = await checkRateLimit({
    bucket: "realtime-mint-10m",
    identifier: actor,
    limit: 5,
    windowSeconds: 10 * 60,
  });
  if (!burst.allowed) return rateLimitResponse(burst);
  const daily = await checkRateLimit({
    bucket: "realtime-mint-day",
    identifier: actor,
    limit: 20,
    windowSeconds: 24 * 60 * 60,
  });
  if (!daily.allowed) return rateLimitResponse(daily);

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await readJsonWithLimit(request, 2_048));
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return Response.json({ error: "Invalid session request." }, { status });
  }

  const requestedModel = body.model ?? REALTIME_MODELS.practice;
  if (!isAllowedRealtimeModel(requestedModel)) {
    return Response.json({ error: "Unsupported realtime model." }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = serverEnv.openaiApiKey;
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }

  try {
    const upstream = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: { type: "realtime", model: requestedModel },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    const text = await upstream.text();
    if (!upstream.ok) {
      // Avoid reflecting provider details or request identifiers to the client.
      return Response.json(
        { error: `Unable to create a voice session (${upstream.status}).` },
        { status: upstream.status >= 500 ? 502 : upstream.status },
      );
    }

    const payload = JSON.parse(text) as Record<string, unknown>;
    return Response.json({
      ...payload,
      usage_id: await issueUsageSession(code),
    });
  } catch (error) {
    return Response.json(
      {
        error: isAbortError(error)
          ? "Voice-session provider timed out."
          : "Unable to create a voice session.",
      },
      { status: 502 },
    );
  }
}
