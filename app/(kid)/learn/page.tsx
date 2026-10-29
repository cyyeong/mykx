import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LearnHubScreen } from "@/components/screens/learn/LearnHubScreen";
import { StudyDeckScreen } from "@/components/screens/study-deck/StudyDeckScreen";
import { sgDate } from "@/lib/domain/time";
import { loadFrogItems } from "@/lib/learn/frog-quest";
import { learnContext, subjectData } from "@/lib/learn/server";
import { hubLine, missingSubjects, subjectView } from "@/lib/learn/views";

export const metadata: Metadata = { title: "Learn · myKx" };

// The Learn tab for everyone (founder, 29 Oct): the kid's own subjects (their level's packs, lib/learn/subjects.ts).
// Juniors choose a subject island; teens get the study deck with every topic of each subject.
async function Learn() {
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  const { subjects, attempts } = await subjectData(ctx);
  const now = new Date().toISOString();
  const seed = `${ctx.kidId}:${sgDate(now)}`;
  const frog = loadFrogItems();
  const views = subjects.map((s) => subjectView(s, attempts, now, seed, ctx.pack, frog));
  const level = ctx.level ?? "";
  const missing = missingSubjects(views);
  if (ctx.band === "teen") {
    return <StudyDeckScreen kid={{ nickname: ctx.nickname, level, pack: ctx.pack }} subjects={views} variant="learn" missing={missing} />;
  }
  return <LearnHubScreen nickname={ctx.nickname} level={level} pack={ctx.pack} subjects={views} missing={missing} kixLine={hubLine(views)} />;
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <Learn />
    </Suspense>
  );
}
