// Shipping and undoing a fix (docs/prd/SYNAPSE.md §5.3, §5.4). A skill fix is the pack's next published version
// (source "synapse") through the override layer every pack reader uses; undo soft-deletes it, so the version before
// is the published one again. A model fix is a learned caution on the agent; undo retires it. Every fix becomes an
// eval case. Server only.
import { randomUUID } from "node:crypto";
import type { AuthStore } from "../auth/store.ts";
import { refreshSkillOverrides } from "../skills/overrides.ts";
import { createVersion, currentFiles } from "../skills/service.ts";
import { applyItemFix } from "./checks.ts";
import { forgetCautions } from "./cautions.ts";
import { SURFACE_AGENT, type EvalCase, type LearnedCaution, type Review, type SynapseReport } from "./types.ts";

const DAY = 24 * 60 * 60 * 1000;
export const CAUTION_DAYS = 30;

export type ApplyResult = { ok: true; fixRef: NonNullable<SynapseReport["fixRef"]>; evalCase: EvalCase } | { ok: false; reason: string };

export async function applyFix(store: AuthStore, report: SynapseReport, review: Review, by: string | null, nowIso = new Date().toISOString()): Promise<ApplyResult> {
  const f = review.fix;
  const label = `Report ${report.id.slice(0, 8)}: ${review.kind}`;
  if (f.type === "item-text" || f.type === "item-accept" || f.type === "item-answer") {
    const { packId, itemId } = report.turn;
    if (!packId || !itemId) return { ok: false, reason: "no-item" };
    const cur = await currentFiles(store, packId);
    if (!cur) return { ok: false, reason: "no-pack" };
    const patched = applyItemFix(cur.files, itemId, review);
    if (!patched.ok) return { ok: false, reason: patched.reason };
    const made = await createVersion(store, { packId, files: patched.files, status: "published", source: "synapse", note: `Kix Synapse: ${review.kind} fix from report ${report.id.slice(0, 8)}`.slice(0, 120), by, now: nowIso });
    if (!made.ok) return { ok: false, reason: made.reason };
    const evalCase: EvalCase = {
      id: randomUUID(),
      reportId: report.id,
      createdAt: nowIso,
      active: true,
      label,
      target: { type: "item", packId, itemId, field: f.field, before: f.before, after: f.after, accept: f.type === "item-accept" ? f.after : null, answer: f.type === "item-answer" ? f.after : null },
      test: f.type === "item-text" ? { kind: "contains", expect: f.after ?? "" } : review.test,
      last: { at: nowIso, pass: true },
    };
    await store.synapse.saveEvalCase(evalCase);
    return { ok: true, fixRef: { type: "skill-version", packId, versionId: made.value.id, version: made.value.version }, evalCase };
  }
  if (f.type === "caution") {
    const agent = SURFACE_AGENT[report.surface];
    if (!agent || !f.when || !f.check) return { ok: false, reason: "no-agent" };
    const evalCase: EvalCase = {
      id: randomUUID(),
      reportId: report.id,
      createdAt: nowIso,
      active: true,
      label,
      target:
        agent === "critter-keeper"
          ? { type: "agent", agent, level: report.turn.level, question: null, sections: [], species: report.turn.species, petStage: report.turn.petStage, ask: report.case.ask }
          : { type: "agent", agent: "ask-kix", level: report.turn.level, question: report.case.ask, sections: report.turn.sections, species: null, petStage: null, ask: null },
      test: review.test,
      last: { at: nowIso, pass: true },
    };
    const caution: LearnedCaution = {
      id: randomUUID(),
      agent,
      when: f.when.trim(),
      check: f.check.trim(),
      scope: { level: report.turn.level, subject: report.turn.subject },
      status: "active",
      reportIds: [report.id],
      evalCaseIds: agent === "tutor" ? [] : [evalCase.id],
      createdAt: nowIso,
      createdBy: by ?? "synapse",
      expiresAt: new Date(Date.parse(nowIso) + CAUTION_DAYS * DAY).toISOString(),
    };
    if (agent !== "tutor") await store.synapse.saveEvalCase(evalCase);
    await store.synapse.saveCaution(caution);
    forgetCautions();
    return { ok: true, fixRef: { type: "caution", cautionId: caution.id, agent }, evalCase };
  }
  return { ok: false, reason: "nothing-to-apply" };
}

/** Undoes a shipped fix: the pack goes back to the version before, or the caution is retired. */
export async function undoFix(store: AuthStore, report: SynapseReport, nowIso = new Date().toISOString()): Promise<boolean> {
  const ref = report.fixRef;
  if (!ref) return false;
  if (ref.type === "skill-version") {
    const n = await store.skillVersions.remove([ref.versionId], nowIso);
    await refreshSkillOverrides(store, { force: true });
    return n > 0;
  }
  const c = (await store.synapse.cautions()).find((x) => x.id === ref.cautionId);
  if (!c) return false;
  await store.synapse.saveCaution({ ...c, status: "retired" });
  forgetCautions();
  for (const id of c.evalCaseIds) {
    const ec = (await store.synapse.evalCases()).find((x) => x.id === id);
    if (ec) await store.synapse.saveEvalCase({ ...ec, active: false });
  }
  return true;
}
