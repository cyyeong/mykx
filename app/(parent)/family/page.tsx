import type { Metadata } from "next";
import { FamilyScreen } from "@/components/account/FamilyScreen";
import { GrownUpGate } from "@/components/account/GrownUpGate";
import { PinSetupCard } from "@/components/account/PinSetupCard";

export const metadata: Metadata = { title: "Your family · myKx" };

// The PIN is set here (setup card), so the gate passes this page through:
// with a kid signed in and no PIN yet, the card explains how to set one.
export default function FamilyPage() {
  return (
    <GrownUpGate setup>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <PinSetupCard />
        <FamilyScreen />
      </div>
    </GrownUpGate>
  );
}
