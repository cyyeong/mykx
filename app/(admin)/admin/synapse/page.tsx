import type { Metadata } from "next";
import { SynapseScreen } from "@/components/admin/synapse/SynapseScreen";

export const metadata: Metadata = { title: "Kix Synapse · myKx admin" };

// The screen reads /api/admin/synapse in the browser (the route checks the admin flag and the PIN unlock; the admin layout holds the shell and the PIN gate).
export default function SynapsePage() {
  return <SynapseScreen />;
}
