import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KidGate } from "@/components/auth/KidGate";
import { TreasureScreen, cardsFromLedger } from "@/components/screens/treasure/TreasureScreen";
import { totalPoints, pointsOnDay } from "@/lib/domain/rewards";
import { sgDate } from "@/lib/domain/time";
import { FROG_QUEST, FROG_QUEST_CARD, loadFrogItems, questEvidence, questStops, sessionPicks } from "@/lib/learn/frog-quest";
import { cardForRef, rewardCards } from "@/lib/learn/reward-cards";
import { learnContext, subjectData } from "@/lib/learn/server";
import { subjectView } from "@/lib/learn/views";

export const metadata: Metadata = { title: "Treasure Realm · myKx" };

// Cards from the ledger (any of the kid's subjects, each with its subject chip), the constellation from fresh
// evidence: the frog quest's stops for a P3 kid, else the first subject's topics (task 2; scoped 29 Oct).
async function Treasure() {
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  const { subjects, attempts, ledger } = await subjectData(ctx);
  const now = new Date().toISOString();
  const seed = `${ctx.kidId}:${sgDate(now)}`;
  const cards = rewardCards(subjects, ctx.pack);
  const lookup = (ref: string) => cardForRef(ref, cards, subjects, ctx.pack);
  const p3 = subjects.some((s) => s.id === FROG_QUEST.skill);
  let quest: { href: string; title: string; evidence: string; nodes: { label: string; lit: boolean; current: boolean }[] };
  if (p3) {
    const picks = sessionPicks(loadFrogItems(), attempts, now, seed);
    const stops = questStops(
      FROG_QUEST.stops.map((s) => s.itemId),
      attempts,
      picks.map((p) => p.items[0]?.id).filter((id): id is string => Boolean(id)),
    );
    quest = {
      href: `/learn/${FROG_QUEST.slug}`,
      title: FROG_QUEST.title,
      evidence: questEvidence(attempts).label,
      nodes: stops.map((s) => ({ label: s.label, lit: s.state === "mastered", current: s.state === "current" })),
    };
  } else {
    const view = subjects[0] ? subjectView(subjects[0], attempts, now, seed, ctx.pack) : null;
    // A topic lights up once it holds fresh evidence (a first-try success in it); the session's topic is current.
    const ready = view?.topics.filter((t) => t.questions + t.written + t.cards > 0) ?? [];
    const lit = new Set(attempts.filter((a) => a.skill === view?.id && a.firstTry && a.confirmed && !a.revealed && a.hintsBeforeSubmit === 0 && a.marks >= a.maxMarks).map((a) => a.topic));
    quest = {
      href: view ? `/learn/${view.id}` : "/learn",
      title: view?.label ?? "your subjects",
      evidence: view?.evidence ?? "",
      nodes: ready.slice(0, 5).map((t) => ({ label: t.title, lit: lit.has(t.id), current: t.id === view?.next?.topicId })),
    };
  }
  return (
    <TreasureScreen
      nickname={ctx.nickname}
      stars={totalPoints(ledger)}
      starsToday={pointsOnDay(ledger, sgDate(now))}
      evidenceLabel={quest.evidence}
      cards={cardsFromLedger(ledger, lookup, p3 ? FROG_QUEST_CARD : { art: `/art/kix/${ctx.pack}`, chip: subjects[0]?.label ?? "" })}
      nodes={quest.nodes}
      questHref={quest.href}
      questTitle={quest.title}
      creations={(await ctx.store.creations.list(ctx.householdId, ctx.kidId).catch(() => [])).map((c) => ({ id: c.id, title: c.title, version: c.currentVersion, cards: c.versions[c.currentVersion - 1]?.cards.length ?? 0, shared: c.sharedVersion !== null }))}
    />
  );
}

export default function TreasurePage() {
  return (
    <KidGate>
      <Treasure />
    </KidGate>
  );
}
