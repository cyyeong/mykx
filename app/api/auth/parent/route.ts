// Grown-up sign-in (parents and admins): email + password through Supabase Auth, or the demo cookie in
// dev. Returns where to land; never echoes the email or password.
import { withAuth } from "@/lib/auth/context";
import { nowIso } from "@/lib/auth/flows";
import { clientIp, fail, ok, readBody } from "@/lib/auth/http";
import { KID_COOKIE } from "@/lib/auth/kid-session";
import { lockRemainingSec, retryAfter, takeToken } from "@/lib/auth/lockout";
import { parentSignInBody } from "@/lib/auth/schemas";

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const limited = takeToken("parent-signin", clientIp(request), 10);
    if (!limited.ok) return fail(429, "slow-down", { retryAfterSec: limited.retryAfterSec });
    const body = await readBody(request, parentSignInBody);
    if (!body) return fail(400, "invalid");

    const user = await store.signInParent(jar, body.email, body.password);
    if (!user) return fail(401, "wrong");
    const profile = await store.profileByUserId(user.userId);
    if (!profile || profile.role !== "parent" || profile.disabledAt || lockRemainingSec(profile.lockedUntil) > 0) {
      await store.signOutParent(jar, false);
      if (!profile || profile.role !== "parent") return fail(403, "no-account");
      if (profile.disabledAt) return fail(403, "disabled");
      return fail(423, "locked", { retryAfterSec: retryAfter(profile.lockedUntil) });
    }

    jar.delete(KID_COOKIE); // a new grown-up on this device: no kid carries over
    await store.update(profile.householdId, profile.id, { lastSignInAt: nowIso() });
    const role = profile.isAdmin ? "admin" : "parent";
    return ok({ role, next: role === "admin" ? "/admin/skills" : "/parent" });
  });
}
