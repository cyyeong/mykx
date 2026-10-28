import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { VibeZone } from "@/components/vibe/VibeZone";
import { getSignedInKid } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Vibe Zone · myKx" };

async function Vibe() {
  const kid = await getSignedInKid();
  if (!kid) redirect("/doors");
  return <VibeZone nickname={kid.nickname} />;
}

export default function VibePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <Vibe />
    </Suspense>
  );
}
