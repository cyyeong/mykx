import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QuestMapScreen } from "@/components/screens/quest-map/QuestMapScreen";
import { DEMO_QUEST } from "@/components/screens/routes";

export const metadata: Metadata = { title: "Quest map · myKx" };

// Static port: one fixture quest until Day 4 builds the map from mastery.
export function generateStaticParams() {
  return [{ quest: DEMO_QUEST }];
}

async function QuestMap({ params }: { params: Promise<{ quest: string }> }) {
  const { quest } = await params;
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
