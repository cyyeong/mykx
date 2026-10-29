// The retrain dataset (docs/prd/SYNAPSE.md §8): de-identified JSONL from families who turned on "Help Kix learn".
// Admins only; the download is in audit_log.
import { withAuth } from "@/lib/auth/context";
import { datasetJsonl } from "@/lib/synapse/admin";
import { synapseAdmin } from "@/lib/synapse/guard";

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const gate = await synapseAdmin(store, jar);
    if (gate.refused) return gate.refused;
    const text = await datasetJsonl(store);
    await store.audit({ actor: gate.adminId, actorRole: "admin", action: "synapse.dataset", target: null, householdId: gate.householdId, detail: { lines: text ? text.trim().split("\n").length : 0 } });
    return new Response(text, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "content-disposition": `attachment; filename="mykx-synapse-${new Date().toISOString().slice(0, 10)}.jsonl"`, "cache-control": "no-store" } });
  });
}
