// Admin → Skills, the catalogue (founder, 29 Oct): every pack as Kix reads it now (its published version, else the
// built-in default on disk; imported packs too), with each pack's versions, and the live agent trace. Admins only,
// behind the parent PIN. Never a child's words, answers, Notebook or id (rule 13).
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { packCards, publicRun } from "@/lib/admin/hood";
import { hasMetaApiKey } from "@/lib/meta/client";
import { refreshSkillOverrides } from "@/lib/skills/overrides";
import { draftOf, publishedOf } from "@/lib/skills/versions";

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    if (!(await requireAdmin(store, jar))) return fail(403, "not-allowed");
    await refreshSkillOverrides(store, { force: true });
    const [rows, runs, updates] = await Promise.all([store.skillVersions.list().catch(() => []), store.runs.recent(60).catch(() => []), store.knowledge.updates().catch(() => [])]);
    const packs = packCards().map((p) => {
      const mine = rows.filter((r) => r.packId === p.id);
      const pub = publishedOf(mine, p.id);
      const draft = draftOf(mine, p.id);
      return { ...p, publishedVersion: pub?.version ?? null, draftVersion: draft?.version ?? null, versions: mine.filter((r) => !r.deletedAt).length };
    });
    return ok({
      live: hasMetaApiKey(),
      packs,
      updates: updates.map((u) => ({ pack: u.pack, version: u.version, publishedAt: u.publishedAt })),
      runs: runs.slice(0, 40).map(publicRun),
    });
  });
}
