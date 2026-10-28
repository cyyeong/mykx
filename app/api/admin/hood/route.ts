// The admin's Skills catalogue and Under the hood (SKILL_ENGINE.md; PRD_REVIEW demo 2:35): skill packs, agents,
// every model call summed per model, and the art manifest. Admins only, behind the parent PIN. Never a child's
// words, answers, Notebook or id: runs say only which agent and whether it was for a child (rule 13).
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { AGENTS, manifestSummary, packCards, publicRun, totalsByModel } from "@/lib/admin/hood";
import { hasMetaApiKey } from "@/lib/meta/client";

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const [runs, updates] = await Promise.all([store.runs.recent(500).catch(() => []), store.knowledge.updates().catch(() => [])]);
    return ok({
      live: hasMetaApiKey(),
      packs: packCards(),
      updates: updates.map((u) => ({ pack: u.pack, version: u.version, publishedAt: u.publishedAt })),
      agents: AGENTS,
      totals: totalsByModel(runs),
      runs: runs.slice(0, 60).map(publicRun),
      manifest: manifestSummary(),
    });
  });
}
