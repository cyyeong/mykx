import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { HomeScreen } from "@/components/screens/home/HomeScreen";
import { StudyDeckScreen } from "@/components/screens/study-deck/StudyDeckScreen";
import { getSignedInKid } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Home · myKx" };

// Junior kids land on Home (quest, Pip, squadron); teens on their study deck.
async function Landing() {
  const kid = await getSignedInKid();
  if (!kid) redirect("/doors");
  if (kid.band === "teen") return <StudyDeckScreen kid={kid} />;
  return <HomeScreen nickname={kid.nickname} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--surface)" }} />}>
      <Landing />
    </Suspense>
  );
}
