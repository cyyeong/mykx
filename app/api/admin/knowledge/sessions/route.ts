// Knowledge review sessions (founder, 29 Oct): start one, rename it, and keep the admin's review of Kix's own
// questions (approve, reject, edit, settle Muse's check). Admins only, behind the parent PIN.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { SkillTablesMissingError, type AuthStore } from "@/lib/auth/store";
import type { KnowledgeSession } from "@/lib/knowledge/knowledge";
import { MIGRATION_NOTE, readLargeJson } from "@/lib/skills/service";

const check = z.strictObject({ key: z.string().max(80), status: z.enum(["ok", "mismatch", "spelling", "unusual", "waiting"]), museAnswer: z.string().max(200).nullable(), fix: z.string().max(200).nullable(), note: z.string().max(200).nullable() });
const kixItem = z.strictObject({
  topic: z.string().max(60),
  pattern: z.string().max(160),
  type: z.enum(["mcq", "short"]),
  stem: z.string().min(1).max(700),
  options: z.array(z.string().max(200)).max(5).nullable(),
  answer: z.string().min(1).max(200),
  working: z.array(z.string().max(240)).max(6),
  hints: z.array(z.string().max(200)).max(2),
  marks: z.number().int().min(1).max(5),
  difficulty: z.number().int().min(1).max(4),
  mark: z.enum(["approved", "rejected"]).optional(),
  check: check.optional(),
  resolved: z.enum(["key-right", "use-muse", "use-fix"]).optional(),
});

const create = z.strictObject({ title: z.string().trim().min(1).max(120).optional() });
const change = z.strictObject({ id: z.guid(), title: z.string().trim().min(1).max(120).optional(), pack: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/).optional(), kixItems: z.array(kixItem).max(30).optional() });

async function gate(request: Request, run: (ctx: { store: AuthStore; adminId: string }) => Promise<Response>) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    try {
      return await run({ store, adminId: admin.profile.id });
    } catch (e) {
      if (e instanceof SkillTablesMissingError) return fail(503, "not-configured", { note: MIGRATION_NOTE });
      throw e;
    }
  });
}

export async function POST(request: Request) {
  return gate(request, async ({ store, adminId }) => {
    const b = create.safeParse(await readLargeJson(request, 4_000));
    if (!b.success) return fail(400, "invalid");
    const now = new Date();
    const title = b.data.title ?? `Review session, ${now.toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" })} ${now.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Singapore" })}`;
    const s: KnowledgeSession = { id: randomUUID(), title, createdBy: adminId, createdAt: now.toISOString(), kixItems: {}, published: [] };
    await store.knowledge.saveSession(s);
    return ok({ session: s });
  });
}

export async function PATCH(request: Request) {
  return gate(request, async ({ store }) => {
    const b = change.safeParse(await readLargeJson(request, 300_000));
    if (!b.success) return fail(400, "invalid", { note: b.error.issues[0]?.message?.slice(0, 200) });
    const s = await store.knowledge.session(b.data.id);
    if (!s) return fail(404, "not-found");
    const next: KnowledgeSession = { ...s, title: b.data.title ?? s.title, kixItems: b.data.pack && b.data.kixItems ? { ...s.kixItems, [b.data.pack]: b.data.kixItems } : s.kixItems };
    await store.knowledge.saveSession(next);
    return ok({ session: next });
  });
}
