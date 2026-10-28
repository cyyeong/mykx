// Enhance with Muse (founder, 29 Oct; the Skill Editor agent). The admin says what to improve; Muse Spark 1.3
// (Standard) proposes whole-file changes to SKILL.md and references/*.md and new questions (drafts), and a separate
// call works each new question out again (lib/skills/enhance.ts). Nothing is saved: the editor shows the proposal as a
// diff and the admin accepts it into the draft. Admins only, behind the parent PIN, audited; runs are logged as
// "skill-editor". No child's data is ever in a skill pack, so none reaches the model.
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { hasMetaApiKey } from "@/lib/meta/client";
import { logRunsFor } from "@/lib/runs/log";
import { enhancePack } from "@/lib/skills/enhance";
import { readLargeJson, packVersions, versionFiles } from "@/lib/skills/service";
import { applyChanges, isPackPath, MAX_FILE_CHARS, nextPackVersion, PACK_ID } from "@/lib/skills/versions";

export const maxDuration = 300;
type Ctx = { params: Promise<{ pack: string }> };

const body = z.strictObject({
  ask: z.string().trim().min(8).max(1200),
  base: z.union([z.literal("default"), z.guid()]),
  /** The editor's unsaved changes, so Muse improves what the admin sees. */
  changes: z.record(z.string().max(100).refine(isPackPath, "not a pack file"), z.string().max(MAX_FILE_CHARS).nullable()).optional(),
});

export async function POST(request: Request, { params }: Ctx) {
  const { pack } = await params;
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    if (!PACK_ID.test(pack)) return fail(404, "not-found");
    const parsed = body.safeParse(await readLargeJson(request));
    if (!parsed.success) return fail(400, "invalid", { note: "Say what to improve in a sentence or two." });
    if (!hasMetaApiKey()) return fail(503, "not-configured", { note: "The Meta model key isn't set on this server, so Muse can't propose changes." });
    const base = await versionFiles(store, pack, parsed.data.base);
    if (!base) return fail(404, "not-found");
    const files = applyChanges(base, parsed.data.changes ?? {});
    if (!files["skill.json"]) return fail(400, "invalid", { note: "The pack needs its skill.json first." });
    const pv = await packVersions(store, pack);
    const version = pv.draft?.version ?? nextPackVersion(pv.defaultVersion, pv.rows);
    logRunsFor("skill-editor", admin.householdId);
    try {
      const proposal = await enhancePack({ packId: pack, files, ask: parsed.data.ask, version, signal: request.signal });
      await store.audit({ actor: admin.profile.id, actorRole: "admin", action: "skills.enhance", target: null, householdId: admin.householdId, detail: { pack, files: proposal.changes.length, items: proposal.items.length, flagged: proposal.checks.filter((c) => c.status !== "ok").length } });
      return ok({ proposal, version });
    } catch (e) {
      return fail(502, "error", { note: `Muse couldn't propose changes this time: ${(e as Error).message.slice(0, 160)}` });
    }
  });
}
