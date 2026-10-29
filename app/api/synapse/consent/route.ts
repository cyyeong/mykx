// "Help Kix learn" (docs/prd/SYNAPSE.md §8): a grown-up's choice whether their family's fixed reports, already
// de-identified, may join Kix Synapse's retrain dataset. Off by default; turning it off drops the family from the next
// export. Grown-ups only.
import { z } from "zod";
import { currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { SynapseTablesMissingError } from "@/lib/auth/store";

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    return ok({ on: await store.synapse.consent(parent.householdId).catch(() => false) });
  });
}

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const body = await readBody(request, z.strictObject({ on: z.boolean() }));
    if (!body) return fail(400, "invalid");
    try {
      await store.synapse.setConsent(parent.householdId, body.on);
    } catch (e) {
      if (e instanceof SynapseTablesMissingError) return fail(503, "not-configured");
      throw e;
    }
    await store.audit({ actor: parent.profile.id, actorRole: "parent", action: "synapse.consent", target: parent.householdId, householdId: parent.householdId, detail: { on: body.on } });
    return ok({ on: body.on });
  });
}
