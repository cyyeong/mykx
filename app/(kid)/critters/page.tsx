import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CritterLab } from "@/components/critters/CritterLab";
import { homeData } from "@/lib/learn/home";
import { learnContext } from "@/lib/learn/server";

export const metadata: Metadata = { title: "Critter Lab · myKx" };

// Pip's stage comes from the learner record (the same numbers as Home); the other critters are to explore.
async function Lab() {
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  const { pip } = await homeData(ctx);
  return <CritterLab pipStage={pip.stage} pipNext={pip.next?.needs ?? null} />;
}

export default function CritterLabPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <Lab />
    </Suspense>
  );
}
