// What the Learn pages show for one subject: its real topics (titles from skill.json), mastery per topic and
// subskill from the kid's own attempts, honest evidence labels, the next session code chose and why, a session per
// topic, and the gaps where a pack is thin. Every number is computed here from the learner record (rule 5); the
// screens only render it. Pure (the subject is already loaded).
import type { AttemptEvent } from "../domain/attempts.ts";
import { recompute } from "../domain/mastery.ts";
import { FROG_QUEST, questEvidence, questStops, sessionPicks } from "./frog-quest.ts";
import { topicArt } from "./reward-cards.ts";
import { planSession, startHref, subjectEvidence, topicView, type SessionPlan, type TopicView } from "./session.ts";
import { SUBJECT_NAMES, SUBJECT_ORDER, subskillName, type Subject } from "./subjects.ts";
import type { SkillItem } from "../types.ts";

export interface TopicCard extends TopicView {
  /** A session on this topic only, or null (no questions yet, or all tried this week). */
  startHref: string | null;
  /** Why there's no topic session, when there isn't one. */
  empty: string | null;
  art: string;
}

export interface NextSession {
  href: string;
  /** Questions in the session (parts count separately). */
  count: number;
  written: boolean;
  minutes: number;
  /** The first question's topic (title and id). */
  topic: string | null;
  topicId: string | null;
  /** Code's reason for the first question ("not yet assessed, a new skill for you"). */
  why: string | null;
  /** Kix's line about it, from the numbers ("Fractions first: not assessed yet."), in the teen's peer tone. */
  line: string;
  /** The same for a junior: short and warm ("Let's start with Fractions. It's new for you!"). */
  short: string;
  /** Every question is review (no new mastery evidence). */
  reviewOnly: boolean;
}

export interface FeaturedQuest {
  title: string;
  blurb: string;
  href: string;
  mastered: number;
  total: number;
  evidence: string;
}

export interface SubjectView {
  id: string;
  /** "english" | "maths" | "science" | "chinese": the emblem. */
  subject: string;
  name: string;
  label: string;
  title: string;
  level: string;
  topics: TopicCard[];
  /** Topics with any evidence, and topics that have questions. */
  started: number;
  ready: number;
  evidence: string;
  next: NextSession | null;
  /** Why there's no session right now, when there isn't one. */
  empty: string | null;
  /** An honest note when the pack is thin ("Questions for 1 of 8 topics so far."). */
  gap: string | null;
  /** P3 Science's featured quest: the frog life cycle map. */
  featured: FeaturedQuest | null;
  /** The subject's card art for the hub. */
  art: string;
  /** Questions ready in all (code-marked, written, word cards). */
  counts: { questions: number; written: number; cards: number };
}

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const n = (k: number) => (k <= 10 ? WORDS[k] : String(k));

/** Kix's line about the next session, from the numbers: the teen's (peer tone, the why) and the junior's (short). */
function nextLines(plan: SessionPlan, subject: Subject, attempts: readonly AttemptEvent[], now: string): { line: string; short: string } {
  const first = plan.picks[0];
  const lead = first?.items[0];
  const topic = lead ? (subject.topics.find((t) => t.id === lead.topic)?.title ?? subject.name) : subject.name;
  const rest = plan.itemIds.length - 1;
  const after = rest > 0 ? ` Then ${n(rest)} more${plan.written ? ", ending with one written answer" : ""}.` : "";
  const more = rest > 0 ? ` Then ${n(rest)} more.` : "";
  if (!lead) return { line: `${subject.name} is ready when you are.`, short: `${subject.name} is ready when you are.` };
  if (first.evidence === "none")
    return {
      line: `Review time: everything new in ${subject.name} was tried this week, so this round is practice (no new mastery evidence).`,
      short: `You've tried everything new this week. This round is practice!`,
    };
  const mine = attempts.filter((a) => a.skill === subject.id && a.topic === lead.topic && a.subskill === lead.subskill);
  const s = recompute(mine, now);
  const skill = subskillName(lead.subskill).toLowerCase();
  if (s.m === null) return { line: `${topic} first: ${skill} isn't assessed yet, so one fresh question starts the evidence.${after}`, short: `Let's start with ${topic}. It's new for you!${more}` };
  const m = Math.round(s.m * 100);
  return {
    line: `${topic} first: ${skill} is at ${m} with ${s.confidence === "developing" ? "developing" : "limited"} evidence, so a fresh question will show if it holds.${after}`,
    short: `Let's start with ${topic}. You're at ${m} there: one fresh try shows if it sticks.${more}`,
  };
}

function featuredFor(subject: Subject, attempts: readonly AttemptEvent[], now: string, seed: string, frogItems: readonly SkillItem[]): FeaturedQuest | null {
  if (subject.id !== FROG_QUEST.skill || !frogItems.length) return null;
  const picks = sessionPicks(frogItems, attempts, now, seed);
  const stops = questStops(
    FROG_QUEST.stops.map((s) => s.itemId),
    attempts,
    picks.map((p) => p.items[0]?.id).filter((id): id is string => Boolean(id)),
  );
  return {
    title: FROG_QUEST.title,
    blurb: FROG_QUEST.blurb,
    href: `/learn/${FROG_QUEST.slug}`,
    mastered: stops.filter((s) => s.state === "mastered").length,
    total: stops.length,
    evidence: questEvidence(attempts).label,
  };
}

/** The whole view of one subject for one kid. `seed` rotates ties (the kid and the Singapore date). */
export function subjectView(subject: Subject, attempts: readonly AttemptEvent[], now: string, seed: string, pack: string, frogItems: readonly SkillItem[] = []): SubjectView {
  const topics: TopicCard[] = subject.topics.map((t) => {
    const view = topicView(t, subject.id, subject.items, attempts, now);
    const total = view.questions + view.written + view.cards;
    const plan = total ? planSession(subject, attempts, now, seed, { topic: t.id }) : null;
    const href = plan && plan.itemIds.length ? startHref(subject.id, plan.itemIds) : null;
    return {
      ...view,
      startHref: href,
      empty: total === 0 ? "No questions yet: on the way." : href ? null : "All tried this week: back for review soon.",
      art: topicArt(subject, t.id, pack),
    };
  });
  // Topics with questions first, in the pack's own order; the ones still waiting for questions after them.
  const waiting = (t: TopicCard) => (t.questions + t.written + t.cards === 0 ? 1 : 0);
  topics.sort((a, b) => waiting(a) - waiting(b));
  const plan = planSession(subject, attempts, now, seed);
  const first = plan.picks[0]?.items[0];
  const next: NextSession | null = plan.itemIds.length
    ? {
        href: startHref(subject.id, plan.itemIds),
        count: plan.itemIds.length,
        written: plan.written,
        minutes: plan.minutes,
        topic: first ? (subject.topics.find((t) => t.id === first.topic)?.title ?? null) : null,
        topicId: first?.topic ?? null,
        why: plan.why,
        ...nextLines(plan, subject, attempts, now),
        reviewOnly: plan.fresh === 0,
      }
    : null;
  const ready = topics.filter((t) => t.questions + t.written + t.cards > 0).length;
  const gap =
    ready < topics.length
      ? ready === 1
        ? `Questions for one of ${n(topics.length)} topics so far (${topics.find((t) => t.questions + t.written + t.cards > 0)?.title}). More ${subject.level} ${subject.name} topics are on the way.`
        : `Questions for ${n(ready)} of ${n(topics.length)} topics so far. The others are on the way.`
      : null;
  const featured = featuredFor(subject, attempts, now, seed, frogItems);
  return {
    id: subject.id,
    subject: subject.subject,
    name: subject.name,
    label: subject.label,
    title: subject.title,
    level: subject.level,
    topics,
    started: topics.filter((t) => t.families > 0).length,
    ready,
    evidence: subjectEvidence(subject.id, attempts).label,
    next,
    empty: next ? null : ready ? "You've tried every question here this week. They come back for review after seven days." : "No questions yet: they're on the way.",
    gap,
    featured,
    art: featured ? "/art/cards/gecko-and-frog" : topicArt(subject, topics.find((t) => t.questions + t.written + t.cards > 0)?.id ?? "", pack),
    counts: {
      questions: topics.reduce((k, t) => k + t.questions, 0),
      written: topics.reduce((k, t) => k + t.written, 0),
      cards: topics.reduce((k, t) => k + t.cards, 0),
    },
  };
}

/** Kix's suggestion on the hub, from the numbers: a subject not started yet, else the one with most left to try. */
export function hubLine(views: readonly SubjectView[]): string {
  if (!views.length) return "Your subjects will show here as soon as they're ready.";
  const fresh = views.find((v) => v.next && v.started === 0);
  if (fresh) return `${fresh.name} hasn't been started yet. Want to try a short session?`;
  const open = views.filter((v) => v.next).sort((a, b) => a.started / Math.max(1, a.topics.length) - b.started / Math.max(1, b.topics.length));
  const pick = open[0];
  if (!pick) return "You've tried everything new this week. Questions come back for review after seven days.";
  return `${pick.name} has the most topics still to try: ${n(pick.topics.length - pick.started)} of ${n(pick.topics.length)}.`;
}

/** The school subjects myKx has packs for at some level but not yet at this kid's (an honest line on the hub). */
export function missingSubjects(have: readonly { name: string }[]): string[] {
  const names = new Set(have.map((s) => s.name));
  return SUBJECT_ORDER.map((s) => SUBJECT_NAMES[s]).filter((w) => !names.has(w));
}
