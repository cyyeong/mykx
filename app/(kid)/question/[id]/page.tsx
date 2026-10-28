import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { QuestionPlayer } from "@/components/screens/question/QuestionScreen";
import { pointsOnDay } from "@/lib/domain/rewards";
import { sgDate } from "@/lib/domain/time";
import { FROG_QUEST, loadFrogItems, nextPickId, questCardArt, sessionPicks } from "@/lib/learn/frog-quest";
import { learnContext, questData } from "@/lib/learn/server";

export const metadata: Metadata = { title: "Question · myKx" };

// The frog quest's reviewed items (Ari's quest from task 2).
export function generateStaticParams() {
  return loadFrogItems().map((item) => ({ id: item.id }));
}

async function Question({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  const { items, attempts, ledger } = await questData(ctx);
  const item = items.find((i) => i.id === id);
  if (!item) notFound();

  const now = new Date().toISOString();
  const picks = sessionPicks(items, attempts, now, `${ctx.kidId}:${sgDate(now)}`);
  const attempted = new Set(attempts.map((a) => a.family));
  const doneCount = picks.filter((p) => attempted.has(p.family)).length;
  const index = picks.findIndex((p) => p.items.some((i) => i.id === id));
  const position = index >= 0 ? index + 1 : Math.min(doneCount + 1, Math.max(picks.length, 1));
  return (
    <QuestionPlayer
      key={item.id}
      item={{ id: item.id, stem: item.stem, options: item.options ?? [], hints: item.hints ?? [] }}
      questSlug={FROG_QUEST.slug}
      questTitle={FROG_QUEST.title}
      position={position}
      total={Math.max(picks.length, 1)}
      doneCount={Math.min(doneCount, Math.max(picks.length, 1))}
      nextId={nextPickId(picks, attempts, id)}
      starsToday={pointsOnDay(ledger, sgDate(now))}
      card={questCardArt()[item.id] ?? { label: FROG_QUEST.title, art: "/art/cards/gecko-and-frog" }}
    />
  );
}

export default function QuestionPage({ params }: PageProps<"/question/[id]">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--surface)" }} />}>
      <Question params={params} />
    </Suspense>
  );
}
