import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { QuestDoneScreen, type DoneStop } from "@/components/screens/quest-done/QuestDoneScreen";
import { cardsFromLedger } from "@/components/screens/treasure/TreasureScreen";
import { stageFromMilestones, milestonesFrom, STAGES } from "@/lib/domain/companion";
import { subskillKey } from "@/lib/domain/attempts";
import { recompute } from "@/lib/domain/mastery";
import { DAILY_CAP, pointsOnDay } from "@/lib/domain/rewards";
import { sgDate } from "@/lib/domain/time";
import { FROG_QUEST, FROG_QUEST_CARD, questCardArt, questEvidence, questStops, questSummary, sessionPicks } from "@/lib/learn/frog-quest";
import { learnContext, questData } from "@/lib/learn/server";

export const metadata: Metadata = { title: "Quest complete · myKx" };

export function generateStaticParams() {
  return [{ quest: FROG_QUEST.slug }];
}

async function Done({ params }: { params: Promise<{ quest: string }> }) {
  const { quest } = await params;
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  if (quest !== FROG_QUEST.slug) notFound();

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
  const paidToday = ledger.filter((e) => e.amount > 0 && e.day === today);
  const lastPaid = paidToday[paidToday.length - 1] ?? null;
  const card = lastPaid ? (cardsFromLedger([lastPaid], questCardArt(), FROG_QUEST_CARD)[0] ?? null) : null;
  // Each stop's mastery before today and now, out of 100 (stops with no evidence are left out).
  const pct = (events: typeof attempts) => {
    const m = events.length ? recompute(events, now).m : null;
    return m === null ? null : Math.round(m * 100);
  };
  const doneStops: DoneStop[] = FROG_QUEST.stops.flatMap((s) => {
    const item = items.find((i) => i.id === s.itemId);
    if (!item) return [];
    const mine = attempts.filter((a) => subskillKey(a) === subskillKey(item));
    if (!mine.length) return [];
    return [{ label: s.label, before: pct(mine.filter((a) => sgDate(a.at) < today)), after: pct(mine) }];
  });
  const subs = [...new Set(items.map((i) => subskillKey(i)))];
  const masteryStates = subs.map((sub) => recompute(attempts.filter((a) => subskillKey(a) === sub), now));
  const stage = stageFromMilestones(milestonesFrom(attempts, masteryStates));
  const starsToday = pointsOnDay(ledger, today);
  return (
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
  );
}

export default function DonePage({ params }: PageProps<"/learn/[quest]/done">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--surface)" }} />}>
      <Done params={params} />
    </Suspense>
  );
}
