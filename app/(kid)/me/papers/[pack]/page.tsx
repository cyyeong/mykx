import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PaperRoute } from "@/components/papers/PaperRoute";
import { getDoors, getSignedInKid } from "@/lib/auth/server";
import { getStore } from "@/lib/auth/context";
import { listPrintPacks, loadPrintBank } from "@/lib/print/bank";
import { refreshSkillOverrides } from "@/lib/skills/overrides";

// Pack ids are known from content/skills, so the route shell prerenders; the paper itself streams per request.
export function generateStaticParams() {
  return listPrintPacks().map((p) => ({ pack: p.id }));
}

export async function generateMetadata({ params }: PageProps<"/me/papers/[pack]">): Promise<Metadata> {
  const { pack } = await params;
  const title = loadPrintBank(pack)?.manifest.title;
  return { title: title ? `${title} practice paper · myKx` : "Practice paper · myKx" };
}

// A printable paper for the signed-in kid: their level only, answer guide hidden unless a grown-up shows it.
async function KidPaper({ params, searchParams }: PageProps<"/me/papers/[pack]">) {
  const kid = await getSignedInKid();
  if (!kid) redirect((await getDoors()).signedIn ? "/doors" : "/signin");
  const [{ pack }, search] = await Promise.all([params, searchParams]);
  await refreshSkillOverrides(getStore()); // the pack's published version (lib/skills/overrides.ts)
  return (
    <PaperRoute
      packId={pack}
      search={search}
      base="/me/papers"
      defaultGuide="none"
      level={kid.level}
      elsewhere="/me/papers"
      back={{ href: "/me/papers", label: "My papers" }}
      audience="kid"
      theme={{ pack: kid.pack, band: kid.band }}
    />
  );
}

export default function KidPaperPage(props: PageProps<"/me/papers/[pack]">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <KidPaper {...props} />
    </Suspense>
  );
}
