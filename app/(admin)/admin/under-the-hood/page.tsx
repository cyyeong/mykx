import type { Metadata } from "next";
import { HoodScreen } from "@/components/admin/hood/HoodScreen";

export const metadata: Metadata = { title: "Under the hood · myKx admin" };

// The screen reads /api/admin/hood in the browser (the route checks the admin flag and the PIN unlock; the admin layout holds the shell and the PIN gate).
export default function UnderTheHoodPage() {
  return <HoodScreen />;
}
