import type { Metadata } from "next";
import { KidGate } from "@/components/auth/KidGate";
import { SharingScreen } from "@/components/guardian/SharingScreen";

export const metadata: Metadata = { title: "What my grown-ups see · myKx" };

// AGENTS.md rule 15: a kid can always see what their grown-ups have turned on. Reads /api/location/mine in the browser.
export default function SharingPage() {
  return (
    <KidGate>
      <SharingScreen />
    </KidGate>
  );
}
