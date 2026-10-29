// Guest sign-in (founder, 29 Oct; lib/guest.ts). On the guest site only: one tap opens the sample family's grown-up
// (also the admin, read-only for guests) or one of its kids, with no password. Anywhere else this route doesn't exist.
// The guest site's store is the in-memory sample family, so nothing here can reach real accounts.
import { z } from "zod";
import { withAuth } from "@/lib/auth/context";
import { DEMO_HOUSEHOLD_ID, DEMO_PARENT_EMAIL } from "@/lib/auth/demo-family";
import { clearGrownUpProof } from "@/lib/auth/pin";
import { clientIp, fail, ok, readBody } from "@/lib/auth/http";
import { KID_COOKIE, kidCookieOptions, signKidSession } from "@/lib/auth/kid-session";
import { DOOR_COOKIE } from "@/lib/auth/door-ticket";
import { takeToken } from "@/lib/auth/lockout";
import { sessionSecret } from "@/lib/auth/tokens";
import { isGuest } from "@/lib/guest";

const body = z.union([
  z.strictObject({ as: z.literal("parent") }),
  z.strictObject({ as: z.literal("kid"), kidId: z.string().min(1).max(64) }),
  z.strictObject({ as: z.literal("kid"), name: z.string().trim().min(1).max(24) }),
]);

export async function POST(request: Request) {
  if (!isGuest()) return fail(404, "not-found");
  return withAuth(request, async ({ store, jar }) => {
    const limited = takeToken("guest-signin", clientIp(request), 30);
    if (!limited.ok) return fail(429, "slow-down", { retryAfterSec: limited.retryAfterSec });
    const input = await readBody(request, body);
    if (!input) return fail(400, "invalid");

    if (input.as === "parent") {
      const user = await store.signInParent(jar, DEMO_PARENT_EMAIL, "guest");
      if (!user) return fail(503, "not-configured");
      jar.delete(KID_COOKIE);
      clearGrownUpProof(jar);
      return ok({ role: "parent", next: "/parent" });
    }

    const secret = sessionSecret();
    if (!secret) return fail(503, "not-configured");
    const kid = "kidId" in input ? await store.kid(DEMO_HOUSEHOLD_ID, input.kidId) : await store.kidByUsername(input.name.toLowerCase());
    if (!kid || kid.householdId !== DEMO_HOUSEHOLD_ID || !kid.secretHash) return fail(404, "not-found");
    jar.delete(DOOR_COOKIE);
    jar.set(KID_COOKIE, signKidSession({ kidId: kid.id, householdId: kid.householdId, soloSecretHash: kid.secretHash }, secret), kidCookieOptions());
    return ok({ kid: { id: kid.id, nickname: kid.nickname, band: kid.band, pack: kid.pack }, next: "/home" });
  });
}
