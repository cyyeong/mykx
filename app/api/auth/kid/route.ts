// Kid sign-in at their door, on a device a grown-up is signed in on. Picture code (junior) or password
// (teen), checked against the scrypt hash with the 5-tries lockout. `setup: true` chooses the first
// picture code with the kid (only while none is set). On success sets the mykx_kid cookie (12 h). DELETE ends
// the kid's session only.
import { z } from "zod";
import { currentParent, withAuth } from "@/lib/auth/context";
import { checkKidSecret, nowIso } from "@/lib/auth/flows";
import { clientIp, fail, ok, readBody } from "@/lib/auth/http";
import { KID_COOKIE, kidCookieOptions, signKidSession } from "@/lib/auth/kid-session";
import { AFTER_SUCCESS, takeToken } from "@/lib/auth/lockout";
import { KIDS_HERE_COOKIE, kidsHereCookieOptions, signKidsHere } from "@/lib/auth/pin";
import { kidDoorSignInBody, kidSignInBody, secretSchema } from "@/lib/auth/schemas";
import { DOOR_COOKIE, verifyDoorTicket } from "@/lib/auth/door-ticket";
import { hashSecret } from "@/lib/auth/secrets";
import { sessionSecret } from "@/lib/auth/tokens";

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const secret = sessionSecret();
    if (!secret) return fail(503, "not-configured");
    const limited = takeToken("kid-signin", clientIp(request), 30);
    if (!limited.ok) return fail(429, "slow-down", { retryAfterSec: limited.retryAfterSec });
    const body = await readBody(request, z.union([kidSignInBody, kidDoorSignInBody]));
    if (!body) return fail(400, "invalid");

    // The magic-name door (sign-in page, no grown-up here): the door ticket says who; the session is solo.
    if ("door" in body) {
      const ticket = verifyDoorTicket(jar.get(DOOR_COOKIE), secret);
      if (!ticket) return fail(403, "not-found", { note: "Tell me your magic name again." });
      const kid = await store.kid(ticket.householdId, ticket.kidId);
      if (!kid) return fail(403, "not-found");
      if (kid.disabledAt) return fail(403, "disabled");
      if (!kid.secretHash) return fail(409, "needs-setup");
      const refused = await checkKidSecret(store, kid, body.secret);
      if (refused) return refused;
      await store.update(kid.householdId, kid.id, { lastSignInAt: nowIso() });
      jar.delete(DOOR_COOKIE);
      jar.set(KID_COOKIE, signKidSession({ kidId: kid.id, householdId: kid.householdId, soloSecretHash: kid.secretHash }, secret), kidCookieOptions());
      return ok({ kid: { id: kid.id, nickname: kid.nickname, band: kid.band, pack: kid.pack }, next: "/home" });
    }

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

/** The kid steps away (Sign out, "Switch profile", or 15 minutes idle): ends the kid's session only. A grown-up
 *  signed in on this device stays signed in (and the kids-here mark stays, so grown-up pages still ask the PIN),
 *  so the kid goes back to the doors; with no grown-up here, back to the sign-in page. */
export async function DELETE(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    jar.delete(KID_COOKIE);
    const parent = await currentParent(store, jar);
    return ok({ next: parent ? "/doors" : "/signin" });
  });
}
