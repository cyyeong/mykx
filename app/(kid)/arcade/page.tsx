import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArcadeHub } from "@/components/games/ArcadeHub";
import { arcadeData } from "@/lib/games/server";
import { learnContext } from "@/lib/learn/server";

export const metadata: Metadata = { title: "Arcade · myKx" };

async function Arcade() {
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  const data = await arcadeData(ctx);
  return <ArcadeHub {...data} />;
}

export default function ArcadePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "#1E1C45" }} />}>
      <Arcade />
    </Suspense>
  );
}
