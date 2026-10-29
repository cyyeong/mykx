import type { Metadata } from "next";
import { Suspense } from "react";
import { CaseScreen } from "@/components/admin/synapse/CaseScreen";

export const metadata: Metadata = { title: "A Kix Synapse case · myKx admin" };

async function Case({ params }: PageProps<"/admin/synapse/[id]">) {
  const { id } = await params;
  return <CaseScreen id={id} />;
}

// The case reads /api/admin/synapse/[id] in the browser (the route checks the admin flag and the PIN unlock; the admin layout holds the shell and the PIN gate).
export default function SynapseCasePage(props: PageProps<"/admin/synapse/[id]">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#F6F8FF" }} />}>
      <Case {...props} />
    </Suspense>
  );
}
