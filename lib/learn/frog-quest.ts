// Ari's quest: the P3 frog life cycle (HANDOFF task 2, founder decision 28 Oct).
//
// The map stops and the questions come from the reviewed P3 Science life-cycles
// items (`content/skills/p3-science/items/demo.json`) through `selectNext`
// (lib/domain/selection.ts). Pure except `loadFrogItems`, which reads the pack
// from disk like lib/print/bank.ts (server only: node:fs).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { familyOf, isIndependentSuccess, subskillKey, type AttemptEvent } from "../domain/attempts.ts";
import { familyContributions, recompute } from "../domain/mastery.ts";
import { selectNext, type PracticePick } from "../domain/selection.ts";
import type { Iso } from "../domain/time.ts";
import { SkillItemSchema } from "../skills/schema.ts";
import type { SkillItem } from "../types.ts";

export const FROG_QUEST = {
  slug: "frog-life-cycle",
  title: "The frog life cycle",
  blurb: "Follow Pip from frogspawn to frog.",
  skill: "p3-science",
  /** Pack version the items came from (skill.json); stored on every attempt. */
  version: "1.0.0",
  topics: ["cycles.animal"] as const,
  /** Subject chip on the quest's reward cards. */
  chip: "P3 Science",
  /** One stop per reviewed frog item, easiest first. Labels are the quest's own; `card` is the stop's reward-card art. */
  stops: [
    { itemId: "p3sci-demo-01", label: "Order the stages", card: "/art/cards/gecko-and-frog" },
    { itemId: "p3sci-demo-02", label: "Pip the tadpole", card: "/art/cards/gecko-and-frog" },
    { itemId: "p3sci-demo-03", label: "Frog and mosquito", card: "/art/cards/gecko-and-frog" },
    { itemId: "p3sci-demo-04", label: "No first or last", card: "/art/cards/gecko-and-frog" },
    { itemId: "p3sci-demo-05", label: "How long as a tadpole", card: "/art/cards/gecko-and-frog" },
  ] as const,
};

/** The quest's card defaults, for ledger entries that aren't tied to one stop. */
export const FROG_QUEST_CARD = { art: "/art/cards/gecko-and-frog", chip: FROG_QUEST.chip };

/** What a reward card shows for each stop (Treasure, the question's reward panel, the done page). */
export function questCardArt(): Record<string, { label: string; art: string }> {
  return Object.fromEntries(FROG_QUEST.stops.map((s) => [s.itemId, { label: s.label, art: s.card }]));
}

export type QuestStopState = "mastered" | "current" | "next" | "locked";

export interface QuestStop {
  itemId: string;
  label: string;
  state: QuestStopState;
}

/** Reviewed frog items, easiest first. Empty when the pack file is missing. */
export function loadFrogItems(): SkillItem[] {
  const path = join(process.cwd(), "content", "skills", "p3-science", "items", "demo.json");
  if (!existsSync(path)) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const items: SkillItem[] = [];
  for (const entry of raw) {
    const parsed = SkillItemSchema.safeParse(entry);
    if (!parsed.success) continue;
    const item = parsed.data as SkillItem;
    if (item.status !== "reviewed" || item.skill !== FROG_QUEST.skill) continue;
    if (!(FROG_QUEST.topics as readonly string[]).includes(item.topic)) continue;
    items.push(item);
  }
  return items.sort((a, b) => a.difficulty - b.difficulty || (a.id < b.id ? -1 : 1));
}

/** Families with an independent success (the evidence mastery reads). */
/** Right on the first try, with no hint and no reveal: the only success a stop counts (a retry never does). */
function firstTrySuccess(a: AttemptEvent): boolean {
  return a.firstTry && isIndependentSuccess(a);
}

function masteredFamilies(attempts: readonly AttemptEvent[]): Set<string> {
  return new Set(attempts.filter(firstTrySuccess).map((a) => a.family));
}

/**
 * One stop per quest item, agreeing with today's session: the highlighted
 * stop, Kix's line and the first question are all the session's first open
 * pick, and a session never starts on a locked stop. Mastered needs an
 * independent success, never a retry; `next` is the session's second open
 * pick; anything outside today's session stays locked until its turn.
 */
export function questStops(
  itemIds: readonly string[],
  attempts: readonly AttemptEvent[],
  sessionIds: readonly string[] = [],
): QuestStop[] {
  const mastered = masteredFamilies(attempts);
  const labels = new Map<string, string>(FROG_QUEST.stops.map((s) => [s.itemId, s.label]));
  const open = sessionIds.filter((id) => !mastered.has(familyOf({ id })));
  const fallback = itemIds.find((id) => !mastered.has(familyOf({ id })));
  const current = open[0] ?? fallback ?? null;
  const next = open[1] ?? null;
  return itemIds.map((itemId) => {
    let state: QuestStopState;
    if (mastered.has(familyOf({ id: itemId }))) state = "mastered";
    else if (itemId === current) state = "current";
    else if (itemId === next) state = "next";
    else state = "locked";
    return { itemId, label: labels.get(itemId) ?? itemId, state };
  });
}

export interface PracticeHistory {
  itemId: string;
  family: string;
  skill: string;
  topic: string;
  subskill: string;
  at: Iso;
}

function toHistory(attempts: readonly AttemptEvent[]): PracticeHistory[] {
  return attempts.map((a) => ({ itemId: a.itemId, family: a.family, skill: a.skill, topic: a.topic, subskill: a.subskill, at: a.at }));
}

/**
 * Today's session: up to three questions from the frog items through
 * `selectNext` (fresh families first; delayed review labelled "no new
 * mastery evidence"). `seed` rotates ties deterministically.
 */
export function sessionPicks(
  items: readonly SkillItem[],
  attempts: readonly AttemptEvent[],
  now: Iso,
  seed: string,
): PracticePick[] {
  const bySubskill = new Map<string, AttemptEvent[]>();
  for (const a of attempts) {
    const key = subskillKey(a);
    bySubskill.set(key, [...(bySubskill.get(key) ?? []), a]);
  }
  const mastery: Record<string, ReturnType<typeof recompute> | undefined> = {};
  for (const [key, events] of bySubskill) mastery[key] = recompute(events, now);
  const result = selectNext({
    course: FROG_QUEST.skill,
    items: items.map((item) => ({
      id: item.id,
      skill: item.skill,
      topic: item.topic,
      subskill: item.subskill,
      difficulty: item.difficulty,
      marks: item.marks,
      type: item.type,
      status: item.status,
    })),
    mastery,
    history: toHistory(attempts),
    now,
    selectedTopics: [...FROG_QUEST.topics],
    types: ["mcq", "short"],
    count: 3,
    seed,
  });
  return result.picks;
}

/**
 * The next session pick without evidence yet (skipping the just-finished
 * item). Null when the session is done: the player goes to the
 * quest-complete page.
 */
export function nextPickId(picks: readonly PracticePick[], attempts: readonly AttemptEvent[], currentItemId: string): string | null {
  const done = new Set(attempts.map((a) => a.family));
  for (const pick of picks) {
    if (pick.items.some((i) => i.id === currentItemId)) continue;
    if (pick.items.every((i) => done.has(familyOf({ id: i.id, family: i.family })))) continue;
    return pick.items[0].id;
  }
  return null;
}

export interface QuestEvidence {
  /** Distinct families with evidence behind the quest. */
  families: number;
  /** Distinct Singapore dates behind the quest. */
  dates: number;
  /** Honest label, e.g. "Limited evidence: two question families". */
  label: string;
}

/** Quest-wide evidence tone for the map and Treasure: counts only, never a score. */
export function questEvidence(attempts: readonly AttemptEvent[]): QuestEvidence {
  const mine = attempts.filter((a) => a.skill === FROG_QUEST.skill && (FROG_QUEST.topics as readonly string[]).includes(a.topic));
  const families = new Set<string>();
  const dates = new Set<string>();
  for (const c of familyContributions(mine)) {
    families.add(c.family);
    dates.add(c.date);
  }
  const n = families.size;
  const label =
    n === 0
      ? "No evidence yet — today's quest will be the first."
      : n < 5 || dates.size < 2
        ? `Limited evidence: ${n === 1 ? "one" : n === 2 ? "two" : n === 3 ? "three" : n === 4 ? "four" : `${n}`} question ${n === 1 ? "family" : "families"} so far.`
        : `Developing evidence: ${n} question families.`;
  return { families: n, dates: dates.size, label };
}

export interface QuestSummary {
  total: number;
  attempted: number;
  correct: number;
  hints: number;
}

/** Session summary for the quest-complete page, from attempts on quest items. */
export function questSummary(itemIds: readonly string[], attempts: readonly AttemptEvent[]): QuestSummary {
  const ids = new Set(itemIds);
  const mine = attempts.filter((a) => ids.has(a.itemId));
  const byFamily = new Map<string, AttemptEvent[]>();
  for (const a of mine) byFamily.set(a.family, [...(byFamily.get(a.family) ?? []), a]);
  let correct = 0;
  let hints = 0;
  for (const events of byFamily.values()) {
    if (events.some(firstTrySuccess)) correct += 1;
    hints += Math.max(...events.map((e) => e.hintsBeforeSubmit));
  }
  return { total: ids.size, attempted: byFamily.size, correct, hints };
}
