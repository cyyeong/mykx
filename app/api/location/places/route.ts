// The family's places (Home, School…): the parent's own pins, so no map service sees where a kid is.
//   POST: add or edit one. DELETE: remove one (its arrived/left events go with it). Grown-ups only, audited.
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { placeBody, placeDeleteBody } from "@/lib/location/schemas";

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const body = await readBody(request, placeBody);
    if (!body) return fail(400, "invalid");
    if (!body.id && (await store.whereabouts.places(parent.householdId)).length >= 10) return fail(409, "too-many");
    const place = await store.whereabouts.savePlace(parent.householdId, body);
    if (!place) return fail(404, "not-found");
    await store.audit({ actor: parent.profile.id, actorRole: "parent", action: "place.save", target: place.id, householdId: parent.householdId, detail: { kind: place.kind, radiusM: place.radiusM } });
    return ok({ place });
  });
}

export async function DELETE(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const body = await readBody(request, placeDeleteBody);
    if (!body) return fail(400, "invalid");
    if (!(await store.whereabouts.deletePlace(parent.householdId, body.id))) return fail(404, "not-found");
    await store.audit({ actor: parent.profile.id, actorRole: "parent", action: "place.delete", target: body.id, householdId: parent.householdId });
    return ok({});
  });
}
