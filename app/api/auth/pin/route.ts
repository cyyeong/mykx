// The parent PIN (USER_STORIES §8.4 fix 8): status, setup or change in Your
// family, and verification that mints a 15-minute unlock cookie. Grown-up
// session required throughout. Setup and change need the grown-up's own proof
// (a device no kid has used since their password, or a valid unlock) and no kid
// signed in, so a PIN is never typed in front of a signed-in kid and a kid who
// switched themselves out can't set or change it. Forgot it: sign in again
// with the grown-up password, then set a new one.
import { withAuth } from "@/lib/auth/context";
import { clientIp, fail, ok, readBody } from "@/lib/auth/http";
import { takeToken } from "@/lib/auth/lockout";
import { PIN_MAX_WRONG, PIN_UNLOCK_COOKIE, PIN_WRONG_WINDOW_MS, grownUpAccess, pinUnlockCookieOptions, signPinUnlock } from "@/lib/auth/pin";
import { pinSetupBody, pinVerifyBody } from "@/lib/auth/schemas";
import { hashSecret, verifySecret } from "@/lib/auth/secrets";
import { sessionSecret } from "@/lib/auth/tokens";
import { z } from "zod";

const pinBody = z.object({ action: z.enum(["setup", "verify"]), pin: z.string().min(1).max(32) });

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const access = await grownUpAccess(store, jar);
    if (!access) return fail(401, "no-parent");
    return ok({ set: Boolean(access.parent.profile.pinHash), kidActive: access.kidActive, shared: access.shared, unlocked: access.unlocked });
  });
}

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const access = await grownUpAccess(store, jar);
    if (!access) return fail(401, "no-parent");
    const { parent } = access;
    const limited = takeToken("parent-pin", clientIp(request), 10);
    if (!limited.ok) return fail(429, "slow-down", { retryAfterSec: limited.retryAfterSec });
    const body = await readBody(request, pinBody);
    if (!body) return fail(400, "invalid");
    const secret = sessionSecret();
    if (!secret) return fail(503, "not-configured");

    if (body.action === "setup") {
      if (access.kidActive || access.state !== "open") return fail(403, "not-allowed");
      const fresh = pinSetupBody.safeParse({ pin: body.pin });
      if (!fresh.success) return fail(400, "invalid");
      const changing = parent.profile.pinHash !== null;
      await store.update(parent.householdId, parent.profile.id, {
        pinHash: await hashSecret({ kind: "password", password: fresh.data.pin }),
      });
      await store.audit({
        actor: parent.profile.id,
        actorRole: "parent",
        action: changing ? "parent.pin-change" : "parent.pin-setup",
        target: null,
        householdId: parent.householdId,
      });
      return ok({ set: true });
    }

    const attempt = pinVerifyBody.safeParse({ pin: body.pin });
    if (!attempt.success) return fail(400, "invalid");
    if (!parent.profile.pinHash) return fail(409, "needs-setup");
    // The pause counts this household's wrong PINs, not the grown-up's own sign-in lockout: a kid guessing
    // must never sign the grown-up (and with them, every kid on the device) out.
    const since = new Date(Date.now() - PIN_WRONG_WINDOW_MS).toISOString();
    if ((await store.countAudit(parent.householdId, "parent.pin-wrong", since)) >= PIN_MAX_WRONG) return fail(423, "locked");
    const good = await verifySecret({ kind: "password", password: attempt.data.pin }, parent.profile.pinHash);
    if (!good) {
      await store.audit({ actor: null, actorRole: "system", action: "parent.pin-wrong", target: parent.profile.id, householdId: parent.householdId });
      return fail(401, "wrong");
    }
    jar.set(
      PIN_UNLOCK_COOKIE,
      signPinUnlock({ householdId: parent.householdId, parentUserId: parent.user.userId }, secret),
      pinUnlockCookieOptions(),
    );
    await store.audit({
      actor: parent.profile.id,
      actorRole: "parent",
      action: "parent.pin-unlock",
      target: null,
      householdId: parent.householdId,
    });
    return ok({ unlocked: true });
  });
}
