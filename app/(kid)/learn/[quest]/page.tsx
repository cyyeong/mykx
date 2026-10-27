import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { QuestMapScreen } from "@/components/screens/quest-map/QuestMapScreen";
import { DEMO_QUEST } from "@/components/screens/routes";
import { getSignedInKid } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Quest map · myKx" };

// Static port: one fixture quest until Day 4 builds the map from mastery.
export function generateStaticParams() {
  return [{ quest: DEMO_QUEST }];
}

async function QuestMap({ params }: { params: Promise<{ quest: string }> }) {
  const { quest } = await params;
  if (!(await getSignedInKid())) redirect("/doors");
  if (quest !== DEMO_QUEST) notFound();
  return <QuestMapScreen />;
}

export default function QuestMapPage({ params }: PageProps<"/learn/[quest]">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--surface)" }} />}>
      <QuestMap params={params} />
    </Suspense>
  );
}
