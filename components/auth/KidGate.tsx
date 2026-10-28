// Kid pages show only to a signed-in kid; anyone else goes to the kids' doors (and from there to sign-in).
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getSignedInKid } from "@/lib/auth/server";

async function Gate({ children }: { children: ReactNode }) {
  if (!(await getSignedInKid())) redirect("/doors");
  return children;
}

export function KidGate({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div style={{ minHeight: "var(--screen-h, 100dvh)", background: "var(--surface)" }} />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
