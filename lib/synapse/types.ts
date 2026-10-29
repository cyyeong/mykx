// Kix Synapse, the self-learning engine (docs/prd/SYNAPSE.md): the shapes of a report, a review, a learned caution,
// an eval case and the admin's settings. Reports hold de-identified words only, and only for the turn a kid chose to
// report; everything else is ids and numbers.
import { z } from "zod";
import type { ModelRole, RoleModel } from "../meta/open.ts";

/** Where a report comes from: a screen where a model speaks or a question is marked. */
export const SURFACES = ["learn", "ask-kix", "tutor", "critter"] as const;
export type Surface = (typeof SURFACES)[number];

/** What the kid says is wrong (the chips on the flag sheet). */
export const REPORT_KINDS = ["typo", "marked-wrong", "figure", "hint", "question-wrong", "answer-wrong", "confusing", "pet-wrong", "other"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const STATUSES = ["new", "reviewing", "waiting", "auto-fixed", "approved", "rejected", "kix-was-right", "for-team", "merged", "undone", "failed"] as const;
export type ReportStatus = (typeof STATUSES)[number];
/** Statuses that are finished: nothing more happens unless an admin acts. */
export const CLOSED: readonly ReportStatus[] = ["auto-fixed", "approved", "rejected", "kix-was-right", "merged", "undone"];

/** The agent behind each surface: the one a caution is added to. */
export const SURFACE_AGENT: Readonly<Record<Surface, "ask-kix" | "tutor" | "critter-keeper" | null>> = {
  learn: null,
  "ask-kix": "ask-kix",
  tutor: "tutor",
  critter: "critter-keeper",
};

/** The reviewer's answer (Synapse Reviewer, docs/prd/SYNAPSE.md §5.2). No recursive refs; every field required. */
export const reviewSchema = z.object({
  verdict: z.enum(["problem", "not-a-problem", "unclear"]),
  kind: z.enum(["typo", "figure-mismatch", "answer-key", "marking-rule", "wrong-explanation", "model-behaviour", "app-bug", "not-an-issue"]),
  fix: z.object({
    type: z.enum(["item-text", "item-accept", "item-answer", "caution", "none"]),
    /** item-text: stem, passage, options.N, working.N, hints.N (0-based N). */
    field: z.string().max(40).nullable(),
    before: z.string().max(400).nullable(),
    after: z.string().max(400).nullable(),
    when: z.string().max(110).nullable(),
    check: z.string().max(140).nullable(),
  }),
  test: z.object({ kind: z.enum(["exact", "contains", "not-contains", "number", "judge"]), expect: z.string().max(200) }),
  confidence: z.number().min(0).max(100),
  evidence: z.array(z.string().max(240)).max(3),
  rationale: z.string().max(700),
  kidNote: z.string().max(240),
});
export type Review = z.infer<typeof reviewSchema>;
export type FixType = Review["fix"]["type"];
export type EvalTest = Review["test"];

/** The second opinion on a score change, and the judge's verdict on an eval. */
export const secondSchema = z.object({ agree: z.boolean(), confidence: z.number().min(0).max(100), reason: z.string().max(300) });
export const judgeSchema = z.object({ pass: z.boolean(), reason: z.string().max(240) });

/** One line of a case's trace, for the admin's timeline: ids, models and numbers, plus short plain words. */
export interface TraceStep {
  at: string;
  kind: "kid" | "ai" | "guard" | "report" | "case" | "decision";
  title: string;
  detail: string;
}

/** A question as the pack has it (platform content, never child data), the fields a reviewer reads. */
export interface ItemSnapshot {
  id: string;
  packId: string;
  type: string;
  stem: string;
  passage: string | null;
  options: string[] | null;
  answer: number | string;
  accept: string[] | null;
  working: string[] | null;
  hints: string[] | null;
  figure: string | null;
}

/** What a fix changed, precisely enough to show it and to revert it deterministically. */
export type FixRef =
  | {
      type: "skill-version";
      packId: string;
      versionId: string;
      version: string;
      itemId?: string;
      change?: "text" | "accept" | "answer";
      field?: string | null;
      before?: string | null;
      after?: string | null;
      /** The answer before an answer-key change. */
      previous?: string | null;
    }
  | { type: "caution"; cautionId: string; agent: string; line?: string };

export interface SynapseReport {
  id: string;
  householdId: string;
  profileId: string;
  by: "kid" | "parent";
  createdAt: string;
  updatedAt: string;
  surface: Surface;
  kind: ReportKind;
  status: ReportStatus;
  /** Ids and versions from the signed turn. */
  turn: { agent: string | null; agentVersion: number | null; packId: string | null; packVersion: string | null; itemId: string | null; level: string | null; subject: string | null; stage: string | null; species: string | null; petStage: number | null; sections: string[] };
  /** De-identified words of the reported turn only. */
  case: { shown: string | null; ask: string | null; note: string | null; answer: string | null; marked: boolean | null; item: ItemSnapshot | null };
  steps: TraceStep[];
  review: Review | null;
  reviewModel: { provider: string; model: string; fallback: string | null } | null;
  second: { agree: boolean; confidence: number; reason: string; model: string } | null;
  reproduce: { runs: number; failing: number; how: "model" | "pack" | "none" } | null;
  /** `good`: one reply that passed with the fix (de-identified; the retrain dataset's better answer). */
  retest: { before: number; after: number; runs: number; others: { passed: number; total: number } | null; good?: string | null } | null;
  checks: { name: string; ok: boolean; note: string }[];
  confidence: number | null;
  caps: string[];
  threshold: number;
  fixRef: FixRef | null;
  /** Set when an admin undid the fix: a skill fix is reverted by a new version with the inverse change. */
  undo?: { at: string; by: string; versionId: string | null; version: string | null } | null;
  /** Set when an admin overruled the reviewer: what the reviewer had said. */
  overruled?: { at: string; by: string; verdict: Review["verdict"]; kind: Review["kind"]; confidence: number } | null;
  evalCaseId: string | null;
  kidNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  duplicateOf: string | null;
  costUsd: number;
}

export interface LearnedCaution {
  id: string;
  agent: string;
  when: string;
  check: string;
  scope: { level: string | null; subject: string | null };
  status: "active" | "waiting" | "retired";
  reportIds: string[];
  evalCaseIds: string[];
  createdAt: string;
  createdBy: string;
  /** Null once an admin confirms it. */
  expiresAt: string | null;
}

export interface EvalCase {
  id: string;
  reportId: string;
  createdAt: string;
  active: boolean;
  label: string;
  target:
    | { type: "item"; packId: string; itemId: string; field: string | null; before: string | null; after: string | null; accept: string | null; answer: string | null }
    | { type: "agent"; agent: "ask-kix" | "critter-keeper"; level: string | null; question: string | null; sections: string[]; species: string | null; petStage: number | null; ask: string | null };
  test: EvalTest;
  last: { at: string; pass: boolean } | null;
}

export interface EvalRun {
  id: string;
  at: string;
  trigger: "fix" | "nightly" | "manual";
  results: { caseId: string; agent: string; pass: boolean; detail: string }[];
  passed: number;
  total: number;
  costUsd: number;
}

export interface SynapseSettings {
  on: boolean;
  /** Auto-fix at or above this computed confidence (50 to 100). */
  threshold: number;
  /** Answer keys and marking rules always wait for an admin. */
  scoringNeedsAdmin: boolean;
  /** Two or more reports of one problem may auto-fix from 95. */
  repeatSkip: boolean;
  dailyAutoCap: number;
  models: Record<ModelRole, RoleModel>;
  budgetReviewUsd: number;
  budgetEvalUsd: number;
  updatedAt: string | null;
  updatedBy: string | null;
}
