import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NeonStrike } from "@/components/games/NeonStrike";
import { blastRound } from "@/lib/games/server";
import { learnContext } from "@/lib/learn/server";

export const metadata: Metadata = { title: "Neon Strike · myKx" };

async function Game({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  const q = await searchParams;
  const level = typeof q.level === "string" && /^[1-5]$/.test(q.level) ? Number(q.level) : undefined;
  const round = await blastRound(ctx, { level });
  return <NeonStrike key={round.level} questions={round.questions} level={round.level} school={round.school} band={round.band} />;
}

export default function NeonStrikePage({ searchParams }: PageProps<"/arcade/neon-strike">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "#120C2B" }} />}>
      <Game searchParams={searchParams} />
    </Suspense>
  );
}
