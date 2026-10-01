import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  gateConfigurationError,
  isAdmin,
  publicAccessEnabled,
  setPublicAccessEnabled,
} from "@/lib/auth";
import { RequestBodyError, readJsonWithLimit } from "@/lib/security";

export const runtime = "nodejs";

function guard(request: NextRequest): NextResponse | null {
  const configurationError = gateConfigurationError();
  if (configurationError) {
    return NextResponse.json({ error: configurationError }, { status: 503 });
  }
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** GET → the effective visitor-access setting. */
export async function GET(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;
  return NextResponse.json(
    { publicAccess: await publicAccessEnabled() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** PATCH { publicAccess } → open or close the visitor code gate immediately. */
export async function PATCH(request: NextRequest) {
  const denied = guard(request);
  if (denied) return denied;

  let publicAccess: boolean;
  try {
    const body = z
      .object({ publicAccess: z.boolean() })
      .strict()
      .parse(await readJsonWithLimit(request, 2_048));
    publicAccess = body.publicAccess;
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return NextResponse.json({ error: "Invalid access setting." }, { status });
  }

  await setPublicAccessEnabled(publicAccess);
  return NextResponse.json({ publicAccess });
}
