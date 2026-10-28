import type { Metadata } from "next";
import { GrownUpGate } from "@/components/account/GrownUpGate";
import { HoodScreen } from "@/components/admin/hood/HoodScreen";

export const metadata: Metadata = { title: "Under the hood · myKx admin" };

// The screen reads /api/admin/hood in the browser (the route checks the admin flag and the PIN unlock).
export default function UnderTheHoodPage() {
  return (
    <GrownUpGate>
      <HoodScreen />
    </GrownUpGate>
  );
}
