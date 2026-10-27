import type { Metadata } from "next";
import { KidGate } from "@/components/auth/KidGate";
import { StudioPicker } from "@/components/studio/StudioPicker";

export const metadata: Metadata = { title: "Sidekick Studio · myKx" };

export default function StudioPage() {
  return (
    <KidGate>
      <StudioPicker />
    </KidGate>
  );
}
