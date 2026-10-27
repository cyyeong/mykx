import type { Metadata } from "next";
import { KidGate } from "@/components/auth/KidGate";
import { MeScreen } from "@/components/account/MeScreen";

export const metadata: Metadata = { title: "Me · myKx" };

// The screen reads /api/me in the browser and takes on the kid's world, so nothing here waits on request data.
export default function MePage() {
  return (
    <KidGate>
      <MeScreen />
    </KidGate>
  );
}
