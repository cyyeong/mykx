// The shared-device gate for grown-up pages (USER_STORIES §8.4 fix 8).
// Server wrapper: open the page, send for PIN setup, or show the PIN prompt.
// A kid past this screen still can't read anything: the data routes check the
// same unlock (see lib/auth/pin.ts).
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { grownUpGateStatus } from "@/lib/auth/server";
import { PinPrompt } from "./PinPrompt";

async function Gate({ children, setup }: { children: ReactNode; setup?: boolean }) {
  const gate = await grownUpGateStatus();
  if (gate.state === "open") return <>{children}</>;
  if (gate.state === "setup" && !setup) redirect("/family");
  if (gate.state === "setup") return <>{children}</>;
  return <PinPrompt />;
}

export function GrownUpGate({ children, setup }: { children: ReactNode; setup?: boolean }) {
  return (
    <Suspense fallback={null}>
      <Gate setup={setup}>{children}</Gate>
    </Suspense>
  );
}
