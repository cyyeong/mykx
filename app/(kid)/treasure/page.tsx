import type { Metadata } from "next";
import { TreasureScreen } from "@/components/screens/treasure/TreasureScreen";

export const metadata: Metadata = { title: "Treasure Realm · myKx" };

export default function TreasurePage() {
  return <TreasureScreen />;
}
