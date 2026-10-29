// A subject's practice session and its progress (founder, 29 Oct: "Start session" works for every subject).
//
// Code chooses the session with `selectNext` (lib/domain/selection.ts) over that one pack's reviewed items: the
// weakest and least-evidenced subskills first, fresh question families before review, never another pack's items.
// A session is a few code-marked questions (multiple choice, short answers and word cards) plus, when the pack has
// them, one written answer to compare with Kix's model answer (practice: open answers never move mastery until a
// grown-up confirms them, PRD FR04-05). The chosen item ids ride in the URL (`?session=a,b,c`), so the order holds
// across reloads and every page checks each id against the kid's own subject. Pure.
import { familyOf, isIndependentSuccess, subskillKey, type AttemptEvent } from "../domain/attempts.ts";
import { describeMastery, familyContributions, recompute, type MasteryState } from "../domain/mastery.ts";
import { selectNext, type PracticePick } from "../domain/selection.ts";
import { sgDate, type Iso } from "../domain/time.ts";
import type { ItemType, SkillItem, SkillTopic } from "../types.ts";
import { subskillName } from "./names.ts";

/** Item types code can mark today: they may move mastery. */
export const MARKED_TYPES: readonly ItemType[] = ["mcq", "short", "card"];
/** Code-marked questions in a session (plus one written answer when the pack has them). */
export const SESSION_MARKED = 3;
/** Most items one session URL may carry (multi-part questions add parts). */
export const SESSION_MAX_ITEMS = 12;

export interface SessionSubject {
  id: string;
  items: readonly SkillItem[];
}

export interface SessionPlan {
  packId: string;
  /** Item ids in play order (a multi-part question's parts in order). */
  itemIds: string[];
  picks: PracticePick[];
  /** Fresh questions (new evidence) and review ones (no new mastery evidence). */
  fresh: number;
  review: number;
  /** Includes a written answer (practice only). */
  written: boolean;
  /** Why code chose the first question, in a few words ("not yet assessed, a new skill for you"). */
  why: string | null;
  /** Rough length: three minutes a question, five for a written answer. */
  minutes: number;
}

/** Mastery for every subskill this subject has attempts in. */
export function masteryBySubskill(attempts: readonly AttemptEvent[], packId: string, now: Iso): Record<string, MasteryState> {
  const by = new Map<string, AttemptEvent[]>();
  for (const a of attempts) {
    if (a.skill !== packId) continue;
    const k = subskillKey(a);
    by.set(k, [...(by.get(k) ?? []), a]);
  }
  const out: Record<string, MasteryState> = {};
  for (const [k, events] of by) out[k] = recompute(events, now);
  return out;
}

const toPractice = (i: SkillItem) => ({ id: i.id, skill: i.skill, topic: i.topic, subskill: i.subskill, difficulty: i.difficulty, marks: i.marks, type: i.type, status: i.status });

/**
 * A question answered by drawing on paper (with a ruler, on the figure): it can't be answered on screen, so the
 * player never serves it. It stays in the printable papers (/me/papers).
 */
export function needsPaper(item: Pick<SkillItem, "type" | "stem" | "answer">): boolean {
  return item.type === "open" && (/\buse a ruler\b|\bdraw a (straight )?line\b/i.test(item.stem) || /^see the\b/i.test(String(item.answer)));
}

/** Reviewed items the player can serve. */
export const playable = (item: SkillItem) => item.status === "reviewed" && !needsPaper(item);

/**
 * The next session for one subject (optionally one topic): up to three code-marked questions chosen by
 * `selectNext`, then one written answer when there is one whose family isn't already in the session. `seed` rotates
 * ties deterministically (the kid and the Singapore date).
 */
export function planSession(subject: SessionSubject, attempts: readonly AttemptEvent[], now: Iso, seed: string, opts: { topic?: string | null } = {}): SessionPlan {
  const items = subject.items.filter((i) => i.skill === subject.id && playable(i) && (!opts.topic || i.topic === opts.topic));
  const mine = attempts.filter((a) => a.skill === subject.id);
  const mastery = masteryBySubskill(mine, subject.id, now);
  const history = mine.map((a) => ({ itemId: a.itemId, family: a.family, skill: a.skill, topic: a.topic, subskill: a.subskill, at: a.at }));
  const base = { course: subject.id, items: items.map(toPractice), mastery, history, now, seed, ...(opts.topic ? { selectedTopics: [opts.topic] } : {}) };

  const marked = selectNext({ ...base, types: MARKED_TYPES, count: SESSION_MARKED });
  const picks = [...marked.picks];
  const families = new Set(picks.map((p) => p.family));
  // A topic with only written questions (some Chinese sentence work) gets two of them; otherwise one at the end.
  const wantWritten = picks.length ? 1 : 2;
  // Code's order, but a short written question (one or two parts) before a long one, so a session stays short.
  const candidates = selectNext({ ...base, types: ["open"], count: wantWritten + 4 }).picks.filter((p) => !families.has(p.family));
  const written = [...candidates.filter((p) => p.items.length <= 2), ...candidates.filter((p) => p.items.length > 2)].slice(0, wantWritten);
  picks.push(...written);

  const itemIds: string[] = [];
  for (const p of picks) for (const i of p.items) if (itemIds.length < SESSION_MAX_ITEMS) itemIds.push(i.id);
  const first = picks[0];
  const why = first ? [...new Set(first.strongest.map((s) => s.reason))].slice(0, 2).join(", ") || null : null;
  const byId = new Map(items.map((i) => [i.id, i]));
  const minutes = itemIds.reduce((n, id) => n + (byId.get(id)?.type === "open" ? 5 : byId.get(id)?.type === "card" ? 1 : 3), 0);
  return {
    packId: subject.id,
    itemIds,
    picks,
    fresh: picks.filter((p) => p.evidence === "new").length,
    review: picks.filter((p) => p.evidence === "none").length,
    written: written.length > 0,
    why,
    minutes: Math.max(1, minutes),
  };
}

/** `?session=a,b,c` → the ids that belong to this subject, in order, without repeats; null when none do. */
export function parseSession(raw: string | string[] | undefined | null, subject: SessionSubject): string[] | null {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (!text) return null;
  const known = new Set(subject.items.map((i) => i.id));
  const ids: string[] = [];
  for (const id of text.split(",")) {
    const t = id.trim();
    if (t && known.has(t) && !ids.includes(t)) ids.push(t);
    if (ids.length >= SESSION_MAX_ITEMS) break;
  }
  return ids.length ? ids : null;
}

export const sessionQuery = (ids: readonly string[]) => `session=${ids.join(",")}`;

/** Where Start session goes: the first question, carrying the session. */
export function startHref(packId: string, ids: readonly string[]): string {
  return ids.length ? `/question/${ids[0]}?${sessionQuery(ids)}` : `/learn/${packId}`;
}

/** The player's place in a session: position, the next question or the done page. */
export function sessionStep(packId: string, ids: readonly string[], currentId: string): { position: number; total: number; doneCount: number; nextHref: string; nextId: string | null } {
  const at = ids.indexOf(currentId);
  const index = at < 0 ? 0 : at;
  const nextId = at >= 0 && at + 1 < ids.length ? ids[at + 1] : null;
  return {
    position: index + 1,
    total: Math.max(ids.length, 1),
    doneCount: index,
    nextId,
    nextHref: nextId ? `/question/${nextId}?${sessionQuery(ids)}` : `/learn/${packId}/done?${sessionQuery(ids)}`,
  };
}

export interface TopicView {
  id: string;
  title: string;
  /** Average of the assessed subskills' mastery, 0-100; null when none is assessed. */
  mastery: number | null;
  /** Honest label: "Not yet assessed", "Limited evidence · 2 families", "Developing evidence · 6 families". */
  evidence: string;
  families: number;
  assessed: number;
  /** Each skill: its name, mastery 0-100 (null until assessed) and honest label ("57/100; limited evidence: …"). */
  subskills: { id: string; name: string; mastery: number | null; label: string }[];
  /** Reviewed items in this topic by kind. */
  questions: number;
  written: number;
  cards: number;
}

/** A topic's rings and labels from the kid's own attempts (counts and the PRD §6 index only, never a guess). */
export function topicView(topic: SkillTopic, packId: string, items: readonly SkillItem[], attempts: readonly AttemptEvent[], now: Iso): TopicView {
  const mine = attempts.filter((a) => a.skill === packId && a.topic === topic.id);
  const subskills = topic.subskills.map((id) => {
    const s = recompute(
      mine.filter((a) => a.subskill === id),
      now,
    );
    return { id, name: subskillName(id), mastery: s.m === null ? null : Math.round(s.m * 100), label: describeMastery(s) };
  });
  const assessed = subskills.filter((s) => s.mastery !== null);
  const contributions = familyContributions(mine);
  const families = new Set(contributions.map((c) => c.family)).size;
  const dates = new Set(contributions.map((c) => c.date)).size;
  const evidence =
    families === 0 ? "Not yet assessed" : families < 5 || dates < 2 ? `Limited evidence · ${families} ${families === 1 ? "family" : "families"}` : `Developing evidence · ${families} families`;
  const here = items.filter((i) => i.topic === topic.id && playable(i));
  return {
    id: topic.id,
    title: topic.title,
    mastery: assessed.length ? Math.round(assessed.reduce((n, s) => n + (s.mastery ?? 0), 0) / assessed.length) : null,
    evidence,
    families,
    assessed: assessed.length,
    subskills,
    questions: here.filter((i) => i.type === "mcq" || i.type === "short").length,
    written: here.filter((i) => i.type === "open").length,
    cards: here.filter((i) => i.type === "card").length,
  };
}

/** Subject-wide evidence tone, like the frog quest's: counts only, never a score. */
export function subjectEvidence(packId: string, attempts: readonly AttemptEvent[]): { families: number; label: string } {
  const c = familyContributions(attempts.filter((a) => a.skill === packId));
  const n = new Set(c.map((x) => x.family)).size;
  const dates = new Set(c.map((x) => x.date)).size;
  const label = n === 0 ? "No evidence yet: your first session starts it." : n < 5 || dates < 2 ? `Limited evidence: ${n} question ${n === 1 ? "family" : "families"} so far.` : `Developing evidence: ${n} question families.`;
  return { families: n, label };
}

export interface SessionSummary {
  total: number;
  attempted: number;
  /** Right on the first try, code-marked, no hint and no reveal. */
  correct: number;
  hints: number;
  /** Written answers saved as practice. */
  written: number;
}

/** What the done page shows for one session: today's attempts on its items. */
export function sessionSummary(ids: readonly string[], attempts: readonly AttemptEvent[], now: Iso, items: readonly SkillItem[]): SessionSummary {
  const want = new Set(ids);
  const today = sgDate(now);
  const mine = attempts.filter((a) => want.has(a.itemId) && sgDate(a.at) === today);
  const byItem = new Map<string, AttemptEvent[]>();
  for (const a of mine) byItem.set(a.itemId, [...(byItem.get(a.itemId) ?? []), a]);
  const types = new Map(items.map((i) => [i.id, i.type]));
  let correct = 0;
  let hints = 0;
  let written = 0;
  for (const [id, events] of byItem) {
    if (events.some((e) => e.firstTry && isIndependentSuccess(e))) correct += 1;
    hints += Math.max(...events.map((e) => e.hintsBeforeSubmit));
    if (types.get(id) === "open") written += 1;
  }
  return { total: ids.length, attempted: byItem.size, correct, hints, written };
}

/** The question families of a session (for "fresh" chips and tests). */
export const sessionFamilies = (ids: readonly string[]) => [...new Set(ids.map((id) => familyOf({ id })))];
