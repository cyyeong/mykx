// Tonight (GUARDIAN §2.5, F12): the evening summary for the grown-up. Facts are collected here from the household's own
// rows (each kid's screen time and learning, unseen flags, and Guardian's afternoon: arrivals, what happened at home,
// the notes and how the grown-up checked them, the weekend plan); Muse Spark (Standard) narrates them in three or four
// sentences and may add nothing. If it can't, the rules' own sentence is returned and labelled. Cached per family: a new
// summary is written only when the facts change, and at most every five minutes.
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { takeToken } from "@/lib/auth/lockout";
import { pinLockedResponse } from "@/lib/auth/pin";
import { sgDate } from "@/lib/domain/time";
import { loadGuardianView } from "@/lib/guardian/load";
import { TONIGHT_PROMPT, fallbackTonight, hasTonight, tonightDigest, tonightFacts, tonightSchema, type TonightInput } from "@/lib/guardian/tonight";
import { sgMidnightIso } from "@/lib/home-watch/device-auth";
import { stretches } from "@/lib/home-watch/rollup";
import { hasMetaApiKey } from "@/lib/meta/client";
import { sparkStructured } from "@/lib/meta/spark";
import { dayName } from "@/lib/outings/outings";
import { logRunsFor } from "@/lib/runs/log";

export const maxDuration = 30;

interface Cached {
  digest: string;
  text: string;
  at: number;
  source: "live" | "fallback";
}
const cache = new Map<string, Cached>();
const MIN_REFRESH_MS = 300_000;
const clock = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(11, 16);
const KIND: Record<string, string> = { hazard: "a hazard", conflict: "a possible conflict", arguing: "arguing", crying: "a child who may have been upset", muse: "something to check" };

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const hh = parent.householdId;
    const budget = takeToken("guardian-tonight", hh, 10);
    if (!budget.ok) return fail(429, "slow-down", { retryAfterSec: budget.retryAfterSec });

    const now = new Date();
    const since = sgMidnightIso(now);
    const today = sgDate(now.toISOString());
    const [kids, events, cameras, statuses, alerts, outing] = await Promise.all([store.kids(hh), store.whereabouts.events(hh, since), store.homeWatch.cameras(hh), store.homeWatch.statuses(hh, since), store.homeWatch.alerts(hh, since), store.outings.latest(hh)]);
    const children = kids.filter((k) => k.role === "child");
    const kidFacts = await Promise.all(
      children.map(async (k) => {
        const v = await loadGuardianView(store, hh, k);
        const day = v.days.find((d) => d.day === today);
        const sessions = v.sessions.filter((s) => sgDate(s.start) === today);
        return {
          nickname: k.nickname,
          screenMin: Math.round(day?.total ?? 0),
          limitMin: v.settings.dailyLimitMin ?? null,
          over: Boolean(day?.overLimit),
          lateMin: Math.round(day?.lateMinutes ?? 0),
          learnMin: Math.round(sessions.reduce((n, s) => n + (Date.parse(s.end) - Date.parse(s.start)) / 60_000, 0)),
          sessions: sessions.length,
          flags: v.flags.filter((f) => !f.seen && f.level !== "info").map((f) => f.title),
        };
      }),
    );
    const roomOf = new Map(cameras.map((c) => [c.id, c.room]));
    const home: TonightInput["home"] =
      events.length || statuses.length || alerts.length
        ? {
            arrivals: [...events].reverse().filter((e) => e.kind === "arrived").map((e) => `${children.find((k) => k.id === e.kidId)?.nickname ?? "A child"} arrived at ${e.placeName} ${clock(e.at)}`),
            stretches: stretches(statuses.map((s) => ({ cameraId: s.cameraId, at: s.at, activity: s.reading.activity, people: s.reading.people.map((p) => p.likely ?? (p.who === "adult" ? "an adult" : "a child")), cue: s.reading.cue })))
              .slice(-6)
              .map((s) => `${s.people.length ? s.people.join(" and ") : "Nobody"}: ${s.activity}, ${clock(s.from)}${s.from === s.to ? "" : `–${clock(s.to)}`} (${roomOf.get(s.cameraId) ?? "home"})`),
            notes: alerts.map((a) => `${a.level === "urgent" ? "Urgent" : "Watch"}: ${KIND[a.kind] ?? a.kind} in the ${roomOf.get(a.cameraId) ?? "home"} at ${clock(a.at)}${a.verdict ? ` (checked: ${a.verdict === "right" ? "right" : "not right"})` : " (not checked yet)"}`),
          }
        : null;
    const input: TonightInput = { kids: kidFacts, home, plans: (outing?.ideas ?? []).filter((i) => outing!.planned.includes(i.id)).map((i) => `${dayName(i.day)} ${i.when}: ${i.title}`) };
    if (!hasTonight(input)) return ok({ tonight: null });

    const digest = tonightDigest(input);
    const hit = cache.get(hh);
    if (hit && (hit.digest === digest || now.getTime() - hit.at < MIN_REFRESH_MS)) return ok({ tonight: { text: hit.text, source: hit.source, at: new Date(hit.at).toISOString(), title: Number(clock(now.toISOString()).slice(0, 2)) >= 17 ? "Tonight" : "Today so far" } });
    let entry: Cached = { digest, text: fallbackTonight(input), at: now.getTime(), source: "fallback" };
    if (hasMetaApiKey()) {
      try {
        logRunsFor("tonight", hh, null);
        const { data } = await sparkStructured({ messages: [{ role: "system", content: TONIGHT_PROMPT }, { role: "user", content: `Facts:\n${tonightFacts(input)}` }], schema: tonightSchema, schemaName: "tonight_summary", reasoningEffort: "low" }, { timeoutMs: 20_000, signal: request.signal });
        entry = { digest, text: data.text.trim(), at: now.getTime(), source: "live" };
      } catch {
        // The rules' sentence stands in, labelled.
      }
    }
    cache.set(hh, entry);
    return ok({ tonight: { text: entry.text, source: entry.source, at: new Date(entry.at).toISOString(), title: Number(clock(now.toISOString()).slice(0, 2)) >= 17 ? "Tonight" : "Today so far" } });
  });
}
