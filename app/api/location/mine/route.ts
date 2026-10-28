// What a kid can see about their own sharing (AGENTS.md rule 15: the child always knows): whether their grown-ups
// share their location and how often, whether they've paused, and whether the home cameras are on right now and which
// rooms they cover. Nothing about where they are or what the cameras saw.
import { withAuth } from "@/lib/auth/context";
import { requireFamily } from "@/lib/auth/guard";
import { fail, ok } from "@/lib/auth/http";
import { camerasOn } from "@/lib/home-watch/home-watch";
import { MODES, sharingNow } from "@/lib/location/location";

export async function GET(request: Request) {
  return withAuth(request, async ({ store }) => {
    const family = await requireFamily(request, "location-mine", 30);
    if (family.refused) return family.refused;
    const kid = family.kid;
    if (!kid) return fail(401, "no-kid");
    const hh = family.householdId;
    const now = new Date();
    const [settings, prefs, devices, cameras] = await Promise.all([store.whereabouts.settings(hh), store.homeWatch.prefs(hh), store.homeWatch.devices(hh), store.homeWatch.cameras(hh)]);
    const mine = settings.find((s) => s.kidId === kid.id);
    const paused = Boolean(mine?.pausedUntil && Date.parse(mine.pausedUntil) > now.getTime());
    const live = devices.filter((d) => !d.revokedAt && d.paired).map((d) => d.id);
    const rooms = cameras.filter((c) => c.enabled && live.includes(c.deviceId)).map((c) => c.room);
    return ok({
      nickname: kid.nickname,
      band: kid.band,
      pack: kid.pack,
      sharing: {
        on: Boolean(mine?.enabled) && sharingNow(mine!.mode, now),
        enabled: Boolean(mine?.enabled),
        paused,
        pausedUntil: paused ? mine!.pausedUntil : null,
        everySec: mine ? MODES[mine.mode].movingSec : null,
        canPause: kid.band === "teen" && Boolean(mine?.enabled),
      },
      cameras: { on: rooms.length > 0 && camerasOn(prefs, now), rooms, from: prefs.camFrom, to: prefs.camTo },
    });
  });
}
