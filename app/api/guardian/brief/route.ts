// "Right now" (GUARDIAN §2.5): the Guardian Brief for the grown-up's map and Home now. Facts are collected here from the
// household's own rows (place names, motion, room readings, unchecked alerts); Muse Spark (Standard) writes one or two
// sentences from them; if it can't, the rules' own sentence is returned and labelled. Cached per family: a new brief
// is written only when the facts change, and at most every two minutes. Raw coordinates never reach the model. The
// prompt is the Brief's published instructions (editable in Under the hood) with fixed guardrails (lib/agents).
import { instructionsFor } from "@/lib/agents/runtime";
import { currentParent, withAuth } from "@/lib/auth/context";
import type { AuthStore } from "@/lib/auth/store";
import { fail, ok } from "@/lib/auth/http";
import { takeToken } from "@/lib/auth/lockout";
import { pinLockedResponse } from "@/lib/auth/pin";
import { briefDigest, briefFacts, briefSchema, fallbackBrief, hasAnything, type BriefInput } from "@/lib/home-watch/brief";
import { camerasOn } from "@/lib/home-watch/home-watch";
import { placeAt, sharingNow } from "@/lib/location/location";
import { hasMetaApiKey } from "@/lib/meta/client";
import { sparkStructured } from "@/lib/meta/spark";
import { logRunsFor } from "@/lib/runs/log";

export const maxDuration = 30;

interface Cached {
  digest: string;
  text: string;
  at: number;
  source: "live" | "fallback";
}
const cache = new Map<string, Cached>();
const MIN_REFRESH_MS = 120_000;
const MAX_KEEP_MS = 30 * 60_000;

/** Each room's newest reading; a kid is only in the room with their newest reading, so a room whose only people have since been seen elsewhere is left out. */
function roomsNow(cameras: Awaited<ReturnType<AuthStore["homeWatch"]["cameras"]>>, statuses: Awaited<ReturnType<AuthStore["homeWatch"]["statuses"]>>, now: number): BriefInput["rooms"] {
  const latest = cameras.filter((c) => c.enabled).flatMap((c) => {
    const st = statuses.find((x) => x.cameraId === c.id);
    return st ? [{ c, st }] : [];
  });
  const newest = new Map<string, string>();
  for (const { st } of latest) for (const p of st.reading.people) if (p.likely && (newest.get(p.likely) ?? "") < st.at) newest.set(p.likely, st.at);
  return latest.flatMap(({ c, st }) => {
    const people = st.reading.people.filter((p) => !p.likely || newest.get(p.likely) === st.at);
    if (st.reading.people.length && !people.length) return [];
    return [{ room: c.room, who: people.map((p) => p.likely ?? (p.who === "child" ? "a child" : p.who === "adult" ? "an adult" : "someone")), activity: st.reading.activity, cue: st.reading.cue, concern: st.reading.concern, minutesAgo: Math.round(minutesSince(st.at, now)) }];
  });
}

const minutesSince = (iso: string, now: number) => Math.max(0, (now - Date.parse(iso)) / 60_000);
const clock = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(11, 16);

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const hh = parent.householdId;
    const budget = takeToken("guardian-brief", hh, 12);
    if (!budget.ok) return fail(429, "slow-down", { retryAfterSec: budget.retryAfterSec });

    const now = Date.now();
    const midnight = new Date(now - 2 * 3_600_000).toISOString();
    const [kids, settings, latest, places, events, prefs, cameras, statuses, alerts] = await Promise.all([
      store.kids(hh),
      store.whereabouts.settings(hh),
      store.whereabouts.latest(hh),
      store.whereabouts.places(hh),
      store.whereabouts.events(hh, new Date(now - 12 * 3_600_000).toISOString()),
      store.homeWatch.prefs(hh),
      store.homeWatch.cameras(hh),
      store.homeWatch.statuses(hh, new Date(now - 60 * 60_000).toISOString()),
      store.homeWatch.alerts(hh, midnight),
    ]);
    const on = camerasOn(prefs, new Date(now));
    const input: BriefInput = {
      camerasOn: on,
      kids: kids
        .filter((k) => k.role === "child")
        .map((k) => {
          const s = settings.find((x) => x.kidId === k.id);
          const p = latest.find((x) => x.kidId === k.id);
          const e = events.find((x) => x.kidId === k.id);
          const paused = Boolean(s?.pausedUntil && Date.parse(s.pausedUntil) > now);
          return {
            nickname: k.nickname,
            sharing: !s?.enabled || !sharingNow(s.mode, new Date(now)) ? ("off" as const) : paused ? ("paused" as const) : ("on" as const),
            place: p ? (placeAt(p, places)?.name ?? null) : null,
            motion: p?.motion ?? null,
            minutesAgo: p ? Math.round(minutesSince(p.at, now)) : null,
            lastEvent: e ? `${e.kind} ${e.kind === "arrived" ? "at" : ""} ${e.placeName} ${clock(e.at)}`.replace("  ", " ") : null,
          };
        }),
      rooms: roomsNow(cameras, statuses, now),
      alerts: alerts
        .filter((a) => !a.verdict)
        .map((a) => ({ level: a.level, kind: a.kind, room: cameras.find((c) => c.id === a.cameraId)?.room ?? "home", minutesAgo: Math.round(minutesSince(a.at, now)) })),
    };
    if (!hasAnything(input)) return ok({ brief: null });

    const digest = briefDigest(input);
    const hit = cache.get(hh);
    const fresh = hit && (hit.digest === digest ? now - hit.at < MAX_KEEP_MS : now - hit.at < MIN_REFRESH_MS);
    if (hit && fresh) return ok({ brief: { text: hit.text, source: hit.source, at: new Date(hit.at).toISOString(), cached: true } });

    let entry: Cached = { digest, text: fallbackBrief(input), at: now, source: "fallback" };
    if (hasMetaApiKey()) {
      try {
        logRunsFor("guardian-brief", hh, null);
        const system = await instructionsFor("guardian-brief", {}, { store });
        const { data } = await sparkStructured(
          { messages: [{ role: "system", content: system }, { role: "user", content: `Facts:\n${briefFacts(input)}` }], schema: briefSchema, schemaName: "guardian_brief", reasoningEffort: "low" },
          { timeoutMs: 15_000, signal: request.signal },
        );
        entry = { digest, text: data.text.trim(), at: now, source: "live" };
      } catch {
        // The rules' sentence stands in, labelled; the page tries again at the next change.
      }
    }
    cache.set(hh, entry);
    return ok({ brief: { text: entry.text, source: entry.source, at: new Date(entry.at).toISOString(), cached: false } });
  });
}
