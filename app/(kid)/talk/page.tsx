import type { Metadata } from "next";
import { TalkSandbox } from "@/components/voice/TalkSandbox";

export const metadata: Metadata = { title: "Talk to Kix · myKx" };

export default function TalkPage() {
  return <TalkSandbox />;
}
