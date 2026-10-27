import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { QuestMapScreen, type MapStop } from "@/components/screens/quest-map/QuestMapScreen";
import { subskillKey } from "@/lib/domain/attempts";
import { recompute } from "@/lib/domain/mastery";
import { sgDate } from "@/lib/domain/time";
import { FROG_QUEST, nextPickId, questEvidence, questStops, sessionPicks } from "@/lib/learn/frog-quest";
import { learnContext, questData } from "@/lib/learn/server";

export const metadata: Metadata = { title: "Quest map · myKx" };

// Ari's quest from task 2: the reviewed P3 frog life cycle.
export function generateStaticParams() {
  return [{ quest: FROG_QUEST.slug }];
}

async function QuestMap({ params }: { params: Promise<{ quest: string }> }) {
  const { quest } = await params;
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  if (quest !== FROG_QUEST.slug) notFound();

  const { items, attempts } = await questData(ctx);
  const now = new Date().toISOString();
  const picks = sessionPicks(items, attempts, now, `${ctx.kidId}:${sgDate(now)}`);
  const byId = new Map(items.map((i) => [i.id, i]));
  const stops: MapStop[] = questStops(FROG_QUEST.stops.map((s) => s.itemId), attempts).map((stop) => {
    const item = byId.get(stop.itemId);
    const mine = item ? attempts.filter((a) => subskillKey(a) === subskillKey(item)) : [];
    const m = item && mine.length ? recompute(mine, now).m : null;
    return { ...stop, mastery: m === null ? null : Math.round(m * 100) };
  });
  const next = nextPickId(picks, attempts, "");
  const first = picks[0];
  const reasons = [...new Set((first?.strongest ?? []).slice(0, 2).map((s) => s.reason))];
  return (
    <QuestMapScreen
      questTitle={FROG_QUEST.title}
      levelLabel="P3 Science"
      blurb={FROG_QUEST.blurb}
      stops={stops}
      startHref={next ? `/question/${next}` : `/learn/${FROG_QUEST.slug}/done`}
      startLabel={attempts.length ? "Continue the quest" : "Start today's quest"}
      sessionCount={Math.max(picks.length, 1)}
      reason={first && reasons.length ? `We start with ${stops.find((s) => s.itemId === first.items[0]?.id)?.label ?? "stop one"}: ${reasons.join(", ")}.` : null}
      evidenceLabel={questEvidence(attempts).label}
      masteredCount={stops.filter((s) => s.state === "mastered").length}
    />
  );
}

export default function QuestMapPage({ params }: PageProps<"/learn/[quest]">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--surface)" }} />}>
      <QuestMap params={params} />
    </Suspense>
  );
}
