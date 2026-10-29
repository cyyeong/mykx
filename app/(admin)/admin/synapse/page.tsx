import type { Metadata } from "next";
import { GrownUpGate } from "@/components/account/GrownUpGate";
import { SynapseScreen } from "@/components/admin/synapse/SynapseScreen";

export const metadata: Metadata = { title: "Kix Synapse · myKx admin" };

// The screen reads /api/admin/synapse in the browser (the route checks the admin flag and the PIN unlock).
export default function SynapsePage() {
  return (
    <GrownUpGate>
      <SynapseScreen />
    </GrownUpGate>
  );
}
