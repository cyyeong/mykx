// Ari's quest: the P3 frog life cycle (HANDOFF task 2, founder decision 28 Oct).
//
// The map stops and the questions come from the reviewed P3 Science life-cycles
// items (`content/skills/p3-science/items/demo.json`) through `selectNext`
// (lib/domain/selection.ts). Pure except `loadFrogItems`, which reads the pack
// from disk like lib/print/bank.ts (server only: node:fs).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { familyOf, isIndependentSuccess, subskillKey, type AttemptEvent } from "../domain/attempts.ts";
import { recompute } from "../domain/mastery.ts";
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
  /** One stop per reviewed frog item, easiest first. Labels are the quest's own. */
  stops: [
    { itemId: "p3sci-demo-01", label: "Order the stages" },
    { itemId: "p3sci-demo-02", label: "Pip the tadpole" },
    { itemId: "p3sci-demo-03", label: "Frog and mosquito" },
    { itemId: "p3sci-demo-04", label: "No first or last" },
    { itemId: "p3sci-demo-05", label: "How long as a tadpole" },
  ] as const,
};

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
function masteredFamilies(attempts: readonly AttemptEvent[]): Set<string> {
  return new Set(attempts.filter(isIndependentSuccess).map((a) => a.family));
}

/**
 * One stop per quest item: mastered with fresh evidence, current where the
 * child is now, next after that, locked beyond. Deterministic and honest:
 * a stop is mastered only on an independent success, never on a retry.
 */
export function questStops(itemIds: readonly string[], attempts: readonly AttemptEvent[]): QuestStop[] {
  const mastered = masteredFamilies(attempts);
  const labels = new Map<string, string>(FROG_QUEST.stops.map((s) => [s.itemId, s.label]));
  const currentIdx = itemIds.findIndex((id) => !mastered.has(familyOf({ id })));
  return itemIds.map((itemId, i) => {
    let state: QuestStopState;
    if (mastered.has(familyOf({ id: itemId }))) state = "mastered";
    else if (i === currentIdx) state = "current";
    else if (i === currentIdx + 1) state = "next";
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
    if (events.some(isIndependentSuccess)) correct += 1;
    hints += Math.max(...events.map((e) => e.hintsBeforeSubmit));
  }
  return { total: ids.size, attempted: byFamily.size, correct, hints };
}
