import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CritterHub } from "@/components/pets/CritterHub";
import { homeData } from "@/lib/learn/home";
import { learnContext } from "@/lib/learn/server";

export const metadata: Metadata = { title: "Critter Lab · myKx" };

// The kid's pets (lib/pets: care rules, kept as game_progress rows) and, in Life cycles, Pip's stage from the
// learner record (the same numbers as Home).
async function Lab() {
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  const [{ pip }, pets, kid] = await Promise.all([homeData(ctx), ctx.store.pets.list(ctx.householdId, ctx.kidId).catch(() => []), ctx.store.kid(ctx.householdId, ctx.kidId)]);
  return <CritterHub pets={pets} now={new Date().toISOString()} band={ctx.band === "teen" ? "teen" : "junior"} voice={kid?.voiceEnabled ?? false} pipStage={pip.stage} pipNext={pip.next?.needs ?? null} />;
}

export default function CritterLabPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <Lab />
    </Suspense>
  );
}
