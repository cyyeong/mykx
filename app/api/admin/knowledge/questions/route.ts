// Kix's own new questions for a pack, from a review session's approved patterns (founder, 29 Oct). Muse Spark
// (Standard) is given the patterns, traps and marking cues only, in our own words (never a paper's questions, rule
// 10), writes fresh questions, and a separate call works each one out again. They wait in the session for the
// admin's approval. Admins only, behind the parent PIN; runs are logged as the knowledge agent's.
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { pinLockedResponse } from "@/lib/auth/pin";
import { SkillTablesMissingError } from "@/lib/auth/store";
import { writeKixQuestions } from "@/lib/knowledge/kix-questions";
import { TIER_LABEL } from "@/lib/knowledge/knowledge";
import { packsOnDisk } from "@/lib/knowledge/packs";
import { effectivePaper, entriesOf, routeOf } from "@/lib/knowledge/session";
import { hasMetaApiKey } from "@/lib/meta/client";
import { logRunsFor } from "@/lib/runs/log";
import { refreshSkillOverrides } from "@/lib/skills/overrides";
import { MIGRATION_NOTE } from "@/lib/skills/service";

export const maxDuration = 300;
const body = z.strictObject({ sessionId: z.guid(), pack: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/), n: z.number().int().min(1).max(8) });

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const locked = await pinLockedResponse(store, jar);
    if (locked) return locked;
    const admin = await requireAdmin(store, jar);
    if (!admin) return fail(403, "not-allowed");
    const b = await readBody(request, body);
    if (!b) return fail(400, "invalid");
    if (!hasMetaApiKey()) return fail(503, "not-configured", { note: "The Meta model key isn't set on this server, so Kix can't write questions." });
    const session = await store.knowledge.session(b.sessionId);
    if (!session) return fail(404, "not-found");
    await refreshSkillOverrides(store);
    const packs = packsOnDisk().map((p) => p.id);
    const mine = (await store.knowledge.uploads()).filter((u) => u.sessionId === session.id && u.status === "ready" && !u.publishedIn && routeOf(u, packs)?.pack === b.pack);
    const patterns: { topic: string; pattern: string; marks: number }[] = [];
    const traps: string[] = [];
    const cues: string[] = [];
    for (const u of mine) {
      const e = entriesOf(u);
      e.archetypes.forEach((a, i) => u.review[`a:${i}`] === "approved" && patterns.push({ topic: a.topic, pattern: a.pattern, marks: a.marks }));
      e.traps.forEach((t, i) => u.review[`t:${i}`] === "approved" && traps.push(`${t.topic}: ${t.trap}`));
      e.markingCues.forEach((c, i) => u.review[`c:${i}`] === "approved" && cues.push(`${c.topic}: ${c.cue}`));
    }
    if (!patterns.length) return fail(409, "nothing-approved", { note: "Approve some question patterns first: Kix writes its questions from them." });
    const p = effectivePaper(mine[0]);
    logRunsFor("knowledge-agent");
    try {
      const fresh = await writeKixQuestions({ level: p.level, subject: p.subject, tier: p.tier ? TIER_LABEL[p.tier] : null, patterns, traps, cues, n: b.n, signal: request.signal });
      const next = { ...session, kixItems: { ...session.kixItems, [b.pack]: [...(session.kixItems[b.pack] ?? []), ...fresh].slice(-30) } };
      await store.knowledge.saveSession(next);
      await store.audit({ actor: admin.profile.id, actorRole: "admin", action: "knowledge.kix-questions", target: session.id, householdId: admin.householdId, detail: { pack: b.pack, written: fresh.length, flagged: fresh.filter((f) => f.check?.status !== "ok").length } });
      return ok({ session: next });
    } catch (e) {
      if (e instanceof SkillTablesMissingError) return fail(503, "not-configured", { note: MIGRATION_NOTE });
      return fail(502, "error", { note: `Kix couldn't write questions this time: ${(e as Error).message.slice(0, 160)}` });
    }
  });
}
