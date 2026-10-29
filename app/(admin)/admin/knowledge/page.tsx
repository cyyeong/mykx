import type { Metadata } from "next";
import { KnowledgeScreen } from "@/components/admin/knowledge/KnowledgeScreen";

export const metadata: Metadata = { title: "Add knowledge · myKx admin" };

// The screen reads /api/admin/knowledge in the browser (the route checks the admin flag and the PIN unlock; the admin layout holds the shell and the PIN gate).
export default function AdminKnowledgePage() {
  return <KnowledgeScreen />;
}
