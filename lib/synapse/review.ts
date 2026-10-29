// The Kix Synapse pipeline for one report (docs/prd/SYNAPSE.md §3, §5): review → code checks → reproduce → re-test
// with the fix → second opinion for a score change → computed confidence → decide → ship and test, or wait for the
// admin. Every step lands in the report's trace. Models come in through `deps`, so tests run without a network.
// Server only.
import { roleStructured, type RoleChoice } from "../meta/open.ts";
import type { AuthStore } from "../auth/store.ts";
import { runAskKix, runCritter, type AgentOutput } from "./agents.ts";
import { applyFix } from "./apply.ts";
import { cautionLine } from "./cautions.ts";
import { checkFix, isScoringFix } from "./checks.ts";
import { computeConfidence, decide } from "./confidence.ts";
import { codeCheck } from "./expect.ts";
import { JUDGE_PROMPT, REVIEWER_PROMPT, SECOND_PROMPT } from "./prompts.ts";
import { judgeSchema, reviewSchema, secondSchema, type EvalCase, type EvalTest, type Review, type SynapseReport, type SynapseSettings, type TraceStep } from "./types.ts";

export const RUNS = 3;

/** Who re-runs what: an Ask Kix question as Kix read it, or a pet at a stage hearing the kid's words. */
export type RerunTarget = { agent: "ask-kix"; level: string | null; question: string; sections: string[] } | { agent: "critter-keeper"; species: string; petStage: number; ask: string };

export interface Deps {
  store: AuthStore;
  settings: SynapseSettings;
  /** The family's nicknames, for the name check. Never sent to a model. */
  names: readonly string[];
  review(caseText: string): Promise<{ data: Review; choice: RoleChoice; costUsd: number }>;
  second(caseText: string): Promise<{ agree: boolean; confidence: number; reason: string; model: string; costUsd: number }>;
  judge(expect: string, reply: string): Promise<{ pass: boolean; costUsd: number }>;
  rerun(target: RerunTarget, extraCautions: readonly string[]): Promise<AgentOutput>;
  now(): string;
}

export function liveDeps(store: AuthStore, settings: SynapseSettings, names: readonly string[]): Deps {
  return {
    store,
    settings,
    names,
    async review(caseText) {
      const out = await roleStructured("synapse.reviewer", { messages: [{ role: "system", content: REVIEWER_PROMPT }, { role: "user", content: caseText }], schema: reviewSchema, schemaName: "synapse_review", reasoningEffort: "low" }, { timeoutMs: 90_000, override: settings.models["synapse.reviewer"] });
      return { data: out.data, choice: out.choice, costUsd: out.run.costUsd ?? 0 };
    },
    async second(caseText) {
      const out = await roleStructured("synapse.second", { messages: [{ role: "system", content: SECOND_PROMPT }, { role: "user", content: caseText }], schema: secondSchema, schemaName: "synapse_second", reasoningEffort: "low" }, { timeoutMs: 60_000, override: settings.models["synapse.second"] });
      return { ...out.data, model: out.run.model, costUsd: out.run.costUsd ?? 0 };
    },
    async judge(expect, reply) {
      const out = await roleStructured("synapse.judge", { messages: [{ role: "system", content: JUDGE_PROMPT }, { role: "user", content: `Expectation: ${expect}\n\nReply:\n${reply}` }], schema: judgeSchema, schemaName: "synapse_judge", reasoningEffort: "minimal" }, { timeoutMs: 45_000, override: settings.models["synapse.judge"] });
      return { pass: out.data.pass, costUsd: out.run.costUsd ?? 0 };
    },
    rerun: (t, extra) => (t.agent === "ask-kix" ? runAskKix({ store, level: t.level, question: t.question, sections: t.sections, extraCautions: extra }) : runCritter({ store, species: t.species, petStage: t.petStage, ask: t.ask, extraCautions: extra })),
    now: () => new Date().toISOString(),
  };
}

/** The case as the reviewer reads it: de-identified, ids and versions, the item from the pack, the turn. */
export function caseText(r: SynapseReport): string {
  const c = r.case;
  const parts = [
    `Where: ${r.surface}${r.turn.agent ? ` (agent ${r.turn.agent} v${r.turn.agentVersion ?? 1})` : ""} · level ${r.turn.level ?? "?"}${r.turn.subject ? ` · ${r.turn.subject}` : ""}${r.turn.stage ? ` · stage ${r.turn.stage}` : ""}`,
    `The learner's report: ${r.kind}${c.note ? ` — "${c.note}"` : ""}`,
  ];
  if (c.item) parts.push(`The question (pack ${c.item.packId}, item ${c.item.id}), as JSON:\n${JSON.stringify(c.item, null, 1)}`);
  if (c.answer !== null) parts.push(`The learner's answer: ${c.answer}${c.marked === null ? "" : c.marked ? " (marked right)" : " (marked wrong)"}`);
  if (c.ask) parts.push(`What was asked: ${c.ask}`);
  if (c.shown) parts.push(`What the helper showed:\n${c.shown}`);
  return parts.join("\n\n");
}

/** The agent to re-run for this report, or null when it can't be reproduced (a photo-only ask, the tutor). */
export function targetOf(c: EvalCase["target"]): RerunTarget | null {
  if (c.type !== "agent") return null;
  if (c.agent === "ask-kix" && c.question) return { agent: "ask-kix", level: c.level, question: c.question, sections: c.sections };
  if (c.agent === "critter-keeper" && c.species && c.ask) return { agent: "critter-keeper", species: c.species, petStage: c.petStage ?? 0, ask: c.ask };
  return null;
}

export function rerunTarget(r: SynapseReport): RerunTarget | null {
  if (r.surface === "ask-kix" && r.case.ask) return { agent: "ask-kix", level: r.turn.level, question: r.case.ask, sections: r.turn.sections };
  if (r.surface === "critter" && r.turn.species && r.case.ask) return { agent: "critter-keeper", species: r.turn.species, petStage: r.turn.petStage ?? 0, ask: r.case.ask };
  return null;
}

export async function passes(deps: Pick<Deps, "judge">, test: EvalTest, out: AgentOutput): Promise<{ pass: boolean; cost: number }> {
  const code = codeCheck(test, out.text, out.final);
  if (code !== null) return { pass: code, cost: 0 };
  const j = await deps.judge(test.expect, out.text);
  return { pass: j.pass, cost: j.costUsd };
}

/** Runs the agent `n` times (at once) and counts the runs that pass the test. */
export async function runTimes(deps: Pick<Deps, "rerun" | "judge">, target: RerunTarget, test: EvalTest, extra: readonly string[], n: number): Promise<{ pass: number; cost: number; good: string | null; bad: string | null }> {
  const outs = await Promise.allSettled(Array.from({ length: n }, () => deps.rerun(target, extra)));
  let pass = 0;
  let cost = 0;
  let good: string | null = null;
  let bad: string | null = null;
  for (const o of outs) {
    if (o.status !== "fulfilled") continue;
    cost += o.value.costUsd;
    const p = await passes(deps, test, o.value);
    cost += p.cost;
    if (p.pass) {
      pass += 1;
      good ??= o.value.text.slice(0, 2000);
    } else bad ??= o.value.text.slice(0, 2000);
  }
  return { pass, cost, good, bad };
}

/** Other eval cases for the same agent, re-run with the caution: a fix must not break what already works. */
async function othersWith(deps: Deps, agent: string, extra: readonly string[]): Promise<{ passed: number; total: number; cost: number } | null> {
  const cases = (await deps.store.synapse.evalCases().catch(() => [] as EvalCase[])).filter((c) => c.active && c.target.type === "agent" && c.target.agent === agent).slice(0, 4);
  if (!cases.length) return null;
  let passed = 0;
  let cost = 0;
  for (const c of cases) {
    const target = targetOf(c.target);
    if (!target) continue;
    const r = await runTimes(deps, target, c.test, extra, 1).catch(() => ({ pass: 0, cost: 0 }));
    passed += r.pass;
    cost += r.cost;
  }
  return { passed, total: cases.length, cost };
}

const sgDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(0, 10);

/** Reviews one report end to end and saves each step. Returns the report as saved. Never throws for a model failure:
 *  the report goes to the admin with what is known. */
export async function runReview(reportId: string, deps: Deps): Promise<SynapseReport | null> {
  const store = deps.store;
  const loaded = await store.synapse.report(reportId);
  if (!loaded || !["new", "failed"].includes(loaded.status)) return loaded;
  let r: SynapseReport = { ...loaded, status: "reviewing", updatedAt: deps.now(), threshold: deps.settings.threshold };
  const step = (kind: TraceStep["kind"], title: string, detail: string) => {
    r = { ...r, steps: [...r.steps, { at: deps.now(), kind, title, detail }] };
  };
  const save = async () => {
    r = { ...r, updatedAt: deps.now() };
    await store.synapse.saveReport(r);
  };
  await save();

  // Budget: today's reviews (SGT) stay under the admin's cap.
  const today = sgDay(deps.now());
  const recent = await store.synapse.reports({ sinceIso: new Date(Date.parse(deps.now()) - 36 * 3600_000).toISOString(), limit: 1000 }).catch(() => [] as SynapseReport[]);
  const spent = recent.filter((x) => sgDay(x.createdAt) === today).reduce((s, x) => s + (x.costUsd || 0), 0);
  if (spent >= deps.settings.budgetReviewUsd) {
    step("decision", "Waiting: today's review budget is used", `$${spent.toFixed(2)} of $${deps.settings.budgetReviewUsd.toFixed(2)}`);
    r = { ...r, status: "waiting" };
    await save();
    return r;
  }

  try {
    const reviewed = await deps.review(caseText(r));
    const review = reviewed.data;
    r = { ...r, review, reviewModel: { provider: reviewed.choice.used.provider, model: reviewed.choice.used.model, fallback: reviewed.choice.fallback }, costUsd: r.costUsd + reviewed.costUsd };
    const via = `${reviewed.choice.used.provider === "baseten" ? "Baseten" : "Meta"} · ${reviewed.choice.used.model}${reviewed.choice.fallback ? ` (wanted ${reviewed.choice.wanted.model}: ${reviewed.choice.fallback === "no-key" ? "no Baseten key" : "Baseten failed"})` : ""}`;
    step("ai", "Review · Synapse Reviewer", `${via} · ${review.verdict} · ${review.kind} · ${Math.round(review.confidence)}`);

    const checks = review.verdict === "problem" ? checkFix(review, r.case.item, deps.names) : checkFix({ ...review, fix: { ...review.fix, type: "none" } }, r.case.item, deps.names);
    r = { ...r, checks };
    if (checks.length) step("guard", "Code checks", `${checks.filter((c) => c.ok).length} of ${checks.length} pass${checks.some((c) => !c.ok) ? `: ${checks.filter((c) => !c.ok).map((c) => c.name).join(", ")} failed` : ""}`);

    // Reproduce, and re-test with the fix.
    const target = rerunTarget(r);
    if (review.verdict === "problem") {
      const f = review.fix.type;
      if (f === "item-text" || f === "item-accept" || f === "item-answer") {
        const found = checks.every((c) => c.ok);
        r = { ...r, reproduce: { runs: 1, failing: found ? 1 : 0, how: "pack" } };
        step("guard", "Reproduce in the pack", found ? "the problem is in the published item" : "not found in the published item");
      } else if (f === "caution" && target) {
        const before = await runTimes(deps, target, review.test, [], RUNS);
        r = { ...r, reproduce: { runs: RUNS, failing: RUNS - before.pass, how: "model" }, costUsd: r.costUsd + before.cost };
        step("ai", `Reproduce × ${RUNS} on the same versions`, `${RUNS - before.pass} of ${RUNS} runs fail the test (${review.test.kind}: ${review.test.expect})`);
        if (checks.every((c) => c.ok)) {
          const line = cautionLine({ when: review.fix.when ?? "", check: review.fix.check ?? "" });
          const after = await runTimes(deps, target, review.test, [line], RUNS);
          const others = await othersWith(deps, target.agent, [line]);
          r = { ...r, retest: { before: before.pass, after: after.pass, runs: RUNS, others: others ? { passed: others.passed, total: others.total } : null, good: after.good }, costUsd: r.costUsd + after.cost + (others?.cost ?? 0) };
          step("ai", "Re-test with the caution", `${after.pass} of ${RUNS} pass${others ? ` · other evals ${others.passed}/${others.total}` : ""}`);
          if (others && others.passed < others.total) r = { ...r, checks: [...r.checks, { name: "No regressions", ok: false, note: `${others.passed} of ${others.total} other evals pass with it` }] };
        }
      } else {
        r = { ...r, reproduce: { runs: 0, failing: 0, how: "none" } };
        step("guard", "Reproduce", "not possible for this turn (a photo, or the tutor's hint)");
      }
      if (isScoringFix(f) && checks.every((c) => c.ok)) {
        const s = await deps.second(`${caseText(r)}\n\nProposed change: ${f} ${review.fix.field ?? ""} → ${review.fix.after ?? ""}\nReviewer's reason: ${review.rationale}`);
        r = { ...r, second: { agree: s.agree, confidence: Math.round(s.confidence), reason: s.reason, model: s.model }, costUsd: r.costUsd + s.costUsd };
        step("ai", "Second opinion", `${s.model} · ${s.agree ? "agrees" : "disagrees"} · ${Math.round(s.confidence)}`);
      }
    }

    const { value, caps } = computeConfidence({ review, checks: r.checks, reproduce: r.reproduce, retest: r.retest, second: r.second });
    const autoToday = recent.filter((x) => x.status === "auto-fixed" && x.decidedAt && sgDay(x.decidedAt) === today).length;
    const repeats = recent.filter((x) => x.id !== r.id && x.turn.itemId && x.turn.itemId === r.turn.itemId && x.kind === r.kind).length + 1;
    const d = decide({ review, confidence: value, settings: deps.settings, autoToday, repeats });
    r = { ...r, confidence: value, caps };

    if (d.decision === "auto-fix") {
      const applied = await applyFix(store, r, review, null, deps.now());
      if (applied.ok) {
        r = { ...r, status: "auto-fixed", fixRef: applied.fixRef, evalCaseId: applied.evalCase.id, kidNote: review.kidNote || "Fixed, thanks to you!", decidedBy: "synapse", decidedAt: deps.now() };
        step("decision", `Fixed by itself: ${value} ≥ ${deps.settings.threshold}`, applied.fixRef.type === "skill-version" ? `${applied.fixRef.packId} v${applied.fixRef.version} published` : `caution added to ${applied.fixRef.agent}`);
        await store.audit({ actor: null, actorRole: "system", action: "synapse.auto-fix", target: r.id, householdId: null, detail: { kind: review.kind, fix: review.fix.type, confidence: value } }).catch(() => undefined);
      } else {
        r = { ...r, status: "waiting" };
        step("decision", "Waiting: the fix didn't apply", applied.reason);
      }
    } else if (d.decision === "kix-was-right") {
      r = { ...r, status: "kix-was-right", kidNote: review.kidNote, decidedBy: "synapse", decidedAt: deps.now() };
      step("decision", "Kix was right: explained to the learner", d.why);
    } else {
      r = { ...r, status: d.decision === "for-team" ? "for-team" : "waiting" };
      step("decision", d.decision === "for-team" ? "For the team" : `Waiting for an admin: ${d.why}`, caps.length ? caps.join(" · ") : "");
    }
  } catch (err) {
    r = { ...r, status: "failed" };
    step("decision", "Review failed: waiting for an admin", (err as Error).message.slice(0, 160));
  }
  await save();
  return r;
}
