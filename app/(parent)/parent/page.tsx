import type { Metadata } from "next";
import { Suspense } from "react";
import { GrownUpGate } from "@/components/account/GrownUpGate";
import { ParentShell } from "@/components/parent/ParentShell";
import { getGrownUp } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Parent dashboard · myKx" };

// The parent dashboard (USER_STORIES §8.4 fix 6): Today, Messages, Notebook and
// Family, Kids' doors, and the account menu. Grown-ups land here after sign-in.
// Request data stays inside the boundary, so the shell can still prerender.
async function Dashboard() {
  const grownUp = await getGrownUp();
  return (
    <GrownUpGate>
      <ParentShell name={grownUp?.name ?? null} isAdmin={grownUp?.isAdmin ?? false} />
    </GrownUpGate>
  );
}

export default function ParentPage() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}
