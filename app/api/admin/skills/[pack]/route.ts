// One skill pack in the editor (founder, 29 Oct; board SkillEditor). Admins only, behind the parent PIN, audited.
//   GET ?v=<id|default>: the pack's versions (the built-in default first, with a lock), which one Kix reads, the open
//        draft, and one version's files (the draft by default, else the published one).
//   POST { action }: save (the admin's changes as the draft, checked first), publish (a draft), restore (a new
//        published version from an older one or the default), delete (one version, never the default), delete-pack
//        (an imported pack, every version, with the pack's id typed to confirm).
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { refreshSkillOverrides } from "@/lib/skills/overrides";
import { deletePack, deleteVersion, outcomeResponse, packVersions, publishDraft, readLargeJson, restoreVersion, saveDraft, versionFiles } from "@/lib/skills/service";
import { isPackPath, MAX_FILE_CHARS, PACK_ID } from "@/lib/skills/versions";

type Ctx = { params: Promise<{ pack: string }> };

const ref = z.union([z.literal("default"), z.guid()]);
const body = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("save"),
    base: ref,
    changes: z.record(z.string().max(100).refine(isPackPath, "not a pack file"), z.string().max(MAX_FILE_CHARS).nullable()),
    markReviewed: z.array(z.string().max(100)).max(200).optional(),
    note: z.string().trim().max(300).nullable().optional(),
    source: z.enum(["edit", "enhance"]).optional(),
  }),
  z.strictObject({ action: z.literal("publish"), id: z.guid() }),
  z.strictObject({ action: z.literal("restore"), id: ref }),
  z.strictObject({ action: z.literal("delete"), id: z.guid() }),
  z.strictObject({ action: z.literal("delete-pack"), confirm: z.string().max(40) }),
]);

export async function GET(request: Request, { params }: Ctx) {
  const { pack } = await params;
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    if (!(await requireAdmin(store, jar))) return fail(403, "not-allowed");
    if (!PACK_ID.test(pack)) return fail(404, "not-found");
    await refreshSkillOverrides(store);
    const pv = await packVersions(store, pack);
    const live = pv.rows.filter((r) => !r.deletedAt);
    if (!pv.hasDefault && !live.length) return fail(404, "not-found");
    const want = new URL(request.url).searchParams.get("v");
    const selected = want && (want === "default" || live.some((r) => r.id === want)) ? want : (pv.draft?.id ?? pv.published?.id ?? (pv.hasDefault ? "default" : live[0].id));
    const files = await versionFiles(store, pack, selected);
    return ok({
      pack,
      hasDefault: pv.hasDefault,
      defaultVersion: pv.defaultVersion,
      published: pv.published?.id ?? (pv.hasDefault ? "default" : null),
      draft: pv.draft?.id ?? null,
      versions: live,
      selected,
      files: files ?? {},
    });
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const { pack } = await params;
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    if (!PACK_ID.test(pack)) return fail(404, "not-found");
    const parsed = body.safeParse(await readLargeJson(request));
    if (!parsed.success) return fail(400, "invalid", { note: parsed.error.issues[0]?.message?.slice(0, 200) });
    const b = parsed.data;
    const by = admin.profile.id;
    // audit_log.target is a uuid: the version's id (or none), with the pack's id in the detail.
    const audit = (action: string, target: string | null, detail: Record<string, string | number | boolean | null>) => store.audit({ actor: by, actorRole: "admin", action, target, householdId: admin.householdId, detail: { pack, ...detail } });
    switch (b.action) {
      case "save": {
        const r = await saveDraft(store, { packId: pack, base: b.base, changes: b.changes, markReviewedIds: b.markReviewed, note: b.note ?? null, source: b.source ?? "edit", by });
        if (r.ok) await audit("skills.save", r.value.id, { version: r.value.version, files: Object.keys(b.changes).length, source: b.source ?? "edit" });
        return outcomeResponse(r, (v) => ({ id: v.id, version: v.version }));
      }
      case "publish": {
        const r = await publishDraft(store, { packId: pack, id: b.id });
        if (r.ok) await audit("skills.publish", r.value.id, { version: r.value.version });
        return outcomeResponse(r, (v) => ({ id: v.id, version: v.version }));
      }
      case "restore": {
        const r = await restoreVersion(store, { packId: pack, from: b.id, by });
        if (r.ok) await audit("skills.restore", r.value.id, { version: r.value.version, from: b.id });
        return outcomeResponse(r, (v) => ({ id: v.id, version: v.version }));
      }
      case "delete": {
        const r = await deleteVersion(store, { packId: pack, id: b.id });
        if (r.ok) await audit("skills.delete", b.id, {});
        return outcomeResponse(r, (v) => v);
      }
      case "delete-pack": {
        if (b.confirm !== pack) return fail(400, "confirm", { note: "Type the pack's id to confirm." });
        const r = await deletePack(store, { packId: pack });
        if (r.ok) await audit("skills.delete-pack", null, { versions: r.value.deleted });
        return outcomeResponse(r, (v) => v);
      }
    }
  });
}
