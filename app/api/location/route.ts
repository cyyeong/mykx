// Where they are (docs/prd/GUARDIAN.md §2.1).
//   POST: points from a paired device for one kid in its household (the Home simulator now; the phone app is M6).
//         Refused when the parent hasn't turned sharing on; stored as nothing while a teen has paused. Motion and
//         arrived/left are worked out here with the tested rules (lib/location), never by a model.
//   GET:  the grown-up's view: each kid's setting, newest point, today's trail and events, and the family's places.
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { requireDevice, sgMidnightIso } from "@/lib/home-watch/device-auth";
import { MODES, motionOf, placeEvents, sharingNow, type StoredPoint } from "@/lib/location/location";
import { locationPostBody } from "@/lib/location/schemas";

const MAX_AGE_MS = 24 * 3_600_000;
const SKEW_MS = 10 * 60_000;

export async function POST(request: Request) {
  return withAuth(request, async ({ store }) => {
    const auth = await requireDevice(store, request, "location", 60);
    if (auth.refused) return auth.refused;
    const device = auth.device;
    if (device.kind !== "simulator") return fail(403, "not-allowed");
    const body = await readBody(request, locationPostBody);
    if (!body) return fail(400, "invalid");
    const kid = await store.kid(device.householdId, body.kidId);
    if (!kid) return fail(404, "not-found");
    const now = new Date();
    const setting = (await store.whereabouts.settings(device.householdId)).find((s) => s.kidId === kid.id);
    if (!setting?.enabled) return fail(403, "not-allowed");
    const reply = { mode: setting.mode, intervals: MODES[setting.mode], sharing: sharingNow(setting.mode, now) };
    if (setting.pausedUntil && Date.parse(setting.pausedUntil) > now.getTime()) return ok({ stored: 0, pausedUntil: setting.pausedUntil, events: [], ...reply });

    const points = [...body.points].filter((p) => Math.abs(now.getTime() - Date.parse(p.at)) <= MAX_AGE_MS && Date.parse(p.at) <= now.getTime() + SKEW_MS).sort((a, b) => a.at.localeCompare(b.at));
    const recent = await store.whereabouts.track(device.householdId, kid.id, new Date(Date.parse(points[0]?.at ?? now.toISOString()) - 10 * 60_000).toISOString());
    const last = recent.length ? recent[recent.length - 1] : ((await store.whereabouts.latest(device.householdId)).find((p) => p.kidId === kid.id) ?? null);
    const fresh = points.filter((p) => !last || p.at > last.at);
    const history = [...recent];
    const stored: StoredPoint[] = fresh.map((p) => {
      const point: StoredPoint = { ...p, kidId: kid.id, motion: motionOf(p, history), source: "sim" };
      history.push(point);
      return point;
    });
    const added = await store.whereabouts.addPoints(device.householdId, stored);
    const events = placeEvents(kid.id, last, fresh, await store.whereabouts.places(device.householdId));
    if (added) await store.whereabouts.addEvents(device.householdId, events);
    return ok({ stored: added, pausedUntil: null, events: events.map((e) => ({ kind: e.kind, place: e.placeName, at: e.at })), motion: stored.at(-1)?.motion ?? null, ...reply });
  });
}

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const hh = parent.householdId;
    const since = sgMidnightIso(new Date());
    const [kids, settings, latest, events, places] = await Promise.all([store.kids(hh), store.whereabouts.settings(hh), store.whereabouts.latest(hh), store.whereabouts.events(hh, since), store.whereabouts.places(hh)]);
    const tracks = await Promise.all(kids.map((k) => store.whereabouts.track(hh, k.id, since)));
    return ok({
      places,
      kids: kids.map((k, i) => ({
        id: k.id,
        nickname: k.nickname,
        band: k.band,
        pack: k.pack,
        setting: settings.find((s) => s.kidId === k.id) ?? { kidId: k.id, enabled: false, mode: "balanced", pausedUntil: null },
        latest: latest.find((p) => p.kidId === k.id) ?? null,
        today: tracks[i].map(({ at, lat, lng, accuracyM, motion }) => ({ at, lat, lng, accuracyM, motion })),
        events: events.filter((e) => e.kidId === k.id),
      })),
    });
  });
}
