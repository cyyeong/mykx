import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PaperRoute } from "@/components/papers/PaperRoute";
import { getDoors } from "@/lib/auth/server";
import { listPrintPacks, loadPrintBank } from "@/lib/print/bank";

// Pack ids are known from content/skills, so the route shell prerenders; the paper itself streams per request.
export function generateStaticParams() {
  return listPrintPacks().map((p) => ({ pack: p.id }));
}

export async function generateMetadata({ params }: PageProps<"/papers/[pack]">): Promise<Metadata> {
  const { pack } = await params;
  const title = loadPrintBank(pack)?.manifest.title;
  return { title: title ? `${title} practice paper · myKx` : "Practice paper · myKx" };
}

// A printable paper for grown-ups: answer guide included by default (?guide=with|none|only).
async function ParentPaper({ params, searchParams }: PageProps<"/papers/[pack]">) {
  const doors = await getDoors();
  if (!doors.signedIn) redirect("/signin");
  const [{ pack }, search] = await Promise.all([params, searchParams]);
  return (
    <PaperRoute
      packId={pack}
      search={search}
      base="/papers"
      defaultGuide="with"
      elsewhere="/papers"
      back={{ href: "/papers", label: "Papers" }}
      audience="parent"
      theme={{ pack: "anime-sky", band: "teen" }}
    />
  );
}

export default function ParentPaperPage(props: PageProps<"/papers/[pack]">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#F6F8FF" }} />}>
      <ParentPaper {...props} />
    </Suspense>
  );
}
