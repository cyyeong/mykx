// The knowledge agent's admin routes (SKILL_ENGINE.md §6; founder, 29 Oct: review sessions). Admins only, behind
// the parent PIN, audited.
//   POST:  one PDF (≤ 4 MB, Vercel's body limit) with its rights, into a review session (a new one when none is
//          given). Muse Spark (Standard) reads what it is (question paper, answer sheet, both, notes), its level,
//          subject and tier, its patterns, traps and marking cues, every question's number, marks and answers (and
//          items, for our own or licensed material). If it completes a pair (a question paper and its answer sheet,
//          in either order) or carries its own answers, a separate Muse call cross-checks every answer and its
//          spelling. The browser sends several files one after another. The PDF itself isn't kept (rule 10).
//   GET:   sessions, uploads and each pack's published knowledge.
//   PATCH: the admin's review of one upload: approve or reject entries, change level, subject or tier, pair or
//          unpair, edit, add or remove entries, and settle a check ("key is right", use Muse's answer or the fix).
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { SkillTablesMissingError, type AuthStore } from "@/lib/auth/store";
import { extractionSchema, LEVELS, RIGHTS, SUBJECTS, TIERS, type KnowledgeSession, type KnowledgeUpload, type UploadState } from "@/lib/knowledge/knowledge";
import { packsOnDisk } from "@/lib/knowledge/packs";
import { readPaper } from "@/lib/knowledge/read";
import { papersToCheck, recheck } from "@/lib/knowledge/review";
import { normNo } from "@/lib/knowledge/session";
import { logRunsFor } from "@/lib/runs/log";
import { refreshSkillOverrides } from "@/lib/skills/overrides";
import { MIGRATION_NOTE, readLargeJson } from "@/lib/skills/service";

export const maxDuration = 300;
const MAX_BYTES = 4 * 1024 * 1024;

const sessionTitle = (d = new Date()) => `Review session, ${d.toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" })} ${d.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Singapore" })}`;

/** A new session, or null when the sessions table isn't there yet (uploads then work as before, without one). */
async function newSession(store: AuthStore, by: string, title?: string | null): Promise<KnowledgeSession | null> {
  const s: KnowledgeSession = { id: randomUUID(), title: (title?.trim() || sessionTitle()).slice(0, 120), createdBy: by, createdAt: new Date().toISOString(), kixItems: {}, published: [] };
  try {
    await store.knowledge.saveSession(s);
    return s;
  } catch (e) {
    if (e instanceof SkillTablesMissingError) return null;
    throw e;
  }
}

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    logRunsFor("knowledge-agent");
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const rights = z.enum(RIGHTS).safeParse(form?.get("rights"));
    const source = z.url().max(500).nullable().safeParse((form?.get("sourceUrl") as string | null) || null);
    const sessionIn = z.guid().nullable().safeParse((form?.get("sessionId") as string | null) || null);
    if (!(file instanceof File) || !rights.success || !source.success || !sessionIn.success) return fail(400, "invalid");
    if (file.size > MAX_BYTES) return fail(413, "too-large");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.subarray(0, 4)) !== "%PDF") return fail(415, "not-pdf");

    const session = sessionIn.data ? await store.knowledge.session(sessionIn.data) : await newSession(store, admin.profile.id, form?.get("title") as string | null);
    if (sessionIn.data && !session) return fail(404, "not-found");
    await refreshSkillOverrides(store);
    let upload = await readPaper({ bytes, fileName: file.name, rights: rights.data, sourceUrl: source.data, uploadedBy: admin.profile.id, sessionId: session?.id ?? null, signal: request.signal });
    await store.knowledge.saveUpload(upload);
    // Pairs it completes, or answers it carries: Muse cross-checks them now.
    let checked = 0;
    if (session && upload.status === "ready") {
      const mine = (await store.knowledge.uploads()).filter((u) => u.sessionId === session.id);
      const done = await recheck(store, papersToCheck(upload, mine), request.signal);
      checked = done.length;
      upload = done.find((u) => u.id === upload.id) ?? upload;
    }
    await store.audit({ actor: admin.profile.id, actorRole: "admin", action: "knowledge.upload", target: upload.id, householdId: admin.householdId, detail: { rights: upload.rights, status: upload.status, pack: upload.pack, kind: upload.extraction?.document?.kind ?? null, checked } });
    return ok({ upload, session });
  });
}

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    if (!(await requireAdmin(store, jar))) return fail(403, "not-allowed");
    await refreshSkillOverrides(store);
    const [uploads, updates, sessions] = await Promise.all([store.knowledge.uploads(), store.knowledge.updates(), store.knowledge.sessions()]);
    const packs = packsOnDisk().map((p) => ({ id: p.id, title: p.title, version: p.version, topics: p.topics, level: p.level, subject: p.subject, tier: p.tier }));
    return ok({ uploads, updates, packs, sessions, sessionsReady: sessions.length > 0 || store.mode === "demo" });
  });
}

const reviewMarks = z.record(z.string().regex(/^[atci]:\d{1,2}$/), z.enum(["approved", "rejected"]));
const archetype = extractionSchema.shape.archetypes.element;
const patch = z.union([
  // The original shape (before sessions): just the marks.
  z.strictObject({ id: z.guid(), review: reviewMarks }),
  z.strictObject({ op: z.literal("review"), id: z.guid(), review: reviewMarks }),
  z.strictObject({
    op: z.literal("override"),
    id: z.guid(),
    overrides: z.strictObject({ level: z.enum(LEVELS).exclude(["unknown"]).optional(), subject: z.enum(SUBJECTS).exclude(["other"]).optional(), tier: z.enum(TIERS).nullable().optional() }),
  }),
  z.strictObject({ op: z.literal("pair"), id: z.guid(), with: z.union([z.guid(), z.literal("none"), z.literal("auto")]) }),
  z.discriminatedUnion("kind", [
    z.strictObject({ op: z.literal("edit"), id: z.guid(), kind: z.literal("archetypes"), entries: z.array(archetype).max(60) }),
    z.strictObject({ op: z.literal("edit"), id: z.guid(), kind: z.literal("traps"), entries: extractionSchema.shape.traps.element.array().max(30) }),
    z.strictObject({ op: z.literal("edit"), id: z.guid(), kind: z.literal("markingCues"), entries: extractionSchema.shape.markingCues.element.array().max(30) }),
    z.strictObject({ op: z.literal("edit"), id: z.guid(), kind: z.literal("items"), entries: extractionSchema.shape.items.element.array().max(50) }),
    z.strictObject({ op: z.literal("edit"), id: z.guid(), kind: z.literal("questions"), entries: extractionSchema.shape.questions.element.array().max(80) }),
  ]),
  z.strictObject({ op: z.literal("resolve"), id: z.guid(), key: z.string().regex(/^[qi]:[a-z0-9]{1,12}$/), how: z.enum(["key-right", "use-muse", "use-fix"]).nullable() }),
]);

export async function PATCH(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const parsed = patch.safeParse(await readLargeJson(request, 400_000));
    if (!parsed.success) return fail(400, "invalid", { note: parsed.error.issues[0]?.message?.slice(0, 200) });
    const b = parsed.data;
    const u = await store.knowledge.upload(b.id);
    if (!u || u.publishedIn) return fail(404, "not-found");
    const save = async (p: { state?: UploadState; review?: KnowledgeUpload["review"] }) => {
      try {
        return await store.knowledge.updateUpload(u.id, p);
      } catch (e) {
        if (e instanceof SkillTablesMissingError) return null;
        throw e;
      }
    };
    if (!("op" in b) || b.op === "review") {
      const saved = await save({ review: b.review });
      return ok({ upload: saved ?? { ...u, review: b.review } });
    }
    if (b.op === "override") {
      const saved = await save({ state: { ...u.state, overrides: b.overrides } });
      if (!saved) return fail(503, "not-configured", { note: MIGRATION_NOTE });
      await store.audit({ actor: admin.profile.id, actorRole: "admin", action: "knowledge.override", target: u.id, householdId: admin.householdId, detail: { fields: Object.keys(b.overrides) } });
      return ok({ upload: saved });
    }
    if (b.op === "pair") {
      const all = await store.knowledge.uploads();
      const other = b.with === "none" || b.with === "auto" ? null : all.find((x) => x.id === b.with && x.sessionId === u.sessionId && !x.publishedIn);
      if (b.with !== "none" && b.with !== "auto" && !other) return fail(404, "not-found");
      // Whoever either side was paired with by hand before is set back to automatic.
      for (const x of all.filter((x) => x.id !== u.id && x.sessionId === u.sessionId && !x.publishedIn && (x.state.pairWith === u.id || (other && x.state.pairWith === other.id)))) {
        const rest: UploadState = { ...x.state };
        delete rest.pairWith;
        await store.knowledge.updateUpload(x.id, { state: rest }).catch(() => null);
      }
      const mine: UploadState = { ...u.state };
      if (b.with === "auto") delete mine.pairWith;
      else mine.pairWith = b.with === "none" ? null : b.with;
      const saved = await save({ state: mine });
      if (!saved) return fail(503, "not-configured", { note: MIGRATION_NOTE });
      if (other) await store.knowledge.updateUpload(other.id, { state: { ...other.state, pairWith: u.id } });
      // A new pair is cross-checked at once.
      const session = (await store.knowledge.uploads()).filter((x) => x.sessionId === u.sessionId);
      if (other) {
        logRunsFor("knowledge-agent");
        await recheck(store, papersToCheck(saved, session), request.signal);
      }
      return ok({ upload: (await store.knowledge.upload(u.id)) ?? saved });
    }
    if (b.op === "edit") {
      if (b.kind === "items" && u.rights === "school-private") return fail(400, "not-allowed", { note: "A school paper keeps no questions (rule 10): Kix writes its own from the patterns." });
      const edits = { ...(u.state.edits ?? {}), [b.kind]: b.entries };
      const saved = await save({ state: { ...u.state, edits } });
      if (!saved) return fail(503, "not-configured", { note: MIGRATION_NOTE });
      return ok({ upload: saved });
    }
    // resolve
    const resolved = { ...(u.state.resolved ?? {}) };
    const check = u.state.checks?.find((c) => c.key === b.key);
    if (b.how === null) delete resolved[b.key];
    else resolved[b.key] = b.how;
    const state: UploadState = { ...u.state, resolved };
    // Using Muse's answer or the spelling fix writes it into the key the admin sees.
    const value = b.how === "use-muse" ? check?.museAnswer : b.how === "use-fix" ? check?.fix : null;
    if (value && b.key.startsWith("q:")) {
      const questions = (u.state.edits?.questions ?? u.extraction?.questions ?? []).map((q) => (`q:${normNo(q.no)}` === b.key ? { ...q, keyAnswer: value.slice(0, 200) } : q));
      state.edits = { ...(u.state.edits ?? {}), questions };
    } else if (value && b.key.startsWith("i:") && u.rights !== "school-private") {
      const i = Number(b.key.slice(2));
      const items = (u.state.edits?.items ?? u.extraction?.items ?? []).map((it, n) => (n === i ? { ...it, answer: value.slice(0, 300) } : it));
      state.edits = { ...(u.state.edits ?? {}), items };
    }
    const saved = await save({ state });
    if (!saved) return fail(503, "not-configured", { note: MIGRATION_NOTE });
    await store.audit({ actor: admin.profile.id, actorRole: "admin", action: "knowledge.resolve", target: u.id, householdId: admin.householdId, detail: { key: b.key, how: b.how } });
    return ok({ upload: saved });
  });
}
