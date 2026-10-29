// The confidence Synapse acts on, computed by code (docs/prd/SYNAPSE.md §5.2): the reviewer's own number, capped by
// whether the problem reproduced, the code checks, the re-test and, for a score change, the second opinion. Then the
// decision: fix by itself, wait for the admin, tell the kid Kix was right, or hand it to the team. Pure functions.
import { isScoringFix, type Check } from "./checks.ts";
import type { Review, SynapseSettings } from "./types.ts";

export interface ConfidenceInput {
  review: Review;
  checks: readonly Check[];
  reproduce: { runs: number; failing: number; how: "model" | "pack" | "none" } | null;
  retest: { before: number; after: number; runs: number } | null;
  second: { agree: boolean; confidence: number } | null;
}

export function computeConfidence(i: ConfidenceInput): { value: number; caps: string[] } {
  const caps: string[] = [];
  let v = Math.round(Math.max(0, Math.min(100, i.review.confidence)));
  const cap = (n: number, why: string) => {
    if (v > n) {
      v = n;
      caps.push(why);
    }
  };
  const failed = i.checks.filter((c) => !c.ok);
  if (failed.length) cap(0, `code check failed: ${failed.map((c) => c.name).join(", ")}`);
  if (i.review.verdict === "problem") {
    const r = i.reproduce;
    if (!r || r.how === "none") cap(60, "couldn't reproduce");
    else if (r.how === "model" && r.failing === 0) cap(60, "didn't reproduce in any run");
    else if (r.how === "model" && r.failing < r.runs) cap(90, `reproduced in ${r.failing} of ${r.runs} runs`);
    if (i.review.fix.type === "caution") {
      const t = i.retest;
      if (!t) cap(60, "no re-test");
      else if (t.after < t.runs) cap(70, `re-test passed ${t.after} of ${t.runs}`);
    }
    if (isScoringFix(i.review.fix.type)) {
      if (!i.second) cap(0, "no second opinion");
      else if (!i.second.agree) cap(0, "second opinion disagrees");
      else cap(Math.round(i.second.confidence), "second opinion");
    }
    if (i.review.fix.type === "none") cap(50, "no fix proposed");
  }
  if (i.review.verdict === "unclear") cap(50, "the reviewer is unsure");
  return { value: v, caps };
}

export type Decision = "auto-fix" | "kix-was-right" | "waiting" | "for-team";

export function decide(o: { review: Review; confidence: number; settings: SynapseSettings; autoToday: number; repeats: number }): { decision: Decision; why: string } {
  const { review, settings } = o;
  if (review.kind === "app-bug") return { decision: "for-team", why: "an app problem, not content or a model" };
  const line = settings.repeatSkip && o.repeats >= 2 ? Math.min(settings.threshold, 95) : settings.threshold;
  const sure = o.confidence >= line;
  if (!settings.on) return { decision: "waiting", why: "Synapse is off" };
  if (review.verdict === "not-a-problem") return sure ? { decision: "kix-was-right", why: `${o.confidence} ≥ ${line}` } : { decision: "waiting", why: `${o.confidence} is under ${line}` };
  if (review.verdict === "unclear" || review.fix.type === "none") return { decision: "waiting", why: "no fix to make by itself" };
  if (!sure) return { decision: "waiting", why: `${o.confidence} is under ${line}` };
  if (isScoringFix(review.fix.type) && settings.scoringNeedsAdmin) return { decision: "waiting", why: "it changes a score: scoring changes need an admin" };
  if (o.autoToday >= settings.dailyAutoCap) return { decision: "waiting", why: `today's ${settings.dailyAutoCap} fixes by itself are used` };
  return { decision: "auto-fix", why: `${o.confidence} ≥ ${line}` };
}
