import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  adminTokenFor,
  gateRequired,
  isAdmin,
  publicAccessEnabled,
  setPublicAccessEnabled,
  unlockState,
} from "./auth";

const originalAdminPasscode = process.env.ADMIN_PASSCODE;
const originalAppPasscode = process.env.APP_PASSCODE;
const originalVercel = process.env.VERCEL;

describe("visitor access settings", () => {
  beforeEach(async () => {
    process.env.ADMIN_PASSCODE = "test-admin-passcode";
    delete process.env.APP_PASSCODE;
    delete process.env.VERCEL;
    await setPublicAccessEnabled(false);
  });

  afterEach(async () => {
    await setPublicAccessEnabled(false);
    if (originalAdminPasscode === undefined) delete process.env.ADMIN_PASSCODE;
    else process.env.ADMIN_PASSCODE = originalAdminPasscode;
    if (originalAppPasscode === undefined) delete process.env.APP_PASSCODE;
    else process.env.APP_PASSCODE = originalAppPasscode;
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it("opens and closes codes mode without changing environment configuration", async () => {
    expect(await gateRequired()).toBe(true);
    expect(await publicAccessEnabled()).toBe(false);

    await setPublicAccessEnabled(true);
    expect(await publicAccessEnabled()).toBe(true);
    expect(await gateRequired()).toBe(false);
    await expect(
      unlockState(new NextRequest("http://localhost/api/session")),
    ).resolves.toEqual({ unlocked: true, code: null });

    await setPublicAccessEnabled(false);
    expect(await gateRequired()).toBe(true);
    await expect(
      unlockState(new NextRequest("http://localhost/api/session")),
    ).resolves.toEqual({ unlocked: false, code: null });
  });

  it("does not let the public setting bypass legacy single-passcode mode", async () => {
    await setPublicAccessEnabled(true);
    delete process.env.ADMIN_PASSCODE;
    process.env.APP_PASSCODE = "legacy-passcode";
    expect(await gateRequired()).toBe(true);
  });

  it("recognizes only the authenticated admin cookie used by settings routes", () => {
    expect(isAdmin(new NextRequest("http://localhost/api/admin/settings"))).toBe(
      false,
    );
    const cookie = `${ADMIN_COOKIE}=${adminTokenFor("test-admin-passcode")}`;
    expect(
      isAdmin(
        new NextRequest("http://localhost/api/admin/settings", {
          headers: { Cookie: cookie },
        }),
      ),
    ).toBe(true);
    expect(
      isAdmin(
        new NextRequest("http://localhost/api/admin/settings", {
          headers: { Cookie: `${ADMIN_COOKIE}=not-the-admin-token` },
        }),
      ),
    ).toBe(false);
  });
});
