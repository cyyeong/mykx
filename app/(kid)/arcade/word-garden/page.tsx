import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WordGarden } from "@/components/games/WordGarden";
import { gardenRound } from "@/lib/games/server";
import { learnContext } from "@/lib/learn/server";

export const metadata: Metadata = { title: "Word Garden · myKx" };

async function Game({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  const q = await searchParams;
  const level = typeof q.level === "string" && /^[1-5]$/.test(q.level) ? Number(q.level) : undefined;
  const round = await gardenRound(ctx, { level });
  return <WordGarden key={round.level} prompts={round.prompts} level={round.level} band={round.band} school={round.school} />;
}

export default function WordGardenPage({ searchParams }: PageProps<"/arcade/word-garden">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "#EEF5E4" }} />}>
      <Game searchParams={searchParams} />
    </Suspense>
  );
}
