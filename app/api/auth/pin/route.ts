// The parent PIN (USER_STORIES §8.4 fix 8): status, one-time setup in Your
// family, and verification that mints a 15-minute unlock cookie. Grown-up
// session required throughout; setup additionally needs no kid session, so a
// PIN is never typed in front of a signed-in kid.
import { currentKid, currentParent, withAuth } from "@/lib/auth/context";
import { clientIp, fail, ok, readBody } from "@/lib/auth/http";
import { AFTER_SUCCESS, lockRemainingSec, takeToken } from "@/lib/auth/lockout";
import { PIN_UNLOCK_COOKIE, pinUnlockCookieOptions, signPinUnlock, verifyPinUnlock } from "@/lib/auth/pin";
import { pinSetupBody, pinVerifyBody } from "@/lib/auth/schemas";
import { hashSecret, verifySecret } from "@/lib/auth/secrets";
import { sessionSecret } from "@/lib/auth/tokens";
import { z } from "zod";

const pinBody = z.object({ action: z.enum(["setup", "verify"]), pin: z.string().min(1).max(32) });

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const secret = sessionSecret();
    const kid = await currentKid(store, jar, parent);
    const unlocked =
      !!secret &&
      verifyPinUnlock(jar.get(PIN_UNLOCK_COOKIE), {
        householdId: parent.householdId,
        parentUserId: parent.user.userId,
        secret,
      }).ok;
    return ok({ set: parent.profile.pinHash !== null, kidActive: kid !== null, unlocked });
  });
}

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const limited = takeToken("parent-pin", clientIp(request), 10);
    if (!limited.ok) return fail(429, "slow-down", { retryAfterSec: limited.retryAfterSec });
    const body = await readBody(request, pinBody);
    if (!body) return fail(400, "invalid");
    const secret = sessionSecret();
    if (!secret) return fail(503, "not-configured");

    if (body.action === "setup") {
      if (await currentKid(store, jar, parent)) return fail(403, "not-allowed");
      const fresh = pinSetupBody.safeParse({ pin: body.pin });
      if (!fresh.success) return fail(400, "invalid");
      if (parent.profile.pinHash !== null) return fail(409, "already-set");
      await store.update(parent.householdId, parent.profile.id, {
        pinHash: await hashSecret({ kind: "password", password: fresh.data.pin }),
        ...AFTER_SUCCESS,
      });
      await store.audit({
        actor: parent.profile.id,
        actorRole: "parent",
        action: "parent.pin-setup",
        target: null,
        householdId: parent.householdId,
      });
      return ok({ set: true });
    }

    const attempt = pinVerifyBody.safeParse({ pin: body.pin });
    if (!attempt.success) return fail(400, "invalid");
    if (lockRemainingSec(parent.profile.lockedUntil) > 0) return fail(423, "locked");
    const good = await verifySecret({ kind: "password", password: attempt.data.pin }, parent.profile.pinHash);
    if (!good) {
      const failedAttempts = parent.profile.failedAttempts + 1;
      await store.update(parent.householdId, parent.profile.id, {
        failedAttempts,
        lockedUntil: failedAttempts >= 5 ? new Date(Date.now() + 60_000).toISOString() : parent.profile.lockedUntil,
      });
      return fail(401, "wrong");
    }
    await store.update(parent.householdId, parent.profile.id, { ...AFTER_SUCCESS });
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
