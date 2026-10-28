import type { Metadata } from "next";
import { FamilyScreen } from "@/components/account/FamilyScreen";
import { GrownUpGate } from "@/components/account/GrownUpGate";

export const metadata: Metadata = { title: "Your family · myKx" };

// The PIN is set here (the setup card inside FamilyScreen), so the gate passes this page through:
// with a kid signed in and no PIN yet, the card explains how to set one.
export default function FamilyPage() {
  return (
    <GrownUpGate setup>
      <FamilyScreen />
    </GrownUpGate>
  );
}
