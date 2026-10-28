// The sign-in page's magic name (founder, 29 Oct): a kid types their magic name and their door comes to them, with no
// grown-up on this device. This only says how to draw the door (nickname, world, band and which secret it asks for)
// and sets a ten-minute door ticket for the next step; it is rate-limited per address, so names can't be guessed
// in bulk, and it never says more about the kid.
import { withAuth } from "@/lib/auth/context";
import { doorCookieOptions, DOOR_COOKIE, signDoorTicket } from "@/lib/auth/door-ticket";
import { clientIp, fail, ok, readBody } from "@/lib/auth/http";
import { takeToken } from "@/lib/auth/lockout";
import { DEFAULT_SECRET_KIND, doorLookupBody, usernameSchema } from "@/lib/auth/schemas";
import { sessionSecret } from "@/lib/auth/tokens";

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const secret = sessionSecret();
    if (!secret) return fail(503, "not-configured");
    const limited = takeToken("door-lookup", clientIp(request), 10);
    if (!limited.ok) return fail(429, "slow-down", { retryAfterSec: limited.retryAfterSec });
    const body = await readBody(request, doorLookupBody);
    if (!body) return fail(400, "invalid");
    const name = usernameSchema.safeParse(body.name);
    const kid = name.success ? await store.kidByUsername(name.data) : null;
    if (!kid || kid.disabledAt) return fail(404, "not-found", { note: "I couldn't find that magic name. Check the spelling, or ask your grown-up." });
    if (!kid.secretHash) return fail(409, "needs-setup", { note: "Your door isn't ready yet. Ask your grown-up to open it the first time on their phone." });
    jar.set(DOOR_COOKIE, signDoorTicket({ kidId: kid.id, householdId: kid.householdId }, secret), doorCookieOptions());
    const band = kid.band ?? "junior";
    return ok({ door: { nickname: kid.nickname, pack: kid.pack ?? "dreamlight", band, secretKind: kid.secretKind ?? DEFAULT_SECRET_KIND[band] } });
  });
}
