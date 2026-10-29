import type { Metadata } from "next";
import { Suspense } from "react";
import { AgentEditor } from "@/components/admin/hood/AgentEditor";
import { AGENTS } from "@/lib/admin/hood";

export const metadata: Metadata = { title: "Agents · Under the hood · myKx admin" };

// Every agent is known from lib/admin/hood.ts, so the route shell prerenders; the editor reads /api/admin/agents in
// the browser (the routes check the admin flag and the PIN unlock).
export function generateStaticParams() {
  return AGENTS.map((a) => ({ agent: a.route ?? a.id }));
}

async function Editor({ params }: PageProps<"/admin/under-the-hood/agents/[agent]">) {
  const { agent } = await params;
  return <AgentEditor agentKey={agent} />;
}

export default function AgentEditorPage(props: PageProps<"/admin/under-the-hood/agents/[agent]">) {
  return (
    <Suspense fallback={null}>
      <Editor {...props} />
    </Suspense>
  );
}
