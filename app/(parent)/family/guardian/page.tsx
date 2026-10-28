import type { Metadata } from "next";
import { GrownUpGate } from "@/components/account/GrownUpGate";
import { GuardianSettings } from "@/components/guardian/GuardianSettings";

export const metadata: Metadata = { title: "Location and home cameras · myKx" };

// Guardian's settings (docs/prd/GUARDIAN.md §2.1, §2.2, §2.6): behind the parent PIN like the rest of Your family.
export default function GuardianSettingsPage() {
  return (
    <GrownUpGate>
      <GuardianSettings />
    </GrownUpGate>
  );
}
