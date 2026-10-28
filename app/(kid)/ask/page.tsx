import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AskKix } from "@/components/kix/AskKix";
import { getSignedInKid } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Ask Kix · myKx" };

// Homework help: a typed question or a photo of it, explained the way the syllabus teaches it.
async function Ask() {
  const kid = await getSignedInKid();
  if (!kid) redirect("/doors");
  return <AskKix nickname={kid.nickname} />;
}

export default function AskPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <Ask />
    </Suspense>
  );
}
