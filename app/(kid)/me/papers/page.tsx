import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PapersIndex } from "@/components/papers/PapersIndex";
import { getDoors, getSignedInKid } from "@/lib/auth/server";
import { listPrintPacks } from "@/lib/print/bank";

export const metadata: Metadata = { title: "Papers to print · myKx" };

// The signed-in kid's own level only.
async function KidPapers() {
  const kid = await getSignedInKid();
  if (!kid) redirect((await getDoors()).signedIn ? "/doors" : "/signin");
  return (
    <PapersIndex
      kids={[{ id: kid.id, nickname: kid.nickname, level: kid.level }]}
      packs={listPrintPacks().filter((p) => p.level === kid.level)}
      base="/me/papers"
      back={{ href: "/me", label: "Me" }}
      audience="kid"
      theme={{ pack: kid.pack, band: kid.band }}
    />
  );
}

export default function KidPapersPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "var(--surface)" }} />}>
      <KidPapers />
    </Suspense>
  );
}
