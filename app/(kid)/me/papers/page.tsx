import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PapersIndex } from "@/components/papers/PapersIndex";
import { getDoors, getSignedInKid } from "@/lib/auth/server";
import { getStore } from "@/lib/auth/context";
import { listPrintPacks } from "@/lib/print/bank";
import { refreshSkillOverrides } from "@/lib/skills/overrides";

export const metadata: Metadata = { title: "Papers to print · myKx" };

// The signed-in kid's own level only.
async function KidPapers() {
  const kid = await getSignedInKid();
  if (!kid) redirect((await getDoors()).signedIn ? "/doors" : "/signin");
  await refreshSkillOverrides(getStore()); // each pack's published version (lib/skills/overrides.ts)
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
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <KidPapers />
    </Suspense>
  );
}
