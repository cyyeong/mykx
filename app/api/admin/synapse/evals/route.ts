// Run Kix Synapse's evals now (the nightly run does the same at 03:30 SGT). Admins only.
import { withAuth } from "@/lib/auth/context";
import { ok } from "@/lib/auth/http";
import { runEvals } from "@/lib/synapse/evals";
import { logRunsFor } from "@/lib/runs/log";
import { synapseAdmin } from "@/lib/synapse/guard";
import { liveDeps } from "@/lib/synapse/review";
import { loadSettings } from "@/lib/synapse/server";

export const maxDuration = 300;

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const gate = await synapseAdmin(store, jar);
    if (gate.refused) return gate.refused;
    logRunsFor("synapse-judge", null, null);
    const run = await runEvals(store, liveDeps(store, await loadSettings(store), []), "manual", { limit: 30 });
    await store.audit({ actor: gate.adminId, actorRole: "admin", action: "synapse.evals", target: run.id, householdId: gate.householdId, detail: { passed: run.passed, total: run.total } });
    return ok({ run });
  });
}
