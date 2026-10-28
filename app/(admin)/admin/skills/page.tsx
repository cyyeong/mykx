import type { Metadata } from "next";
import { GrownUpGate } from "@/components/account/GrownUpGate";
import { SkillsScreen } from "@/components/admin/skills/SkillsScreen";

export const metadata: Metadata = { title: "Skills · myKx admin" };

// The screen reads /api/admin/hood in the browser (the route checks the admin flag and the PIN unlock).
export default function AdminSkillsPage() {
  return (
    <GrownUpGate>
      <SkillsScreen />
    </GrownUpGate>
  );
}
