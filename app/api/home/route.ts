// Home now, for the grown-up (GUARDIAN §2.2): each camera's latest room status, today's statuses for the timeline,
// today's alerts with short-lived links to their frames (gone after 24 h), and whether the cameras are on. Words are
// the Home Reader's (Muse Spark); alerts are the rules'. Behind the parent PIN.
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { sgMidnightIso } from "@/lib/home-watch/device-auth";
import { camerasOn } from "@/lib/home-watch/home-watch";

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const hh = parent.householdId;
    const now = new Date();
    const since = sgMidnightIso(now);
    const [prefs, cameras, statuses, alerts, devices] = await Promise.all([store.homeWatch.prefs(hh), store.homeWatch.cameras(hh), store.homeWatch.statuses(hh, since), store.homeWatch.alerts(hh, since), store.homeWatch.devices(hh)]);
    const withFrames = await Promise.all(alerts.map(async (a) => ({ ...a, frames: a.framesExpireAt && Date.parse(a.framesExpireAt) > now.getTime() ? await store.homeWatch.alertFrameUrls(hh, a.framePaths) : [] })));
    const live = cameras.filter((c) => c.enabled);
    return ok({
      camerasOn: camerasOn(prefs, now),
      pausedUntil: prefs.camsPausedUntil,
      schedule: { days: prefs.camDays, from: prefs.camFrom, to: prefs.camTo },
      devices: devices.filter((d) => !d.revokedAt).map((d) => ({ id: d.id, name: d.name, kind: d.kind, paired: d.paired, lastSeenAt: d.lastSeenAt })),
      rooms: live.map((c) => ({ camera: c, latest: statuses.find((s) => s.cameraId === c.id) ?? null, offline: !c.lastFrameAt || now.getTime() - Date.parse(c.lastFrameAt) > 10 * 60_000 })),
      today: statuses.map((s) => ({ cameraId: s.cameraId, at: s.at, activity: s.reading.activity, people: s.reading.people.map((p) => p.likely ?? p.who), cue: s.reading.cue })),
      alerts: withFrames,
    });
  });
}
