import { NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let apiKey: string;
  try {
    apiKey = serverEnv.openaiApiKey;
  } catch (error) {
    return new Response((error as Error).message, { status: 500 });
  }

  // The voice component posts multipart/form-data with `sdp` + `session`.
  // Re-build the form server-side and forward it — streaming the raw request
  // body straight through makes Node/undici throw "expected non-null body
  // source", so we read it fully and re-send instead.
  const incoming = await request.formData();
  const form = new FormData();
  const sdp = incoming.get("sdp");
  const session = incoming.get("session");
  if (typeof sdp === "string") form.set("sdp", sdp);
  if (typeof session === "string") form.set("session", session);

  const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/sdp",
    },
  });
}
