// The grown-up's check on a Home watch alert: "right", "not-right", or back to none. Each "not right" in the last
// two weeks makes that camera's rule for that kind of alert need one more matching check (lib/home-watch/flags.ts).
import { z } from "zod";
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";

const verdictBody = z.strictObject({ id: z.guid(), verdict: z.enum(["right", "not-right"]).nullable() });

export async function PATCH(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const body = await readBody(request, verdictBody);
    if (!body) return fail(400, "invalid");
    const alert = await store.homeWatch.setAlertVerdict(parent.householdId, body.id, body.verdict);
    if (!alert) return fail(404, "not-found");
    await store.audit({ actor: parent.profile.id, actorRole: "parent", action: "home.alert-verdict", target: alert.id, householdId: parent.householdId, detail: { verdict: body.verdict, kind: alert.kind } });
    return ok({ alert });
  });
}
