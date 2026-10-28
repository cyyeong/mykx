import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SkySquadron, type JetCard } from "@/components/squadron/SkySquadron";
import { freshSuccesses, JETS, squadron } from "@/lib/domain/squadron";
import { questData, learnContext } from "@/lib/learn/server";

export const metadata: Metadata = { title: "Sky Squadron · myKx" };

const JET_INFO: Record<string, { name: string; art: string; fact: string; flight: string }> = {
  dragonfly: { name: "Dragonfly", art: "/art/jets/dragonfly", fact: "It moves its four wings one by one, so it can hover and even fly backwards.", flight: "Wings make lift when air flows over them. More speed, more lift." },
  bumblebee: { name: "Bumblebee", art: "/art/jets/bumblebee", fact: "Its wings beat about 200 times every second.", flight: "A jet engine pushes air backwards, so the jet moves forwards. That push is called thrust." },
  firefly: { name: "Firefly", art: "/art/jets/firefly", fact: "It makes its own cold light to flash signals to other fireflies.", flight: "Blinking lights help other pilots spot a plane at night." },
  rhino_beetle: { name: "Rhino Beetle", art: "/art/jets/rhino-beetle", fact: "For its size it is one of the strongest animals: it can lift many times its own weight.", flight: "A heavier plane needs more lift, so it needs more speed and a longer runway to take off." },
};

// Unlocks from the learner record; the deterministic grants are written to the ledger once (amount 0).
async function Squadron() {
  const ctx = await learnContext();
  if (!ctx) redirect("/doors");
  const { attempts, ledger } = await questData(ctx);
  const now = new Date().toISOString();
  const view = squadron({ successes: freshSuccesses(attempts), ledger, now });
  if (view.grants.length) await ctx.store.learn.saveLedgerEntries(ctx.householdId, ctx.kidId, view.grants).catch(() => undefined);
  const dated = new Map([...ledger, ...view.grants].filter((e) => e.rule === "squadron_unlock").map((e) => [e.ref ?? "", e.at]));
  const jets: JetCard[] = JETS.map((id, i) => {
    const info = JET_INFO[id];
    const earned = view.unlocked.includes(id);
    const at = dated.get(id);
    const left = view.next && view.next.jet === id ? view.next.need - view.next.have : null;
    return {
      id,
      ...info,
      earned,
      note: earned
        ? `Earned ${at ? new Date(at).toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: "Asia/Singapore" }) : ""}`.trim()
        : left !== null
          ? `${left} more fresh ${left === 1 ? "question" : "questions"} to unlock`
          : `Unlocks after ${JET_INFO[JETS[i - 1]]?.name ?? "the one before"}`,
    };
  });
  return <SkySquadron jets={jets} banner={view.banner} left={JETS.length - view.unlocked.length} />;
}

export default function SquadronPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <Squadron />
    </Suspense>
  );
}
