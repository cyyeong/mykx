import type { Metadata } from "next";
import { Suspense } from "react";
import { GrownUpGate } from "@/components/account/GrownUpGate";
import { CaseScreen } from "@/components/admin/synapse/CaseScreen";

export const metadata: Metadata = { title: "A Kix Synapse case · myKx admin" };

async function Case({ params }: PageProps<"/admin/synapse/[id]">) {
  const { id } = await params;
  return <CaseScreen id={id} />;
}

// The case reads /api/admin/synapse/[id] in the browser (the route checks the admin flag and the PIN unlock).
export default function SynapseCasePage(props: PageProps<"/admin/synapse/[id]">) {
  return (
    <GrownUpGate>
      <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#F6F8FF" }} />}>
        <Case {...props} />
      </Suspense>
    </GrownUpGate>
  );
}
