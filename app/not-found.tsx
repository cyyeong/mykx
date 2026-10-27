import type { Metadata } from "next";
import { LostScreen } from "@/components/ui/LostScreen";

export const metadata: Metadata = { title: "Not found · myKx" };

export default function NotFound() {
  return <LostScreen title="Hmm, nothing here" line="Kix looked everywhere, but this page isn't in myKx. Let's go somewhere we know." />;
}
