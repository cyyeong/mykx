import type { Metadata } from "next";
import { GrownUpGate } from "@/components/account/GrownUpGate";
import { OutingsScreen } from "@/components/outings/OutingsScreen";

export const metadata: Metadata = { title: "Do something together · myKx" };

// Weekend ideas near the family's home area (docs/prd/GUARDIAN.md §2.6): Muse Spark searches the web with only the
// area, radius, interests and dates, then plans around the weather and the kids' week. Behind the parent PIN.
export default function TogetherPage() {
  return (
    <GrownUpGate>
      <OutingsScreen />
    </GrownUpGate>
  );
}
