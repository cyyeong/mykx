import type { Metadata } from "next";
import { FamilyScreen } from "@/components/account/FamilyScreen";

export const metadata: Metadata = { title: "Your family · myKx" };

// The screen reads /api/family/kids in the browser, so nothing here waits on request data.
export default function FamilyPage() {
  return <FamilyScreen />;
}
