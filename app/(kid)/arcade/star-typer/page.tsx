import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StarTyper } from "@/components/games/StarTyper";
import { typingRound } from "@/lib/games/server";
import { learnContext } from "@/lib/learn/server";

export const metadata: Metadata = { title: "Star Typer · myKx" };

async function Game({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  const q = await searchParams;
  const num = (v: unknown) => (typeof v === "string" && /^\d$/.test(v) ? Number(v) : undefined);
  const round = await typingRound(ctx, "star-typer", { stage: num(q.stage), level: num(q.level) });
  return <StarTyper key={`${round.stage}-${round.level}`} words={round.words} stage={round.stage} level={round.level} stageName={round.stageName} band={round.band} nickname={round.nickname} />;
}

export default function StarTyperPage({ searchParams }: PageProps<"/arcade/star-typer">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "#1E1C45" }} />}>
      <Game searchParams={searchParams} />
    </Suspense>
  );
}
