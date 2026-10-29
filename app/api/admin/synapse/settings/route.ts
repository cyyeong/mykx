// Kix Synapse's settings: the threshold, scoring changes, caps, the model for each job and the budgets. Admins only.
import { withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { SynapseTablesMissingError } from "@/lib/auth/store";
import { synapseAdmin } from "@/lib/synapse/guard";
import { loadSettings } from "@/lib/synapse/server";
import { settingsPatch } from "@/lib/synapse/settings";

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const gate = await synapseAdmin(store, jar);
    if (gate.refused) return gate.refused;
    const patch = await readBody(request, settingsPatch);
    if (!patch) return fail(400, "invalid");
    const cur = await loadSettings(store);
    const next = { ...cur, ...patch, models: { ...cur.models, ...(patch.models ?? {}) }, updatedAt: new Date().toISOString(), updatedBy: gate.adminId };
    try {
      await store.synapse.saveSettings(next);
    } catch (e) {
      if (e instanceof SynapseTablesMissingError) return fail(503, "not-configured", { note: "Run supabase/migrations/20261030_synapse.sql first." });
      throw e;
    }
    await store.audit({ actor: gate.adminId, actorRole: "admin", action: "synapse.settings", target: null, householdId: gate.householdId, detail: { fields: Object.keys(patch) } });
    return ok({ settings: next });
  });
}
