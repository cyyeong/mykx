// A kid's location sharing, set by the grown-up: on or off, and how often (GUARDIAN §2.1). Audited.
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { kidSettingsBody } from "@/lib/location/schemas";

export async function PATCH(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const body = await readBody(request, kidSettingsBody);
    if (!body) return fail(400, "invalid");
    if (!(await store.kid(parent.householdId, body.kidId))) return fail(404, "not-found");
    const patch = { ...(body.enabled !== undefined ? { enabled: body.enabled } : {}), ...(body.mode ? { mode: body.mode } : {}), ...(body.enabled === false ? { pausedUntil: null } : {}) };
    const setting = await store.whereabouts.saveSettings(parent.householdId, body.kidId, patch);
    await store.audit({ actor: parent.profile.id, actorRole: "parent", action: "location.settings", target: body.kidId, householdId: parent.householdId, detail: { enabled: setting.enabled, mode: setting.mode } });
    return ok({ setting });
  });
}
