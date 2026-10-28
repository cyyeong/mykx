import type { Metadata } from "next";
import { KnowledgeScreen } from "@/components/admin/knowledge/KnowledgeScreen";
import { GrownUpGate } from "@/components/account/GrownUpGate";

export const metadata: Metadata = { title: "Add knowledge · myKx admin" };

// The screen reads /api/admin/knowledge in the browser (the route checks the admin flag and the PIN unlock).
export default function AdminKnowledgePage() {
  return (
    <GrownUpGate>
      <KnowledgeScreen />
    </GrownUpGate>
  );
}
