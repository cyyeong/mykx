import type { Metadata } from "next";
import { SkillsScreen } from "@/components/admin/skills/SkillsScreen";

export const metadata: Metadata = { title: "Skills · myKx admin" };

// The screen reads /api/admin/hood in the browser (the route checks the admin flag and the PIN unlock; the admin layout holds the shell and the PIN gate).
export default function AdminSkillsPage() {
  return <SkillsScreen />;
}
