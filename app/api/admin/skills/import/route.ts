// Import a standard agent skill (founder, 29 Oct; board SkillImport): a .zip or .skill (a zip) up to 5 MB, read in
// memory and never stored as uploaded. Admins only, behind the parent PIN, audited.
//   step=inspect: what is kept and what is dropped (scripts above all: never kept or run, rule 10), the safety
//                 scanner's findings, and the manifest: the archive's own myKx skill.json, else Muse Spark's proposal
//                 (Standard, structured; logged as "skill-editor"), for the admin to edit.
//   step=import:  the same file again with the admin's fields: the pack is built, checked (schemas and the safety
//                 scanner: refused while it names a child or a private phrase) and saved as a draft version.
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { hasMetaApiKey } from "@/lib/meta/client";
import { sparkStructured } from "@/lib/meta/spark";
import { logRunsFor } from "@/lib/runs/log";
import { buildImportedPack, fallbackProposal, fieldsFrom, importFieldsSchema, manifestPrompt, manifestProposalSchema, MAX_ZIP_BYTES, readSkillArchive, type ManifestProposal, type SkillArchive } from "@/lib/skills/import";
import { allPackIds, hasDiskPack, refreshSkillOverrides } from "@/lib/skills/overrides";
import { createVersion, outcomeResponse, packVersions } from "@/lib/skills/service";
import { SkillManifestSchema } from "@/lib/skills/schema";
import { checkPack, nextPackVersion, safetyProblems } from "@/lib/skills/versions";

export const maxDuration = 120;

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const step = form?.get("step");
    if (!(file instanceof File) || (step !== "inspect" && step !== "import")) return fail(400, "invalid");
    if (file.size > MAX_ZIP_BYTES) return fail(413, "too-large", { note: "The limit is 5 MB." });
    let archive: SkillArchive;
    try {
      archive = readSkillArchive(new Uint8Array(await file.arrayBuffer()));
    } catch (e) {
      return fail(400, "invalid", { note: (e as Error).message });
    }
    await refreshSkillOverrides(store);
    const taken = allPackIds();
    // The safety scanner over everything kept: a pack never names a child, a school or an exam paper (rule 10).
    const safety = safetyProblems(archive.files);
    const summary = { name: archive.name, description: archive.description, kept: archive.kept, dropped: archive.dropped };

    if (step === "inspect") {
      let proposal: ManifestProposal | null = null;
      let proposedBy: "skill.json" | "muse" | "guess" = SkillManifestSchema.safeParse(archive.manifest).success ? "skill.json" : "guess";
      if (proposedBy !== "skill.json" && hasMetaApiKey()) {
        logRunsFor("skill-editor", admin.householdId);
        try {
          const p = manifestPrompt(archive);
          const { data } = await sparkStructured(
            { messages: [{ role: "system", content: p.system }, { role: "user", content: p.user }], schema: manifestProposalSchema, schemaName: "skill_manifest_proposal", reasoningEffort: "low" },
            { timeoutMs: 60_000, signal: request.signal },
          );
          proposal = data;
          proposedBy = "muse";
        } catch {
          proposal = null;
        }
      }
      const fields = fieldsFrom(archive, proposal ?? fallbackProposal(archive), taken);
      await store.audit({ actor: admin.profile.id, actorRole: "admin", action: "skills.import-inspect", target: null, householdId: admin.householdId, detail: { pack: fields.id, kept: archive.kept.length, dropped: archive.dropped.length, scripts: archive.dropped.filter((d) => d.script).length, safety: safety.length } });
      return ok({ archive: summary, fields, proposedBy, safety, taken });
    }

    let raw: unknown = null;
    try {
      raw = JSON.parse(String(form?.get("fields") ?? "null"));
    } catch {
      raw = null;
    }
    const parsed = importFieldsSchema.safeParse(raw);
    if (!parsed.success) return fail(400, "invalid", { note: `Check the fields: ${parsed.error.issues[0]?.path.join(".")} ${parsed.error.issues[0]?.message}`.slice(0, 200) });
    const f = parsed.data;
    if (safety.length) return Response.json({ ok: false, reason: "invalid", note: "Import refused: the skill names a child or a private place, school or paper. Fix it and import again.", problems: safety.slice(0, 60) }, { status: 422 });
    const pv = await packVersions(store, f.id);
    const exists = hasDiskPack(f.id) || pv.rows.some((r) => !r.deletedAt);
    const version = nextPackVersion(pv.defaultVersion, pv.rows);
    const now = new Date().toISOString();
    const built = buildImportedPack(archive, f, version, file.name, now);
    const problems = checkPack(built.files, f.id).problems;
    if (problems.length) return Response.json({ ok: false, reason: "invalid", note: "Fix these fields first.", problems: problems.slice(0, 60) }, { status: 422 });
    const r = await createVersion(store, { packId: f.id, files: built.files, status: "draft", source: "import", note: `Imported ${file.name.slice(0, 80)}${exists ? " over the existing pack" : ""}`, by: admin.profile.id, version });
    if (r.ok) await store.audit({ actor: admin.profile.id, actorRole: "admin", action: "skills.import", target: r.value.id, householdId: admin.householdId, detail: { pack: f.id, version: r.value.version, kept: archive.kept.length, dropped: archive.dropped.length, newPack: !exists } });
    return outcomeResponse(r, (v) => ({ id: v.id, version: v.version, pack: v.packId, skippedItems: built.skippedItems.slice(0, 30) }));
  });
}
