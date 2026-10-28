// Steps shared by several routes and the server-component helpers.
import { currentParent, grownUpLabel, toDoor, type Parent } from "./context.ts";
import type { CookieJar } from "./http.ts";
import { fail } from "./http.ts";
import { AFTER_SUCCESS, afterFailure, lockRemainingSec, retryAfter } from "./lockout.ts";
import type { DoorsResult, SecretAttempt } from "./schemas.ts";
import { verifySecret } from "./secrets.ts";
import type { AuthStore, Profile } from "./store.ts";

export const nowIso = (now = Date.now()) => new Date(now).toISOString();

/** "Who's learning?": the signed-in household's enabled kids. */
export async function doorsFor(store: AuthStore, jar: CookieJar, now = Date.now()): Promise<DoorsResult & { parent: Parent | null }> {
  const parent = await currentParent(store, jar, now);
  if (!parent) return { signedIn: false, grownUp: null, kids: [], parent: null };
  const kids = (await store.kids(parent.householdId)).filter((k) => !k.disabledAt);
  return { signedIn: true, grownUp: grownUpLabel(parent), kids: kids.map((k) => toDoor(k, now)), parent };
}

/**
 * Checks a kid's code or password with the lockout rules: 423 while locked, 401 with tries left on a
 * wrong answer, 423 on the fifth (and an audit row), null when it matched (the count is cleared).
 */
export async function checkKidSecret(store: AuthStore, kid: Profile, attempt: SecretAttempt, now = Date.now()): Promise<Response | null> {
  if (lockRemainingSec(kid.lockedUntil, now) > 0) return fail(423, "locked", { retryAfterSec: retryAfter(kid.lockedUntil, now) });
  if (!kid.secretHash) return fail(409, "needs-setup");
  if (kid.secretKind && attempt.kind !== kid.secretKind) return fail(400, "wrong-kind");
  if (await verifySecret(attempt, kid.secretHash)) {
    if (kid.failedAttempts !== 0 || kid.lockedUntil) await store.update(kid.householdId, kid.id, { ...AFTER_SUCCESS });
    return null;
  }
  const outcome = afterFailure(kid.failedAttempts, now);
  await store.update(kid.householdId, kid.id, { failedAttempts: outcome.failedAttempts, lockedUntil: outcome.lockedUntil });
  if (outcome.locked) {
    await store.audit({ actor: null, actorRole: "system", action: "kid.lockout", target: kid.id, householdId: kid.householdId, detail: { minutes: 1 } });
    // TODO(Day 3, stream D): raise an info flag to the parent ("Jordan had a few tries at their code").
    return fail(423, "locked", { retryAfterSec: retryAfter(outcome.lockedUntil, now) });
  }
  return fail(401, "wrong", { triesLeft: outcome.triesLeft });
}
