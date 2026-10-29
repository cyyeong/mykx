import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SessionClose } from "@/components/guardian/SessionClose";
import { QuestDoneScreen, type DoneStop } from "@/components/screens/quest-done/QuestDoneScreen";
import { cardsFromLedger } from "@/components/screens/treasure/TreasureScreen";
import { stageFromMilestones, milestonesFrom, STAGES } from "@/lib/domain/companion";
import { subskillKey, type AttemptEvent } from "@/lib/domain/attempts";
import { recompute } from "@/lib/domain/mastery";
import { DAILY_CAP, pointsOnDay } from "@/lib/domain/rewards";
import { sgDate } from "@/lib/domain/time";
import { FROG_QUEST, FROG_QUEST_CARD, questCardArt, questEvidence, questStops, questSummary, sessionPicks } from "@/lib/learn/frog-quest";
import { subskillName } from "@/lib/learn/names";
import { cardForRef, rewardCards } from "@/lib/learn/reward-cards";
import { learnContext, questData, subjectData, type LearnContext } from "@/lib/learn/server";
import { parseSession, sessionSummary, subjectEvidence } from "@/lib/learn/session";
import { subjectFor } from "@/lib/learn/subjects";

export const metadata: Metadata = { title: "Session done · myKx" };

export function generateStaticParams() {
  return [{ quest: FROG_QUEST.slug }];
}

/** Each touched skill's mastery out of 100, before today and now (skills with no evidence are left out). */
function beforeAfter(keys: readonly { key: string; label: string }[], attempts: readonly AttemptEvent[], now: string, today: string): DoneStop[] {
  const pct = (events: readonly AttemptEvent[]) => {
    const m = events.length ? recompute(events, now).m : null;
    return m === null ? null : Math.round(m * 100);
  };
  return keys.flatMap(({ key, label }) => {
    const mine = attempts.filter((a) => subskillKey(a) === key);
    if (!mine.length) return [];
    return [{ label, before: pct(mine.filter((a) => sgDate(a.at) < today)), after: pct(mine) }];
  });
}

/** Mastery of every skill the kid has evidence in, any subject: Pip grows from learning anywhere. */
const allMastery = (attempts: readonly AttemptEvent[], now: string) =>
  [...new Set(attempts.map((a) => subskillKey(a)))].map((k) =>
    recompute(
      attempts.filter((a) => subskillKey(a) === k),
      now,
    ),
  );

/** A teen's own world behind the done page; juniors keep the quest map's sky. */
const BG: Record<string, string> = { "anime-sky": "/art/scenes/anime-sky-hero", "idol-stage": "/art/scenes/idol-stage-hero", terrarium: "/art/scenes/terrarium" };

async function FrogDone({ ctx }: { ctx: LearnContext }) {
  const { items, attempts, ledger } = await questData(ctx);
  const now = new Date().toISOString();
  const today = sgDate(now);
  const summary = questSummary(
    items.map((i) => i.id),
    attempts,
  );
  const sessionIds = sessionPicks(items, attempts, now, `${ctx.kidId}:${today}`)
    .map((p) => p.items[0]?.id)
    .filter((id): id is string => Boolean(id));
  const stops = questStops(FROG_QUEST.stops.map((s) => s.itemId), attempts, sessionIds);
  const complete = stops.every((s) => s.state === "mastered");
  // Only a payout on the quest's own stops (a card from another subject belongs to that subject's done page).
  const stopArt = questCardArt();
  const questKeys = new Set(items.map((i) => subskillKey(i)));
  const paidToday = ledger.filter((e) => e.amount > 0 && e.day === today && e.ref && (stopArt[e.ref] || questKeys.has(e.ref.split("#")[0])));
  const lastPaid = paidToday[paidToday.length - 1] ?? null;
  const card = lastPaid ? (cardsFromLedger([lastPaid], stopArt, FROG_QUEST_CARD)[0] ?? null) : null;
  const doneStops = beforeAfter(
    FROG_QUEST.stops.flatMap((s) => {
      const item = items.find((i) => i.id === s.itemId);
      return item ? [{ key: subskillKey(item), label: s.label }] : [];
    }),
    attempts,
    now,
    today,
  );
  const stage = stageFromMilestones(milestonesFrom(attempts, allMastery(attempts, now)));
  const starsToday = pointsOnDay(ledger, today);
  return (
    <>
      <SessionClose />
      <QuestDoneScreen
        questTitle={FROG_QUEST.title}
        questSlug={FROG_QUEST.slug}
        complete={complete}
        card={card}
        attempted={summary.attempted}
        total={summary.total}
        correct={summary.correct}
        hints={summary.hints}
        starsToday={starsToday}
        capReached={starsToday >= DAILY_CAP}
        stops={doneStops}
        stage={stage}
        stageNames={STAGES.frog}
        evidenceLabel={questEvidence(attempts).label}
      />
    </>
  );
}

async function Done({ params, searchParams }: { params: Promise<{ quest: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { quest } = await params;
  const query = await searchParams;
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  if (quest === FROG_QUEST.slug) {
    if (!subjectFor(ctx.level, FROG_QUEST.skill)) notFound();
    return <FrogDone ctx={ctx} />;
  }
  // A subject session's done page: only the kid's own subject, and only that session's items.
  const { subjects, attempts, ledger } = await subjectData(ctx);
  const subject = subjects.find((s) => s.id === quest);
  if (!subject) notFound();
  const now = new Date().toISOString();
  const today = sgDate(now);
  const ids =
    parseSession(query.session, subject) ?? [...new Set(attempts.filter((a) => a.skill === subject.id && sgDate(a.at) === today).map((a) => a.itemId))];
  const summary = sessionSummary(ids, attempts, now, subject.items);
  const want = new Set(ids);
  const items = subject.items.filter((i) => want.has(i.id));
  // A one-word skill ("Change") says its topic too ("Change (Money)").
  const labelOf = (i: (typeof items)[number]) => {
    const name = subskillName(i.subskill);
    const topic = subject.topics
      .find((t) => t.id === i.topic)
      ?.title.replace(/\s*[(（][^)）]*[)）]/gu, "")
      .trim();
    return name.includes(" ") || !topic ? name : `${name} (${topic})`;
  };
  const keys = [...new Map(items.map((i) => [subskillKey(i), { key: subskillKey(i), label: labelOf(i) }])).values()];
  // The card this session earned: today's last payout on one of its questions (or a fresh transfer in its skills).
  const cards = rewardCards(subjects, ctx.pack);
  const lookup = (ref: string) => cardForRef(ref, cards, subjects, ctx.pack);
  const keySet = new Set(keys.map((k) => k.key));
  const paid = ledger.filter((e) => e.amount > 0 && e.day === today && e.ref && (want.has(e.ref) || keySet.has(e.ref.split("#")[0])));
  const lastPaid = paid[paid.length - 1] ?? null;
  const card = lastPaid ? (cardsFromLedger([lastPaid], lookup, { art: `/art/kix/${ctx.pack}`, chip: subject.label })[0] ?? null) : null;
  const stage = stageFromMilestones(milestonesFrom(attempts, allMastery(attempts, now)));
  const starsToday = pointsOnDay(ledger, today);
  const teen = ctx.band === "teen";
  return (
    <>
      <SessionClose />
      <QuestDoneScreen
        questTitle={`${subject.label} session`}
        questSlug={subject.id}
        complete={false}
        card={card}
        attempted={summary.attempted}
        total={summary.total}
        correct={summary.correct}
        hints={summary.hints}
        starsToday={starsToday}
        capReached={starsToday >= DAILY_CAP}
        // Skills with mastery evidence only: a written answer or a retry alone moves nothing, so it has no bar.
        stops={beforeAfter(keys, attempts, now, today).filter((s) => s.before !== null || s.after !== null)}
        stage={stage}
        stageNames={STAGES.frog}
        evidenceLabel={subjectEvidence(subject.id, attempts).label}
        backHref={`/learn/${subject.id}`}
        backLabel={`Back to ${subject.name}`}
        unit={summary.total === 1 ? "question" : "questions"}
        stopsTitle="Your skills"
        showPip={!teen}
        written={summary.written}
        {...(teen ? { theme: ctx.pack, band: "teen" as const, bgArt: BG[ctx.pack] ?? "/art/scenes/quest-map", kixArt: `/art/kix/${ctx.pack}` } : {})}
      />
    </>
  );
}

export default function DonePage({ params, searchParams }: PageProps<"/learn/[quest]/done">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <Done params={params} searchParams={searchParams} />
    </Suspense>
  );
}
