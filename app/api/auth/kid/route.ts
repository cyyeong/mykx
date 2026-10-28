// Kid sign-in at their door, on a device a grown-up is signed in on. Picture code (junior) or password
// (teen), checked against the scrypt hash with the 5-tries lockout. `setup: true` chooses the first
// picture code with the kid (only while none is set). On success sets the mykx_kid cookie (12 h). DELETE ends
// the kid's session only.
import { currentParent, withAuth } from "@/lib/auth/context";
import { checkKidSecret, nowIso } from "@/lib/auth/flows";
import { clientIp, fail, ok, readBody } from "@/lib/auth/http";
import { KID_COOKIE, kidCookieOptions, signKidSession } from "@/lib/auth/kid-session";
import { AFTER_SUCCESS, takeToken } from "@/lib/auth/lockout";
import { KIDS_HERE_COOKIE, kidsHereCookieOptions, signKidsHere } from "@/lib/auth/pin";
import { kidSignInBody, secretSchema } from "@/lib/auth/schemas";
import { hashSecret } from "@/lib/auth/secrets";
import { sessionSecret } from "@/lib/auth/tokens";

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const secret = sessionSecret();
    if (!secret) return fail(503, "not-configured");
    const limited = takeToken("kid-signin", clientIp(request), 30);
    if (!limited.ok) return fail(429, "slow-down", { retryAfterSec: limited.retryAfterSec });
    const body = await readBody(request, kidSignInBody);
    if (!body) return fail(400, "invalid");

    const parent = await currentParent(store, jar);
    if (!parent) return fail(403, "no-parent");
    let kid = await store.kid(parent.householdId, body.kidId);
    if (!kid) return fail(403, "not-found");
    if (kid.disabledAt) return fail(403, "disabled");

    if (body.setup) {
      if (kid.secretHash) return fail(409, "already-set");
      if (kid.secretKind && body.secret.kind !== kid.secretKind) return fail(400, "wrong-kind");
      const fresh = secretSchema.safeParse(body.secret); // a new password must meet the full rules
      if (!fresh.success) return fail(400, "invalid");
      kid = await store.update(parent.householdId, kid.id, {
        secretKind: fresh.data.kind,
        secretHash: await hashSecret(fresh.data),
        secretSetAt: nowIso(),
        secretEvent: "set",
        ...AFTER_SUCCESS,
      });
      if (!kid) return fail(403, "not-found");
      await store.audit({ actor: parent.profile.id, actorRole: "parent", action: "kid.secret-setup", target: kid.id, householdId: kid.householdId });
    } else {
      const refused = await checkKidSecret(store, kid, body.secret);
      if (refused) return refused;
    }

    await store.update(parent.householdId, kid.id, { lastSignInAt: nowIso() });
    jar.set(KID_COOKIE, signKidSession({ kidId: kid.id, householdId: kid.householdId, parentUserId: parent.user.userId }, secret), kidCookieOptions());
    // Kids use this device now: grown-up pages ask the PIN until the grown-up's password clears it (lib/auth/pin.ts).
    jar.set(KIDS_HERE_COOKIE, signKidsHere({ householdId: kid.householdId, parentUserId: parent.user.userId }, secret), kidsHereCookieOptions());
    return ok({ kid: { id: kid.id, nickname: kid.nickname, band: kid.band, pack: kid.pack }, next: "/home" });
  });
}

/** The kid steps away (Me → Sign out, or "Switch profile"): ends the kid's session only; the grown-up stays signed in, and the kids-here mark stays, so grown-up pages still ask the PIN. */
export async function DELETE(request: Request) {
  return withAuth(request, async ({ jar }) => {
    jar.delete(KID_COOKIE);
    return ok({ next: "/doors" });
  });
}
