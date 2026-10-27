import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QuestionScreen } from "@/components/screens/question/QuestionScreen";
import { DEMO_QUESTION } from "@/components/screens/routes";

export const metadata: Metadata = { title: "Question · myKx" };

// Static port: one fixture question until Day 3 serves items from the quest's published skill.
export function generateStaticParams() {
  return [{ id: DEMO_QUESTION }];
}

async function Question({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== DEMO_QUESTION) notFound();
  return <QuestionScreen />;
}

export default function QuestionPage({ params }: PageProps<"/question/[id]">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--surface)" }} />}>
      <Question params={params} />
    </Suspense>
  );
}
