import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { QuestMapScreen, type MapStop } from "@/components/screens/quest-map/QuestMapScreen";
import { SubjectScreen } from "@/components/screens/learn/SubjectScreen";
import { StudyDeckScreen } from "@/components/screens/study-deck/StudyDeckScreen";
import { subskillKey } from "@/lib/domain/attempts";
import { recompute } from "@/lib/domain/mastery";
import { sgDate } from "@/lib/domain/time";
import { FROG_QUEST, loadFrogItems, questEvidence, questStops, sessionPicks } from "@/lib/learn/frog-quest";
import { learnContext, questData, subjectData, type LearnContext } from "@/lib/learn/server";
import { subjectFor } from "@/lib/learn/subjects";
import { missingSubjects, subjectView } from "@/lib/learn/views";

export const metadata: Metadata = { title: "Learn · myKx" };

// A subject (`/learn/p6-maths`: one of the kid's own level's packs) or P3 Science's featured quest, the frog life
// cycle map (`/learn/frog-life-cycle`). Another level's pack is a 404: it is never shown.
export function generateStaticParams() {
  return [{ quest: FROG_QUEST.slug }];
}

async function FrogMap({ ctx }: { ctx: LearnContext }) {
  const { items, attempts } = await questData(ctx);
  const now = new Date().toISOString();
  const picks = sessionPicks(items, attempts, now, `${ctx.kidId}:${sgDate(now)}`);
  const byId = new Map(items.map((i) => [i.id, i]));
  // The highlighted stop, Kix's line and the first question all come from the
  // same place: the session's first open pick (never a locked stop).
  const stops: MapStop[] = questStops(
    FROG_QUEST.stops.map((s) => s.itemId),
    attempts,
    picks.map((p) => p.items[0]?.id).filter((id): id is string => Boolean(id)),
  ).map((stop) => {
    const item = byId.get(stop.itemId);
    const mine = item ? attempts.filter((a) => subskillKey(a) === subskillKey(item)) : [];
    const m = item && mine.length ? recompute(mine, now).m : null;
    return { ...stop, mastery: m === null ? null : Math.round(m * 100) };
  });
  const current = stops.find((s) => s.state === "current");
  const first = picks[0];
  const reasons = [...new Set((first?.strongest ?? []).slice(0, 2).map((s) => s.reason))];
  return (
    <QuestMapScreen
      questTitle={FROG_QUEST.title}
      levelLabel={FROG_QUEST.chip}
      blurb={FROG_QUEST.blurb}
      stops={stops}
      startHref={current ? `/question/${current.itemId}` : `/learn/${FROG_QUEST.slug}/done`}
      startLabel={attempts.length ? "Continue the quest" : "Start today's quest"}
      sessionCount={Math.max(picks.length, 1)}
      reason={current && reasons.length ? `We start with ${current.label}: ${reasons.join(", ")}.` : null}
      evidenceLabel={questEvidence(attempts).label}
      masteredCount={stops.filter((s) => s.state === "mastered").length}
    />
  );
}

async function Learn({ params }: { params: Promise<{ quest: string }> }) {
  const { quest } = await params;
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  if (quest === FROG_QUEST.slug) {
    // The frog quest is P3 Science's: only a kid whose subjects include it sees the map.
    if (!subjectFor(ctx.level, FROG_QUEST.skill)) notFound();
    return <FrogMap ctx={ctx} />;
  }
  if (!subjectFor(ctx.level, quest)) notFound();
  const { subjects, attempts } = await subjectData(ctx);
  const now = new Date().toISOString();
  const seed = `${ctx.kidId}:${sgDate(now)}`;
  const frog = loadFrogItems();
  if (ctx.band === "teen") {
    const views = subjects.map((s) => subjectView(s, attempts, now, seed, ctx.pack, frog));
    return <StudyDeckScreen kid={{ nickname: ctx.nickname, level: ctx.level ?? "", pack: ctx.pack }} subjects={views} initial={quest} variant="learn" missing={missingSubjects(views)} />;
  }
  const subject = subjects.find((s) => s.id === quest);
  if (!subject) notFound();
  return <SubjectScreen view={subjectView(subject, attempts, now, seed, ctx.pack, frog)} pack={ctx.pack} />;
}

export default function LearnSubjectPage({ params }: PageProps<"/learn/[quest]">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <Learn params={params} />
    </Suspense>
  );
}
