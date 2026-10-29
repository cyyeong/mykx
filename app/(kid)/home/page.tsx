import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HomeScreen } from "@/components/screens/home/HomeScreen";
import { StudyDeckScreen } from "@/components/screens/study-deck/StudyDeckScreen";
import { getSignedInKid } from "@/lib/auth/server";
import { sgDate } from "@/lib/domain/time";
import { loadTender } from "@/lib/guardian/load";
import { loadFrogItems } from "@/lib/learn/frog-quest";
import { homeData } from "@/lib/learn/home";
import { learnContext, subjectData } from "@/lib/learn/server";
import { subjectView } from "@/lib/learn/views";

export const metadata: Metadata = { title: "Home · myKx" };

// Junior kids land on Home (quest, Pip, squadron); teens on their study deck, with their own subjects' real
// topics, rings and next session (lib/learn/views.ts).
async function Landing() {
  const kid = await getSignedInKid();
  if (!kid) redirect("/doors");
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  if (kid.band === "teen") {
    // After a hard day, Kix eases in (lib/kix/today.ts); it never says why.
    const tender = await loadTender(ctx.store, ctx.householdId, kid).catch(() => null);
    const { subjects, attempts } = await subjectData(ctx);
    const now = new Date().toISOString();
    const seed = `${ctx.kidId}:${sgDate(now)}`;
    const frog = loadFrogItems();
    const views = subjects.map((s) => subjectView(s, attempts, now, seed, ctx.pack, frog));
    return (
      <StudyDeckScreen
        kid={kid}
        subjects={views}
        variant="home"
        kixLine={tender ? `Welcome back, ${kid.nickname}. Let's ease in today: one you already know first, then the fresh ones.` : null}
      />
    );
  }
  return <HomeScreen data={await homeData(ctx)} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <Landing />
    </Suspense>
  );
}
