import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GrownUpGate } from "@/components/account/GrownUpGate";
import { PapersIndex } from "@/components/papers/PapersIndex";
import { getDoors } from "@/lib/auth/server";
import { listPrintPacks } from "@/lib/print/bank";

export const metadata: Metadata = { title: "Practice papers · myKx" };

// Each child in the household with the packs for their level; packs come from the manifests on the server.
async function Papers() {
  const doors = await getDoors();
  if (!doors.signedIn) redirect("/signin");
  return (
    <GrownUpGate>
      <PapersIndex
      kids={doors.kids.map((k) => ({ id: k.id, nickname: k.nickname, level: k.level }))}
      packs={listPrintPacks()}
      base="/papers"
      back={{ href: "/family", label: "Your family" }}
      audience="parent"
      theme={{ pack: "anime-sky", band: "teen" }}
      />
    </GrownUpGate>
  );
}

export default function PapersPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#F6F8FF" }} />}>
      <Papers />
    </Suspense>
  );
}
