import type { Metadata } from "next";
import { KidGate } from "@/components/auth/KidGate";
import { TalkSandbox } from "@/components/voice/TalkSandbox";

export const metadata: Metadata = { title: "Talk to Kix · myKx" };

export default function TalkPage() {
  return (
    <KidGate>
      <TalkSandbox />
    </KidGate>
  );
}
