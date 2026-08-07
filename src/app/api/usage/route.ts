import { NextRequest } from "next/server";
import { z } from "zod";
import { gateConfigurationError, unlockState } from "@/lib/auth";
import {
  RequestBodyError,
  checkRateLimit,
  rateLimitResponse,
  readJsonWithLimit,
  requestActor,
} from "@/lib/security";
import {
  finalizeUsageSession,
  markUsageSessionConnected,
} from "@/lib/usage";

export const runtime = "nodejs";

const Connected = z.object({
  event: z.literal("connected"),
  usageId: z.string().min(20).max(64),
});
const Final = z.object({
  event: z.literal("final"),
  usageId: z.string().min(20).max(64),
  seconds: z.number().finite().nonnegative(),
});
const Body = z.discriminatedUnion("event", [Connected, Final]);

export async function POST(request: NextRequest) {
  if (gateConfigurationError()) return new Response(null, { status: 204 });
  const { unlocked, code } = await unlockState(request);
  if (!unlocked || !code) return new Response(null, { status: 204 });

  const limit = await checkRateLimit({
    bucket: "usage-events-hour",
    identifier: requestActor(request, code),
    limit: 80,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const parsed = Body.parse(await readJsonWithLimit(request, 2_048));
    if (parsed.event === "connected") {
      await markUsageSessionConnected(code, parsed.usageId);
    } else {
      await finalizeUsageSession(code, parsed.usageId, parsed.seconds);
    }
  } catch (error) {
    if (error instanceof RequestBodyError && error.status === 413) {
      return Response.json({ error: error.message }, { status: 413 });
    }
    // Usage remains best-effort and never disrupts an interview.
  }
  return new Response(null, { status: 204 });
}
