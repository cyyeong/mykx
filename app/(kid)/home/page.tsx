import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HomeScreen } from "@/components/screens/home/HomeScreen";
import { StudyDeckScreen } from "@/components/screens/study-deck/StudyDeckScreen";
import { getSignedInKid } from "@/lib/auth/server";
import { loadTender } from "@/lib/guardian/load";
import { homeData } from "@/lib/learn/home";
import { learnContext } from "@/lib/learn/server";

export const metadata: Metadata = { title: "Home · myKx" };

// Junior kids land on Home (quest, Pip, squadron); teens on their study deck.
async function Landing() {
  const kid = await getSignedInKid();
  if (!kid) redirect("/doors");
  const ctx = await learnContext();
  if (kid.band === "teen") {
    // After a hard day, Kix eases in (lib/kix/today.ts); it never says why.
    const tender = ctx ? await loadTender(ctx.store, ctx.householdId, kid).catch(() => null) : null;
    return <StudyDeckScreen kid={kid} kixLine={tender ? `Welcome back, ${kid.nickname}. Let's ease in today: one you already know first, then the fresh ones.` : null} />;
  }
  if (!ctx) redirect("/doors");
  return <HomeScreen data={await homeData(ctx)} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <Landing />
    </Suspense>
  );
}
