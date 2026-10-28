// A teen pauses their own location sharing for 30 minutes (founder, 28 Oct; AGENTS.md rule 15). Juniors can't. The
// grown-up sees "paused until" straight away on the map; it's audited, and sharing starts again by itself.
import { withAuth } from "@/lib/auth/context";
import { requireFamily } from "@/lib/auth/guard";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pauseBody } from "@/lib/location/schemas";

export async function POST(request: Request) {
  return withAuth(request, async ({ store }) => {
    const family = await requireFamily(request, "location-pause", 6);
    if (family.refused) return family.refused;
    const kid = family.kid;
    if (!kid) return fail(401, "no-kid");
    if (kid.band !== "teen") return fail(403, "not-allowed");
    const body = await readBody(request, pauseBody);
    if (!body) return fail(400, "invalid");
    const setting = (await store.whereabouts.settings(family.householdId)).find((s) => s.kidId === kid.id);
    if (!setting?.enabled) return fail(409, "not-allowed");
    const now = Date.now();
    if (setting.pausedUntil && Date.parse(setting.pausedUntil) > now) return ok({ pausedUntil: setting.pausedUntil });
    const saved = await store.whereabouts.saveSettings(family.householdId, kid.id, { pausedUntil: new Date(now + body.minutes * 60_000).toISOString() });
    await store.audit({ actor: kid.id, actorRole: "kid", action: "location.pause", target: kid.id, householdId: family.householdId, detail: { minutes: body.minutes } });
    return ok({ pausedUntil: saved.pausedUntil });
  });
}
