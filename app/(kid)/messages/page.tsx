import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { KidMessages } from "@/components/family/KidMessages";
import { getSignedInKid } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Messages · myKx" };

async function Messages() {
  const kid = await getSignedInKid();
  if (!kid) redirect("/doors");
  return <KidMessages nickname={kid.nickname} />;
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <Messages />
    </Suspense>
  );
}
