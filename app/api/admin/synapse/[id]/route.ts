// One Kix Synapse case: GET its trace, review, fix and test; POST an admin's decision: approve (with an edited fix if
// they changed it), reject, undo a shipped fix, or retry a review. Every decision is in audit_log.
import { z } from "zod";
import { withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { adminView } from "@/lib/synapse/admin";
import { applyFix, undoFix } from "@/lib/synapse/apply";
import { checkFix } from "@/lib/synapse/checks";
import { synapseAdmin } from "@/lib/synapse/guard";
import { familyNames } from "@/lib/synapse/intake";
import { reviewLater } from "@/lib/synapse/server";
import type { SynapseReport } from "@/lib/synapse/types";

export const maxDuration = 300;

const decision = z.discriminatedUnion("action", [
  // `fix.type` lets an admin overrule the reviewer: a caution for the agent, or new words for the question.
  z.strictObject({ action: z.literal("approve"), fix: z.strictObject({ type: z.enum(["caution", "item-text"]), field: z.string().max(40).nullable(), before: z.string().max(400).nullable(), after: z.string().max(400).nullable(), when: z.string().max(110).nullable(), check: z.string().max(140).nullable() }).partial().optional(), kidNote: z.string().max(240).optional() }),
  z.strictObject({ action: z.literal("reject"), kidNote: z.string().max(240).optional() }),
  z.strictObject({ action: z.literal("undo") }),
  z.strictObject({ action: z.literal("retry") }),
]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async ({ store, jar }) => {
    const gate = await synapseAdmin(store, jar);
    if (gate.refused) return gate.refused;
    const r = await store.synapse.report(id);
    return r ? ok({ report: adminView(r) }) : fail(404, "not-found");
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(request, async ({ store, jar }) => {
    const gate = await synapseAdmin(store, jar);
    if (gate.refused) return gate.refused;
    const body = await readBody(request, decision);
    if (!body) return fail(400, "invalid");
    const r = await store.synapse.report(id);
    if (!r) return fail(404, "not-found");
    const now = new Date().toISOString();
    const step = (title: string, detail: string): SynapseReport["steps"] => [...r.steps, { at: now, kind: "decision", title, detail }];
    let next: SynapseReport;

    if (body.action === "approve") {
      if (!r.review || ["auto-fixed", "approved"].includes(r.status)) return fail(409, "not-allowed");
      const overrule = body.fix?.type && body.fix.type !== r.review.fix.type;
      const review = {
        ...r.review,
        ...(overrule ? { verdict: "problem" as const, kind: body.fix!.type === "caution" ? ("model-behaviour" as const) : ("typo" as const) } : {}),
        fix: { ...r.review.fix, ...(body.fix ?? {}) },
        kidNote: body.kidNote ?? (overrule ? "Thanks! Kix's crew took your note on board." : r.review.kidNote),
      };
      if (review.verdict === "not-a-problem" || review.fix.type === "none") {
        next = { ...r, status: "kix-was-right", kidNote: review.kidNote, decidedBy: gate.adminId, decidedAt: now, steps: step("Approved by an admin: Kix was right", "explained to the learner") };
      } else {
        const names = await familyNames(store, r.householdId);
        const failed = checkFix(review, r.case.item, [...names.learner, ...names.parent]).filter((c) => !c.ok);
        if (failed.length) return fail(422, "invalid", { note: `Check failed: ${failed.map((c) => c.name).join(", ")}` });
        const applied = await applyFix(store, r, review, gate.adminId, now);
        if (!applied.ok) return fail(409, "not-allowed", { note: `The fix didn't apply: ${applied.reason}` });
        next = { ...r, review, overruled: overrule ? { at: now, by: gate.adminId, verdict: r.review.verdict, kind: r.review.kind, confidence: r.review.confidence } : (r.overruled ?? null), status: "approved", fixRef: applied.fixRef, evalCaseId: applied.evalCase.id, kidNote: review.kidNote || "Fixed, thanks to you!", decidedBy: gate.adminId, decidedAt: now, steps: step(overrule ? "An admin overruled the reviewer" : "Approved by an admin", applied.fixRef.type === "skill-version" ? `${applied.fixRef.packId} v${applied.fixRef.version} published` : `caution added to ${applied.fixRef.agent}: ${applied.fixRef.line ?? ""}`) };
      }
    } else if (body.action === "reject") {
      next = { ...r, status: "rejected", kidNote: body.kidNote ?? "Thanks for telling us. Kix's crew looked, and the question stays as it is.", decidedBy: gate.adminId, decidedAt: now, steps: step("Not a problem: closed by an admin", "") };
    } else if (body.action === "undo") {
      if (!r.fixRef || r.status === "undone") return fail(409, "not-allowed");
      const undone = await undoFix(store, r, gate.adminId, now);
      if (!undone.ok) return fail(409, "not-allowed", { note: undone.reason === "changed-since" ? "The question has changed since this fix, so it can't be reverted by itself. Edit it in Skills." : `It couldn't be undone: ${undone.reason}` });
      next = { ...r, status: "undone", undo: { at: now, by: gate.adminId, versionId: undone.versionId, version: undone.version }, steps: step("Undone by an admin", r.fixRef.type === "skill-version" ? `${r.fixRef.packId} v${undone.version}: the inverse change, published` : "caution retired") };
    } else {
      if (!["failed", "waiting", "new"].includes(r.status)) return fail(409, "not-allowed");
      next = { ...r, status: "new", steps: step("Review again (admin)", "") };
    }
    next = { ...next, updatedAt: now };
    await store.synapse.saveReport(next);
    await store.audit({ actor: gate.adminId, actorRole: "admin", action: `synapse.${body.action}`, target: r.id, householdId: gate.householdId, detail: { kind: r.kind, status: next.status } });
    if (body.action === "retry") reviewLater(store, r.id, r.householdId);
    return ok({ report: adminView(next) });
  });
}
