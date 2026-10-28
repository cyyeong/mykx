// Home Link (or the simulator) swaps the parent's one-time pairing code for its device token. The token is returned
// once and only its SHA-256 is kept. Rate-limited per address: a code has 8 characters and lives 15 minutes.
import { withAuth } from "@/lib/auth/context";
import { clientIp, fail, ok, readBody } from "@/lib/auth/http";
import { takeToken } from "@/lib/auth/lockout";
import { newDeviceToken, normalizePairCode, sha256Hex } from "@/lib/home-watch/home-watch";
import { pairBody } from "@/lib/home-watch/schemas";

export async function POST(request: Request) {
  return withAuth(request, async ({ store }) => {
    const budget = takeToken("home-pair", clientIp(request), 10);
    if (!budget.ok) return fail(429, "slow-down", { retryAfterSec: budget.retryAfterSec });
    const body = await readBody(request, pairBody);
    if (!body) return fail(400, "invalid");
    const token = newDeviceToken();
    const device = await store.homeWatch.claimDevice(sha256Hex(normalizePairCode(body.code)), sha256Hex(token), new Date().toISOString());
    if (!device) return fail(401, "wrong");
    await store.audit({ actor: null, actorRole: "system", action: "home.paired", target: device.id, householdId: device.householdId, detail: { kind: device.kind } });
    return ok({ token, device: { id: device.id, name: device.name, kind: device.kind } });
  });
}
