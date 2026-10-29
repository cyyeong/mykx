import type { Metadata } from "next";
import { Suspense } from "react";
import { SkillEditor } from "@/components/admin/skills/SkillEditor";

export const metadata: Metadata = { title: "Edit a skill · myKx admin" };

async function Editor({ params }: PageProps<"/admin/skills/[pack]">) {
  const { pack } = await params;
  return <SkillEditor packId={pack} />;
}

// The editor reads /api/admin/skills/[pack] in the browser (the route checks the admin flag and the PIN unlock; the admin layout holds the shell and the PIN gate).
export default function AdminSkillPage(props: PageProps<"/admin/skills/[pack]">) {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#F6F8FF" }} />}>
      <Editor {...props} />
    </Suspense>
  );
}
