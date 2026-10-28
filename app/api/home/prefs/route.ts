// The family's Guardian preferences (GUARDIAN §2.2, §2.6): home area, radius and interests for outing ideas; camera
// days, hours and pause; and the parent's own short words for each kid. Grown-ups only, behind the PIN, audited.
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { camerasOn } from "@/lib/home-watch/home-watch";
import { prefsBody } from "@/lib/home-watch/schemas";

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const prefs = await store.homeWatch.prefs(parent.householdId);
    return ok({ prefs, camerasOn: camerasOn(prefs, new Date()) });
  });
}

export async function PATCH(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const body = await readBody(request, prefsBody);
    if (!body) return fail(400, "invalid");
    const kids = new Set((await store.kids(parent.householdId)).map((k) => k.id));
    if (body.descriptions && Object.keys(body.descriptions).some((id) => !kids.has(id))) return fail(404, "not-found");
    const old = await store.homeWatch.prefs(parent.householdId);
    const { pauseHours, ...rest } = body;
    const next = {
      ...old,
      ...rest,
      interests: rest.interests ? [...new Set(rest.interests.map((i) => i.toLowerCase()))] : old.interests,
      camDays: rest.camDays ? [...new Set(rest.camDays)].sort() : old.camDays,
      descriptions: rest.descriptions ? { ...old.descriptions, ...rest.descriptions } : old.descriptions,
      camsPausedUntil: pauseHours === undefined ? old.camsPausedUntil : pauseHours ? new Date(Date.now() + pauseHours * 3_600_000).toISOString() : null,
    };
    if (next.camFrom >= next.camTo) return fail(400, "invalid");
    const prefs = await store.homeWatch.savePrefs(parent.householdId, next);
    await store.audit({ actor: parent.profile.id, actorRole: "parent", action: "guardian.prefs", target: parent.householdId, householdId: parent.householdId, detail: { fields: Object.keys(body) } });
    return ok({ prefs, camerasOn: camerasOn(prefs, new Date()) });
  });
}
