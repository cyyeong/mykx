// What Admin → Kix Synapse shows (boards SynapseInbox, SynapseCase, SynapseLearned, SynapseSettings). A learner is
// shown by level only: no household, profile or nickname reaches the admin page (rule 13 as amended in
// docs/prd/SYNAPSE.md §9: a kid's own report shares that one turn).
import { hasOpenModelKey } from "../meta/open.ts";
import type { AuthStore } from "../auth/store.ts";
import { describeFix } from "./apply.ts";
import { isLive } from "./cautions.ts";
import { caseGroup } from "./evals.ts";
import { MODEL_CHOICES } from "./settings.ts";
import { CLOSED, type EvalCase, type EvalRun, type LearnedCaution, type SynapseReport, type SynapseSettings } from "./types.ts";

export type AdminReport = Omit<SynapseReport, "householdId" | "profileId"> & { who: string };

export function adminView(r: SynapseReport): AdminReport {
  const { householdId: _h, profileId: _p, ...rest } = r;
  void _h;
  void _p;
  return { ...rest, who: `${r.turn.level ?? "A"} learner` };
}

/** The title an admin reads in the inbox: the kid's note, else what the kind says. */
export function reportTitle(r: Pick<SynapseReport, "case" | "kind">): string {
  if (r.case.note) return r.case.note.length > 70 ? `${r.case.note.slice(0, 68)}…` : r.case.note;
  return { typo: "A word is spelt wrong", "marked-wrong": "My answer was marked wrong", figure: "The picture doesn't match", hint: "The hint didn't help", "question-wrong": "The question looks wrong", "answer-wrong": "Kix's answer looks wrong", confusing: "Doesn't make sense", "pet-wrong": "Not true for this stage", other: "Something else" }[r.kind];
}

/** One change Kix Synapse made, for the change log (Learned): what, where, who decided, and whether it's still live. */
export interface Change {
  reportId: string;
  at: string;
  by: "synapse" | "admin";
  target: { type: "agent"; id: string } | { type: "pack"; id: string };
  kind: "caution" | "text" | "accept" | "answer";
  summary: string;
  before: string | null;
  after: string | null;
  version: string | null;
  status: "live" | "undone" | "expired";
  undo: { at: string; version: string | null } | null;
  cautionId: string | null;
  expiresAt: string | null;
  report: string;
}

export function changesFrom(reports: readonly SynapseReport[], cautions: readonly LearnedCaution[], now = Date.now()): Change[] {
  const byId = new Map(cautions.map((c) => [c.id, c]));
  return reports
    .filter((r) => r.fixRef && (r.status === "auto-fixed" || r.status === "approved" || r.status === "undone"))
    .map((r): Change => {
      const ref = r.fixRef!;
      const c = ref.type === "caution" ? byId.get(ref.cautionId) : undefined;
      const status: Change["status"] = r.status === "undone" || c?.status === "retired" ? "undone" : c && !isLive(c, now) ? "expired" : "live";
      return {
        reportId: r.id,
        at: r.decidedAt ?? r.updatedAt,
        by: r.status === "auto-fixed" || r.decidedBy === "synapse" ? "synapse" : "admin",
        target: ref.type === "caution" ? { type: "agent", id: ref.agent } : { type: "pack", id: ref.packId },
        kind: ref.type === "caution" ? "caution" : (ref.change ?? "text"),
        summary: describeFix(ref),
        before: ref.type === "skill-version" ? (ref.before ?? null) : null,
        after: ref.type === "skill-version" ? (ref.after ?? null) : null,
        version: ref.type === "skill-version" ? ref.version : null,
        status,
        undo: r.undo ? { at: r.undo.at, version: r.undo.version } : null,
        cautionId: ref.type === "caution" ? ref.cautionId : null,
        expiresAt: c?.expiresAt ?? null,
        report: reportTitle(r),
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

export interface Overview {
  reports: AdminReport[];
  stages: { flagged: number; traced: number; reviewed: number; fixed: number; bySynapse: number; byAdmin: number; retested: number; retestedGreen: number };
  waiting: number;
  medianFixMs: number | null;
  cautions: LearnedCaution[];
  changes: Change[];
  cases: EvalCase[];
  evals: { group: string; points: number[]; last: { passed: number; total: number } }[];
  failing: { caseId: string; group: string; label: string; detail: string }[];
  settings: SynapseSettings;
  choices: typeof MODEL_CHOICES;
  openModelKey: boolean;
  dataset: { supervised: number; preference: number; families: number };
  spentToday: number;
}

const sgDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(0, 10);

export async function overview(store: AuthStore, settings: SynapseSettings, nowIso = new Date().toISOString()): Promise<Overview> {
  const since = new Date(Date.parse(nowIso) - 30 * 86_400_000).toISOString();
  const [reports, cautions, cases, runs, consenting] = await Promise.all([
    store.synapse.reports({ sinceIso: since, limit: 500 }),
    store.synapse.cautions(),
    store.synapse.evalCases(),
    store.synapse.evalRuns(30),
    store.synapse.consenting(),
  ]);
  const week = reports.filter((r) => Date.parse(r.createdAt) > Date.parse(nowIso) - 7 * 86_400_000);
  const fixed = week.filter((r) => r.status === "auto-fixed" || r.status === "approved");
  const retested = fixed.filter((r) => r.evalCaseId);
  const lastPass = new Map(cases.map((c) => [c.id, c.last?.pass ?? true]));
  const times = fixed.filter((r) => r.decidedAt).map((r) => Date.parse(r.decidedAt!) - Date.parse(r.createdAt)).sort((a, b) => a - b);

  // Pass rate per group over the last 14 runs (oldest first).
  const ordered = [...runs].reverse().slice(-14);
  const groups = [...new Set(cases.filter((c) => c.active).map(caseGroup))];
  const evals = groups.map((g) => {
    const points = ordered.map((run: EvalRun) => {
      const rs = run.results.filter((x) => x.agent === g);
      return rs.length ? Math.round((rs.filter((x) => x.pass).length / rs.length) * 100) : 100;
    });
    const active = cases.filter((c) => c.active && caseGroup(c) === g);
    return { group: g, points, last: { passed: active.filter((c) => c.last?.pass !== false).length, total: active.length } };
  });
  const failing = cases.filter((c) => c.active && c.last && !c.last.pass).map((c) => ({ caseId: c.id, group: caseGroup(c), label: c.label, detail: `${c.test.kind}: ${c.test.expect}` }));

  const all = await store.synapse.reports({ limit: 1000 });
  const changes = changesFrom(all, cautions, Date.parse(nowIso));
  const consent = new Set(consenting);
  const fromConsent = all.filter((r) => consent.has(r.householdId) && (r.status === "auto-fixed" || r.status === "approved"));
  const today = sgDay(nowIso);

  return {
    reports: reports.map(adminView),
    stages: {
      flagged: week.length,
      traced: week.length,
      reviewed: week.filter((r) => r.review).length,
      fixed: fixed.length,
      bySynapse: fixed.filter((r) => r.status === "auto-fixed").length,
      byAdmin: fixed.filter((r) => r.status === "approved").length,
      retested: retested.length,
      retestedGreen: retested.filter((r) => lastPass.get(r.evalCaseId!) !== false).length,
    },
    waiting: reports.filter((r) => !CLOSED.includes(r.status) && r.status !== "for-team").length,
    medianFixMs: times.length ? times[Math.floor(times.length / 2)] : null,
    cautions,
    changes,
    cases,
    evals,
    failing,
    settings,
    choices: MODEL_CHOICES,
    openModelKey: hasOpenModelKey(),
    dataset: { supervised: fromConsent.filter((r) => r.review?.fix.type !== "none").length, preference: fromConsent.filter((r) => r.case.shown && r.retest?.good).length, families: consent.size },
    spentToday: Math.round(reports.filter((r) => sgDay(r.createdAt) === today).reduce((s, r) => s + (r.costUsd || 0), 0) * 100) / 100,
  };
}

/** The retrain dataset as JSONL (docs/prd/SYNAPSE.md §8): fixed cases from families who turned on "Help Kix learn",
 *  already de-identified. Supervised pairs, and preference pairs where both the old and the better reply exist. */
export async function datasetJsonl(store: AuthStore): Promise<string> {
  const consent = new Set(await store.synapse.consenting());
  const rows = (await store.synapse.reports({ limit: 2000 })).filter((r) => consent.has(r.householdId) && (r.status === "auto-fixed" || r.status === "approved") && r.review);
  const lines: string[] = [];
  for (const r of rows) {
    const f = r.review!.fix;
    const meta = { report: r.id.slice(0, 8), surface: r.surface, level: r.turn.level, subject: r.turn.subject, kind: r.review!.kind };
    if (f.type === "caution" && r.case.ask && r.retest?.good) {
      lines.push(JSON.stringify({ type: "sft", meta, messages: [{ role: "user", content: r.case.ask }, { role: "assistant", content: r.retest.good }] }));
      if (r.case.shown) lines.push(JSON.stringify({ type: "preference", meta, prompt: r.case.ask, chosen: r.retest.good, rejected: r.case.shown }));
    } else if (f.type.startsWith("item-") && r.case.item) {
      lines.push(JSON.stringify({ type: "item-fix", meta, item: r.case.item.id, field: f.field, before: f.before, after: f.after }));
    }
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}
