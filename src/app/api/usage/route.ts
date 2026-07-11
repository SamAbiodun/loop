import { NextRequest } from "next/server";
import { unlockState } from "@/lib/auth";
import { recordSeconds } from "@/lib/codes";

export const runtime = "nodejs";

/**
 * POST { seconds } → add voice seconds to the caller's code usage. Sent by the
 * client (navigator.sendBeacon) when an interview session ends, so per-code
 * minutes reflect actual realtime-audio time — the OpenAI cost driver.
 *
 * Tolerates sendBeacon's text/plain body. Always 204; usage is best-effort and
 * must never surface an error to the user.
 */
export async function POST(request: NextRequest) {
  const { unlocked, code } = await unlockState(request);
  if (unlocked && code) {
    try {
      const raw = await request.text();
      const seconds = Number(JSON.parse(raw)?.seconds);
      if (Number.isFinite(seconds) && seconds > 0) {
        await recordSeconds(code, seconds);
      }
    } catch {
      // malformed beacon — ignore
    }
  }
  return new Response(null, { status: 204 });
}
