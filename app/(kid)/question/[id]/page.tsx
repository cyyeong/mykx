import type { StemFigure } from "@/components/screens/question/StemText";
import { loadFigures } from "@/lib/print/bank";
import { plainText } from "@/lib/print/markup";
import type { SkillItem } from "@/lib/types";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { QuestionPlayer, type PlayerItem } from "@/components/screens/question/QuestionScreen";
import { familyOf } from "@/lib/domain/attempts";
import { pointsOnDay } from "@/lib/domain/rewards";
import { sgDate } from "@/lib/domain/time";
import { FROG_QUEST, loadFrogItems, nextPickId, sessionPicks } from "@/lib/learn/frog-quest";
import { rewardCards } from "@/lib/learn/reward-cards";
import { learnContext, subjectData } from "@/lib/learn/server";
import { needsPaper, parseSession, sessionStep } from "@/lib/learn/session";
import { itemForKid, type Subject } from "@/lib/learn/subjects";
import { cardFor } from "@/lib/learn/submit";

export const metadata: Metadata = { title: "Question · myKx" };

// The frog quest's reviewed items are prerendered; any other item of the kid's own subjects renders on demand.
export function generateStaticParams() {
  return loadFrogItems().map((item) => ({ id: item.id }));
}

/** The item's diagram from its skill pack, inlined, at its natural size in CSS pixels (96 per inch). A visual text's
 *  poster (as in printed papers, lib/print/paper.ts) is shown whole and carries its words as alt text. */
function figureFor(item: SkillItem): StemFigure | null {
  if (!item.figure) return null;
  const fig = loadFigures(item.skill, [item.figure])[item.figure];
  if (!fig) return null;
  const size = { src: fig.src, w: (fig.widthMm * 96) / 25.4, h: (fig.heightMm * 96) / 25.4 };
  if (/visual/.test(item.topic) && item.passage) return { ...size, poster: true, alt: `The poster: ${plainText(item.passage).replace(/\n+/g, ". ")}` };
  return { ...size, alt: item.type === "card" ? "The word's picture" : "The diagram for this question" };
}

/** What the player shows: never the answer key. A word card becomes the question code will mark. */
function playerItem(item: SkillItem, subject: Subject): PlayerItem {
  const base = { id: item.id, stem: item.stem, hints: item.hints ?? [], figure: figureFor(item), passage: item.passage ?? null };
  if (item.type === "card") {
    const q = cardFor(item, subject);
    return { ...base, options: q.options, kind: "card", card: { mode: q.mode, show: q.show, meaning: q.meaning, prompt: q.prompt } };
  }
  return { ...base, options: item.type === "mcq" ? (item.options ?? []) : [], kind: item.type === "open" ? "written" : "marked" };
}

async function Question({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  // Only an item from one of the kid's own level's packs: another level's item is never served (404).
  const access = itemForKid(ctx.level, id);
  if (!access.ok) notFound();
  const { item, subject } = access;
  // A drawing question is answered on paper (printable papers), never on screen.
  if (needsPaper(item)) notFound();
  const { subjects, attempts, ledger } = await subjectData(ctx);
  const now = new Date().toISOString();
  const today = sgDate(now);
  const cards = rewardCards(subjects, ctx.pack);
  const card = cards[item.id] ?? { label: subject.name, art: `/art/kix/${ctx.pack}`, chip: subject.label };
  const teen = ctx.band === "teen";
  const theme = teen ? { theme: ctx.pack, band: "teen" as const } : {};
  // Fresh: nothing in this question's family tried yet, so the first try is new mastery evidence.
  const fresh = !attempts.some((a) => a.family === familyOf({ id: item.id }));

  // A subject session: the ids code chose at Start session ride in the URL, each checked against this subject.
  const session = parseSession(query.session, subject);
  if (session?.includes(item.id) || !FROG_QUEST.stops.some((s) => s.itemId === item.id)) {
    const ids = session?.includes(item.id) ? session : [item.id];
    const step = sessionStep(subject.id, ids, item.id);
    return (
      <QuestionPlayer
        key={item.id}
        item={playerItem(item, subject)}
        backHref={`/learn/${subject.id}`}
        nextHref={step.nextHref}
        questTitle={`${subject.label} session`}
        fresh={fresh}
        {...theme}
        position={step.position}
        total={step.total}
        doneCount={step.doneCount}
        nextId={step.nextId}
        starsToday={pointsOnDay(ledger, today)}
        card={{ label: card.label, art: card.art }}
      />
    );
  }

  // The frog quest (P3 Science's featured quest): today's picks through `sessionPicks`, as before.
  const items = loadFrogItems();
  const picks = sessionPicks(items, attempts, now, `${ctx.kidId}:${today}`);
  const attempted = new Set(attempts.map((a) => a.family));
  const doneCount = picks.filter((p) => attempted.has(p.family)).length;
  const index = picks.findIndex((p) => p.items.some((i) => i.id === id));
  const position = index >= 0 ? index + 1 : Math.min(doneCount + 1, Math.max(picks.length, 1));
  const nextId = nextPickId(picks, attempts, id);
  return (
    <QuestionPlayer
      key={item.id}
      item={playerItem(item, subject)}
      backHref={`/learn/${FROG_QUEST.slug}`}
      nextHref={nextId ? `/question/${nextId}` : `/learn/${FROG_QUEST.slug}/done`}
      questTitle={FROG_QUEST.title}
      fresh={fresh}
      position={position}
      total={Math.max(picks.length, 1)}
      doneCount={Math.min(doneCount, Math.max(picks.length, 1))}
      nextId={nextId}
      starsToday={pointsOnDay(ledger, today)}
      card={{ label: card.label, art: card.art }}
    />
  );
}

export default function QuestionPage({ params, searchParams }: PageProps<"/question/[id]">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <Question params={params} searchParams={searchParams} />
    </Suspense>
  );
}
