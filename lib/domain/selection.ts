// Practice priority and the next three questions (PRD §6):
//
//   eligible = approved questions matching year, syllabus, level, course, combination
//   exclude families practised within 7 days; never cross course to fill a gap
//   W = 1-mastery_or_0.5
//   C = 1 selected curriculum topic; 0.5 reviewed prerequisite; otherwise 0
//   A = in_uploaded_scope * clamp(1-days_to_assessment/30,0,1); absent scope = 0
//   D = min(days_since_practice/7,1); unseen = 0.5
//   H = 1 if estimated difficulty matches next challenge band; otherwise 0.3
//   priority = .35*W + .20*C + .20*A + .15*D + .10*H
//   choose 3 diverse families; reserve one cold-start probe when available
//
// Decisions where §6 is silent (see docs/plan/soak-report.md):
// - A course is one skill pack (it fixes year, syllabus, level and subject).
// - The unit of choice is a question: all its approved parts are served together.
// - W, D and H are per subskill (D per family would always be 1 after the 7-day exclusion).
// - Fresh families (never attempted) come first, because only a family's earliest attempt is
//   evidence. A family seen more than 7 days ago is "delayed review" and is offered only when
//   fresh ones run out, labelled "no new mastery evidence".
// - "Diverse": distinct families and at most two questions from one subskill per session.
// - Ties break on a hash of (seed, question), so a daily seed rotates equal picks without randomness.
import { type AttemptEvent, OBJECTIVE_TYPES, type PracticeItem, familyOf, questionOf, subskillKey } from "./attempts.ts";
import { type Band, type MasteryState, bandOf } from "./mastery.ts";
import { type Iso, clamp, daysBetween, sgDaysBetween, toMs } from "./time.ts";
import type { ItemType } from "../types.ts";

export const WEIGHTS = { W: 0.35, C: 0.2, A: 0.2, D: 0.15, H: 0.1 } as const;
export const EXCLUDE_DAYS = 7;
export const ASSESSMENT_HORIZON_DAYS = 30;
export const H_MISMATCH = 0.3;
export const UNSEEN_D = 0.5;
export const SESSION_SIZE = 3;
export const MAX_PER_SUBSKILL = 2;
export const NO_NEW_EVIDENCE = "no new mastery evidence";

export type Factor = keyof typeof WEIGHTS;
export type Factors = Record<Factor, number>;

/** §6 calls every weight a tunable MVP heuristic; the defaults are the PRD's. */
export interface Tuning {
  weights?: Partial<Factors>;
  /** D for a subskill never practised (PRD: 0.5). */
  unseenD?: number;
  /** H when the difficulty misses the challenge band (PRD: 0.3). */
  hMismatch?: number;
  /** Reserve one slot for a cold-start probe (PRD: yes). */
  reserveProbe?: boolean;
}

export interface Assessment {
  /** The test or exam date. */
  date: Iso;
  /** Topic ids in the uploaded scope. No scope means A = 0. */
  topics: string[];
}

export interface SelectionRequest {
  /** The course: one skill pack id. Items from any other pack are never chosen. */
  course: string;
  items: readonly PracticeItem[];
  /** Mastery by subskillKey; missing means not yet assessed. */
  mastery: Readonly<Record<string, MasteryState | undefined>>;
  /** Every attempt this learner has made in the course (retries and reveals included). */
  history: readonly Pick<AttemptEvent, "itemId" | "family" | "skill" | "topic" | "subskill" | "at">[];
  now: Iso;
  selectedTopics?: readonly string[];
  prerequisiteTopics?: readonly string[];
  assessment?: Assessment;
  /** Item types to serve. Default: objective types only, which can move mastery today. */
  types?: readonly ItemType[];
  count?: number;
  maxPerSubskill?: number;
  /** Rotates ties deterministically (e.g. learner id + Singapore date). */
  seed?: string;
  tuning?: Tuning;
}

export type PickKind = "fresh" | "probe" | "review";

export interface PracticePick {
  /** The question id; `items` are its parts in order (one item for most questions). */
  question: string;
  family: string;
  items: PracticeItem[];
  subskill: string;
  kind: PickKind;
  /** Only a fresh family's first attempt is mastery evidence. */
  evidence: "new" | "none";
  label?: typeof NO_NEW_EVIDENCE;
  priority: number;
  factors: Factors;
  /** Weighted factors, largest first: what the UI uses to explain the pick. */
  strongest: { factor: Factor; value: number; reason: string }[];
}

export interface SelectionResult {
  picks: PracticePick[];
  /** No fresh family left in the course: everything offered is delayed review. */
  exhausted: boolean;
  freshQuestions: number;
  reviewQuestions: number;
  /** Families held back because they were practised within 7 days. */
  excludedRecent: number;
}

interface Candidate {
  question: string;
  family: string;
  items: PracticeItem[];
  lead: PracticeItem;
  key: string;
  /** The subskill has been practised before. */
  seen: boolean;
  fresh: boolean;
  probe: boolean;
  priority: number;
  factors: Factors;
  tie: number;
}

/** Item difficulty 1–5 as a band: 1–2 easy, 3 medium, 4–5 harder. */
export function difficultyBand(d: number): Band {
  return d <= 2 ? "easy" : d === 3 ? "medium" : "harder";
}

/** FNV-1a, for deterministic tie-breaks. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function weightsOf(tuning?: Tuning): Factors {
  return { ...WEIGHTS, ...tuning?.weights };
}

export function priorityOf(f: Factors, tuning?: Tuning): number {
  const w = weightsOf(tuning);
  return w.W * f.W + w.C * f.C + w.A * f.A + w.D * f.D + w.H * f.H;
}

/** The five factors for one question, given its subskill's state. */
export function factorsFor(
  item: Pick<PracticeItem, "topic" | "difficulty">,
  ctx: {
    mastery: MasteryState | undefined;
    lastPractised: Iso | null;
    now: Iso;
    selectedTopics?: readonly string[];
    prerequisiteTopics?: readonly string[];
    assessment?: Assessment;
    tuning?: Tuning;
  },
): Factors {
  const m = ctx.mastery?.m ?? null;
  const W = 1 - (m ?? 0.5);
  const C = ctx.selectedTopics?.includes(item.topic) ? 1 : ctx.prerequisiteTopics?.includes(item.topic) ? 0.5 : 0;
  let A = 0;
  if (ctx.assessment && ctx.assessment.topics.includes(item.topic)) {
    const days = sgDaysBetween(ctx.now, ctx.assessment.date);
    A = days < 0 ? 0 : clamp(1 - days / ASSESSMENT_HORIZON_DAYS, 0, 1);
  }
  const D = ctx.lastPractised === null ? (ctx.tuning?.unseenD ?? UNSEEN_D) : clamp(daysBetween(ctx.lastPractised, ctx.now) / EXCLUDE_DAYS, 0, 1);
  const H = difficultyBand(item.difficulty) === bandOf(m) ? 1 : (ctx.tuning?.hMismatch ?? H_MISMATCH);
  return { W, C, A, D, H };
}

function reasonFor(
  f: Factor,
  factors: Factors,
  c: { mastery: MasteryState | undefined; seen: boolean; assessment?: Assessment; now: Iso },
): string {
  switch (f) {
    case "W":
      return c.mastery?.m == null ? "not yet assessed" : `needs practice (mastery ${Math.round(c.mastery.m * 100)}/100)`;
    case "C":
      return factors.C >= 1 ? "today's topic" : "builds towards today's topic";
    case "A":
      return c.assessment ? `test in ${Math.max(0, sgDaysBetween(c.now, c.assessment.date))} days` : "upcoming test";
    case "D":
      return c.seen ? "due for spaced practice" : "a new skill for you";
    case "H":
      return factors.H >= 1 ? "right level of challenge" : "a change of level";
  }
}

/** Chooses the next session's questions. Pure: same request, same picks. */
export function selectNext(req: SelectionRequest): SelectionResult {
  const count = req.count ?? SESSION_SIZE;
  const maxPer = req.maxPerSubskill ?? MAX_PER_SUBSKILL;
  const types = req.types ?? OBJECTIVE_TYPES;
  const now = toMs(req.now);

  // Never cross course; approved items only.
  const items = req.items.filter((i) => i.skill === req.course && i.status === "reviewed" && types.includes(i.type));

  // When each family and each subskill was last practised (any submission counts). A timestamp
  // after `now` (clock skew) counts as just practised, so the 7-day exclusion errs on the safe side.
  const familyLast = new Map<string, number>();
  const subskillLast = new Map<string, number>();
  for (const h of req.history) {
    if (h.skill !== req.course) continue;
    const t = toMs(h.at);
    if (!Number.isFinite(t)) continue;
    familyLast.set(h.family, Math.max(familyLast.get(h.family) ?? -Infinity, t));
    const k = subskillKey(h);
    subskillLast.set(k, Math.max(subskillLast.get(k) ?? -Infinity, t));
  }

  // Group parts into questions.
  const questions = new Map<string, PracticeItem[]>();
  for (const i of items) {
    const q = questionOf(i);
    const list = questions.get(q);
    if (list) list.push(i);
    else questions.set(q, [i]);
  }

  const candidates: Candidate[] = [];
  const recentFamilies = new Set<string>();
  for (const [question, parts] of questions) {
    parts.sort((a, b) => a.id.localeCompare(b.id));
    const lead = parts[0];
    const family = familyOf(lead);
    const last = familyLast.get(family);
    if (last !== undefined && (now - last) / 86_400_000 < EXCLUDE_DAYS) {
      recentFamilies.add(family);
      continue;
    }
    const key = subskillKey(lead);
    const mastery = req.mastery[key];
    const sLast = subskillLast.get(key);
    const factors = factorsFor(lead, {
      mastery,
      lastPractised: sLast === undefined ? null : new Date(sLast).toISOString(),
      now: req.now,
      selectedTopics: req.selectedTopics,
      prerequisiteTopics: req.prerequisiteTopics,
      assessment: req.assessment,
      tuning: req.tuning,
    });
    const priority = priorityOf(factors, req.tuning);
    if (!Number.isFinite(priority)) continue;
    candidates.push({
      question,
      family,
      items: parts,
      lead,
      key,
      seen: sLast !== undefined,
      fresh: last === undefined,
      probe: last === undefined && (mastery?.m ?? null) === null,
      priority,
      factors,
      tie: hash(`${req.seed ?? ""}|${question}`),
    });
  }

  const order = (a: Candidate, b: Candidate) => b.priority - a.priority || a.tie - b.tie || a.question.localeCompare(b.question);
  const fresh = candidates.filter((c) => c.fresh).sort(order);
  const review = candidates.filter((c) => !c.fresh).sort(order);

  const chosen: Candidate[] = [];
  const families = new Set<string>();
  const perSubskill = new Map<string, number>();
  const fits = (c: Candidate, cap: number) => !families.has(c.family) && (perSubskill.get(c.key) ?? 0) < cap;
  const take = (c: Candidate) => {
    chosen.push(c);
    families.add(c.family);
    perSubskill.set(c.key, (perSubskill.get(c.key) ?? 0) + 1);
  };
  const fill = (pool: Candidate[], until: number) => {
    // First pass keeps subskills diverse; a second pass relaxes that cap rather than serve fewer.
    for (const cap of [maxPer, Infinity]) {
      for (const c of pool) {
        if (chosen.length >= until) return;
        if (fits(c, cap)) take(c);
      }
    }
  };

  // Reserve one cold-start probe: if the best fresh questions hold no probe, the last slot goes to one.
  const reserve = count >= 2 && req.tuning?.reserveProbe !== false;
  fill(fresh, reserve ? count - 1 : count);
  const bestProbe = fresh.find((c) => c.probe && fits(c, maxPer)) ?? fresh.find((c) => c.probe && fits(c, Infinity));
  if (reserve && chosen.length < count && !chosen.some((c) => c.probe) && bestProbe) take(bestProbe);
  fill(fresh, count);
  fill(review, count);

  const weights = weightsOf(req.tuning);
  const picks: PracticePick[] = chosen.map((c) => {
    const kind: PickKind = !c.fresh ? "review" : c.probe ? "probe" : "fresh";
    const strongest = (Object.keys(WEIGHTS) as Factor[])
      .map((factor) => ({ factor, value: weights[factor] * c.factors[factor] }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 2)
      .map((x) => ({ ...x, reason: reasonFor(x.factor, c.factors, { mastery: req.mastery[c.key], seen: c.seen, assessment: req.assessment, now: req.now }) }));
    return {
      question: c.question,
      family: c.family,
      items: c.items,
      subskill: c.key,
      kind,
      evidence: c.fresh ? "new" : "none",
      ...(c.fresh ? {} : { label: NO_NEW_EVIDENCE }),
      priority: c.priority,
      factors: c.factors,
      strongest,
    };
  });

  return {
    picks,
    exhausted: fresh.length === 0,
    freshQuestions: fresh.length,
    reviewQuestions: review.length,
    excludedRecent: recentFamilies.size,
  };
}
