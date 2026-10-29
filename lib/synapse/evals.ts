// Kix Synapse's evals (docs/prd/SYNAPSE.md §5.5): every fixed report is a case. Item cases check the published pack
// by code; agent cases re-run the agent once with its current cautions and check the test (code first, the Synapse
// Judge only for meaning). Run nightly by the cron, on demand by an admin, and inside a review before a fix ships.
// A case that starts failing reopens its report for the admin. Server only.
import { randomUUID } from "node:crypto";
import type { AuthStore } from "../auth/store.ts";
import { findItem } from "../learn/subjects.ts";
import { refreshSkillOverrides } from "../skills/overrides.ts";
import { readField } from "./checks.ts";
import { passes, targetOf, type Deps } from "./review.ts";
import type { EvalCase, EvalRun } from "./types.ts";

/** Item cases are grouped as "Skill packs" in the admin's chart; agent cases by agent. */
export const caseGroup = (c: EvalCase) => (c.target.type === "item" ? "skill-packs" : c.target.agent);

function checkItem(c: EvalCase): { pass: boolean; detail: string } {
  const t = c.target;
  if (t.type !== "item") return { pass: false, detail: "not an item case" };
  const found = findItem(t.itemId);
  if (!found) return { pass: false, detail: "item not found" };
  const item = found.item as unknown as Record<string, unknown>;
  if (t.accept) return (item.accept as string[] | undefined)?.includes(t.accept) ? { pass: true, detail: "still accepted" } : { pass: false, detail: "the extra answer is gone" };
  if (t.answer) return String(item.answer) === t.answer ? { pass: true, detail: "answer kept" } : { pass: false, detail: "the answer changed back" };
  const value = t.field ? readField(item, t.field) : null;
  if (value === null) return { pass: false, detail: "field not found" };
  const ok = (!t.after || value.includes(t.after)) && (!t.before || !t.after || t.before === t.after || !value.includes(t.before) || t.after.includes(t.before));
  return ok ? { pass: true, detail: "fixed text in place" } : { pass: false, detail: "the old text is back" };
}

export async function runEvals(store: AuthStore, deps: Pick<Deps, "rerun" | "judge">, trigger: EvalRun["trigger"], o: { caseIds?: readonly string[]; limit?: number; nowIso?: string } = {}): Promise<EvalRun> {
  const nowIso = o.nowIso ?? new Date().toISOString();
  await refreshSkillOverrides(store, { force: true });
  const all = (await store.synapse.evalCases()).filter((c) => c.active && (!o.caseIds || o.caseIds.includes(c.id))).slice(0, o.limit ?? 40);
  const results: EvalRun["results"] = [];
  let cost = 0;
  const queue = [...all];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      let res: { pass: boolean; detail: string };
      try {
        if (c.target.type === "item") res = checkItem(c);
        else {
          const target = targetOf(c.target);
          if (!target) res = { pass: false, detail: "can't re-run" };
          else {
            const out = await deps.rerun(target, []);
            const p = await passes(deps, c.test, out);
            cost += out.costUsd + p.cost;
            res = { pass: p.pass, detail: `${c.test.kind}: ${c.test.expect}` };
          }
        }
      } catch (e) {
        res = { pass: false, detail: `error: ${(e as Error).message.slice(0, 80)}` };
      }
      results.push({ caseId: c.id, agent: caseGroup(c), ...res });
      await store.synapse.saveEvalCase({ ...c, last: { at: nowIso, pass: res.pass } });
      // A case that used to pass and now fails sends its report back to the admin.
      if (!res.pass && c.last?.pass) {
        const r = await store.synapse.report(c.reportId);
        if (r && (r.status === "auto-fixed" || r.status === "approved")) {
          await store.synapse.saveReport({ ...r, status: "waiting", updatedAt: nowIso, steps: [...r.steps, { at: nowIso, kind: "decision", title: "Reopened: its eval started failing", detail: res.detail }] });
        }
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const run: EvalRun = { id: randomUUID(), at: nowIso, trigger, results, passed: results.filter((r) => r.pass).length, total: results.length, costUsd: Math.round(cost * 1e6) / 1e6 };
  await store.synapse.saveEvalRun(run);
  return run;
}
