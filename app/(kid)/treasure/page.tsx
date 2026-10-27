import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KidGate } from "@/components/auth/KidGate";
import { TreasureScreen, cardsFromLedger } from "@/components/screens/treasure/TreasureScreen";
import { totalPoints, pointsOnDay } from "@/lib/domain/rewards";
import { sgDate } from "@/lib/domain/time";
import { FROG_QUEST, questEvidence, questStops } from "@/lib/learn/frog-quest";
import { learnContext, questData } from "@/lib/learn/server";

export const metadata: Metadata = { title: "Treasure Realm · myKx" };

// Cards from the ledger, the constellation from fresh evidence (task 2).
async function Treasure() {
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  const { attempts, ledger } = await questData(ctx);
  const now = new Date().toISOString();
  const stops = questStops(FROG_QUEST.stops.map((s) => s.itemId), attempts);
  return (
    <TreasureScreen
      nickname={ctx.nickname}
      stars={totalPoints(ledger)}
      starsToday={pointsOnDay(ledger, sgDate(now))}
      evidenceLabel={questEvidence(attempts).label}
      cards={cardsFromLedger(ledger)}
      nodes={stops.map((s) => ({ label: s.label, lit: s.state === "mastered", current: s.state === "current" }))}
      questHref={`/learn/${FROG_QUEST.slug}`}
      questTitle={FROG_QUEST.title}
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
