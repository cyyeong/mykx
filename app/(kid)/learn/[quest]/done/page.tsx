import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { QuestDoneScreen, type DoneLine } from "@/components/screens/quest-done/QuestDoneScreen";
import { cardsFromLedger } from "@/components/screens/treasure/TreasureScreen";
import { stageFromMilestones, milestonesFrom, STAGES } from "@/lib/domain/companion";
import { subskillKey } from "@/lib/domain/attempts";
import { describeMastery, recompute } from "@/lib/domain/mastery";
import { DAILY_CAP, pointsOnDay } from "@/lib/domain/rewards";
import { sgDate } from "@/lib/domain/time";
import { FROG_QUEST, questEvidence, questStops, questSummary, sessionPicks } from "@/lib/learn/frog-quest";
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
  const labels = Object.fromEntries(FROG_QUEST.stops.map((s) => [s.itemId, s.label]));
  const card = lastPaid ? (cardsFromLedger([lastPaid], labels)[0] ?? null) : null;
  // Mastery before today vs now, per subskill touched in this quest.
  const subs = [...new Set(items.map((i) => subskillKey(i)))];
  const labelOf = (sub: string) => FROG_QUEST.stops.find((s) => items.find((i) => i.id === s.itemId && subskillKey(i) === sub))?.label ?? sub;
  const lines: DoneLine[] = subs.flatMap((sub) => {
    const mine = attempts.filter((a) => subskillKey(a) === sub);
    if (!mine.length) return [];
    const before = mine.filter((a) => sgDate(a.at) < today);
    return [{ label: labelOf(sub), before: describeMastery(recompute(before, now)), after: describeMastery(recompute(mine, now)) }];
  });
  const masteryStates = subs.map((sub) => recompute(attempts.filter((a) => subskillKey(a) === sub), now));
  const stage = stageFromMilestones(milestonesFrom(attempts, masteryStates));
  const names = STAGES.frog;
  const pipLine = stage >= names.length - 1 ? `Pip is a ${names[stage]}!` : `Pip is a ${names[stage]}. Next: ${names[stage + 1]}.`;
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
      lines={lines}
      pipLine={pipLine}
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
