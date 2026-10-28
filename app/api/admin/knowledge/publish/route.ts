// Publishing knowledge refines the skill (SKILL_ENGINE.md §6.4; founder, 29 Oct): a new skill version of the target
// pack (lib/knowledge/refine.ts) with the approved patterns in its manifest, the traps and marking cues in
// references/exam-patterns.md, any new topic in its scope, and new items (our own or licensed material's approved
// questions, and Kix's own questions; never a school paper's, rule 10). Refused while a mismatch between a key and
// Muse is unresolved, or when the result fails the pack schemas or the safety scanner. `draft: true` saves it as the
// pack's draft instead, for the editor. A skill_updates row keeps the published history readable and feeds Ask Kix's
// "latest exam patterns". Until the skill_versions migration is applied, publishing writes the skill_updates row only,
// as before. Admins only, behind the parent PIN, audited.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { SkillTablesMissingError } from "@/lib/auth/store";
import { buildUpdate, nextVersion, type KnowledgeUpload } from "@/lib/knowledge/knowledge";
import { packsOnDisk } from "@/lib/knowledge/packs";
import { refinePack } from "@/lib/knowledge/refine";
import { entriesOf, publishBlockers, routeOf } from "@/lib/knowledge/session";
import { refreshSkillOverrides } from "@/lib/skills/overrides";
import { createVersion, currentFiles, packVersions } from "@/lib/skills/service";
import { nextPackVersion, semverCmp } from "@/lib/skills/versions";

const publishBody = z.strictObject({
  pack: z.string().regex(/^(p[1-6]|s[1-4])-[a-z0-9-]{2,34}$/),
  sessionId: z.guid().nullable().optional(),
  draft: z.boolean().optional(),
});

/** The uploads as the admin left them (edits applied, routed to `pack`), in the shape the history row is built from. */
const asEdited = (u: KnowledgeUpload, pack: string): KnowledgeUpload => (u.extraction ? { ...u, pack, extraction: { ...u.extraction, ...entriesOf(u) } } : u);

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const body = await readBody(request, publishBody);
    if (!body) return fail(400, "invalid");
    await refreshSkillOverrides(store);
    const packIds = packsOnDisk().map((p) => p.id);
    const session = body.sessionId ? await store.knowledge.session(body.sessionId) : null;
    if (body.sessionId && !session) return fail(404, "not-found");
    const all = await store.knowledge.uploads();
    const mine = all.filter((u) => u.status === "ready" && !u.publishedIn && u.extraction && (session ? u.sessionId === session.id : !u.sessionId) && (routeOf(u, packIds)?.pack ?? u.pack) === body.pack);
    const kix = session?.kixItems[body.pack] ?? [];
    const blockers = publishBlockers(mine, kix);
    if (blockers.length) {
      const nothing = blockers.length === 1 && blockers[0].startsWith("Approve");
      return Response.json({ ok: false, reason: nothing ? "nothing-approved" : "not-allowed", note: nothing ? blockers[0] : "Publishing is blocked until these are resolved.", blockers }, { status: 409 });
    }

    const at = new Date().toISOString();
    const [pv, previous, current] = await Promise.all([packVersions(store, body.pack), store.knowledge.updates(body.pack), currentFiles(store, body.pack)]);
    // One number for the skill version and its history row, past both earlier rows and the old update history.
    const a = nextPackVersion(pv.defaultVersion, pv.rows);
    const b = nextVersion(current?.version ?? pv.defaultVersion, previous);
    const version = semverCmp(a, b) >= 0 ? a : b;
    const refined = refinePack({ packId: body.pack, base: current?.files ?? null, version, uploads: mine, kixItems: kix, by: admin.profile.id, atIso: at });
    if (!Object.keys(refined.files).length) return Response.json({ ok: false, reason: "invalid", note: refined.problems[0] ?? "Couldn't build the pack.", problems: refined.problems.map((message) => ({ path: "", message })) }, { status: 422 });

    const summary = `Knowledge: ${mine.length} ${mine.length === 1 ? "paper" : "papers"}, +${refined.added.archetypes} patterns, +${refined.added.traps} traps, +${refined.added.cues} cues, +${refined.added.items + refined.added.kix} questions`;
    const made = await createVersion(store, { packId: body.pack, files: refined.files, status: body.draft ? "draft" : "published", source: "knowledge", note: summary.slice(0, 300), by: admin.profile.id, version, now: at });
    let versionId: string | null = null;
    if (!made.ok) {
      // Before the migration, publishing keeps the old behaviour: the history row only (Ask Kix reads it).
      const legacy = made.status === 503 && !body.draft;
      if (!legacy) return Response.json({ ok: false, reason: made.reason, note: made.note, problems: made.problems?.slice(0, 60) }, { status: made.status });
    } else versionId = made.value.id;

    if (!body.draft) {
      const update = buildUpdate(body.pack, mine.map((u) => asEdited(u, body.pack)), version, admin.profile.id, at, randomUUID());
      if (update) {
        update.items.push(
          ...kix
            .filter((k) => k.mark === "approved")
            .map((k) => ({ topic: k.topic, type: k.type === "mcq" ? ("mcq" as const) : ("short-answer" as const), stem: k.stem, options: k.options, answer: k.answer, marks: k.marks, difficulty: k.difficulty })),
        );
        await store.knowledge.saveUpdate(update);
      }
      await store.knowledge.markPublished(
        mine.map((u) => u.id),
        version,
      );
    }
    if (session) {
      try {
        // Published questions leave the session (they are in the pack now), so a second publish never adds them twice.
        const kixItems = body.draft ? session.kixItems : { ...session.kixItems, [body.pack]: kix.filter((k) => k.mark !== "approved") };
        await store.knowledge.saveSession({ ...session, kixItems, published: [...session.published, { pack: body.pack, version, versionId, status: body.draft ? "draft" : "published", at }] });
      } catch (e) {
        if (!(e instanceof SkillTablesMissingError)) throw e;
      }
    }
    await store.audit({ actor: admin.profile.id, actorRole: "admin", action: body.draft ? "knowledge.draft" : "knowledge.publish", target: versionId, householdId: admin.householdId, detail: { pack: body.pack, version, archetypes: refined.added.archetypes, items: refined.added.items, kix: refined.added.kix, topics: refined.added.topics.length } });
    return ok({ update: { pack: body.pack, version, versionId, status: body.draft ? "draft" : "published" }, added: refined.added, warnings: refined.problems });
  });
}
