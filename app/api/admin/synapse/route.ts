// Admin → Kix Synapse: the inbox, the loop's numbers, learned cautions, evals, settings and the retrain dataset's
// counts (lib/synapse/admin.ts). Admins only, behind the PIN. Learners show by level only.
import { withAuth } from "@/lib/auth/context";
import { ok } from "@/lib/auth/http";
import { overview } from "@/lib/synapse/admin";
import { synapseAdmin } from "@/lib/synapse/guard";
import { loadSettings } from "@/lib/synapse/server";

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const gate = await synapseAdmin(store, jar);
    if (gate.refused) return gate.refused;
    return ok(await overview(store, await loadSettings(store)));
  });
}
