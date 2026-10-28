// Do something together (docs/prd/GUARDIAN.md §2.6), for the grown-up.
//   GET:   the family's latest run (cached), how many refreshes are left today, and the prefs it was made with.
//   POST:  "Ask Muse again": the Scout (Muse Spark with web search; told only the home area, radius, interests and
//          dates) then the Planner (Muse Spark, no web; fits the sourced results to the family's week and the weather).
//          Up to 3 a day per family; a run that fails keeps the last one. Takes about a minute.
//   PATCH: add an idea to the family's plan, or take it out.
import { z } from "zod";
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { takeToken } from "@/lib/auth/lockout";
import { pinLockedResponse } from "@/lib/auth/pin";
import { hasMetaApiKey } from "@/lib/meta/client";
import { refreshesLeft } from "@/lib/outings/outings";
import { OutingError, makeOutingRun } from "@/lib/outings/run";

export const maxDuration = 180;

const patchBody = z.strictObject({ id: z.string().min(3).max(100), planned: z.boolean() });

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const [run, prefs, kids] = await Promise.all([store.outings.latest(parent.householdId), store.homeWatch.prefs(parent.householdId), store.kids(parent.householdId)]);
    return ok({
      run,
      left: refreshesLeft(run?.refreshes ?? [], new Date()),
      live: hasMetaApiKey(),
      prefs: { homeArea: prefs.homeArea, radiusKm: prefs.radiusKm, interests: prefs.interests },
      kids: kids.filter((k) => k.role === "child").map((k) => ({ id: k.id, nickname: k.nickname })),
    });
  });
}

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const hh = parent.householdId;
    const budget = takeToken("outings", hh, 2);
    if (!budget.ok) return fail(429, "slow-down", { retryAfterSec: budget.retryAfterSec });
    if (!hasMetaApiKey()) return fail(503, "not-configured");
    const now = new Date();
    const last = await store.outings.latest(hh);
    if (refreshesLeft(last?.refreshes ?? [], now) === 0) return fail(429, "slow-down", { note: "That’s three searches today. Tomorrow you get three more." });

    try {
      const made = await makeOutingRun(store, hh, now, request.signal, last);
      await store.audit({ actor: parent.profile.id, actorRole: "parent", action: "outings.refresh", target: hh, householdId: hh, detail: { ideas: made.run.ideas.length, searches: made.run.searches } });
      return ok({ run: made.run, left: refreshesLeft(made.run.refreshes, now) });
    } catch (e) {
      return fail(502, "error", { note: e instanceof OutingError ? e.message : `Muse couldn’t finish: ${(e as Error).message.slice(0, 120)}` });
    }
  });
}

export async function PATCH(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const body = await readBody(request, patchBody);
    if (!body) return fail(400, "invalid");
    const run = await store.outings.latest(parent.householdId);
    if (!run || !run.ideas.some((i) => i.id === body.id)) return fail(404, "not-found");
    const planned = body.planned ? [...new Set([...run.planned, body.id])] : run.planned.filter((id) => id !== body.id);
    await store.outings.save(parent.householdId, { ...run, planned });
    return ok({ planned });
  });
}
