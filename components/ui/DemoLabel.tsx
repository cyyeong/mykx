// "Demo family · synthetic data": shown on every signed-in page while the demo family is signed in, so the
// synthetic learners and their sample progress are never mistaken for real children (AGENTS.md rule 8).
import { Suspense } from "react";
import { isDemoFamily } from "@/lib/auth/server";
import "./demoLabel.css";

type Variant = "pill" | "bar";

async function Label({ variant }: { variant: Variant }) {
  if (!(await isDemoFamily())) return null;
  return (
    <p className={variant === "bar" ? "kidnav-demo" : "demo-label"} title="Ari, Zara and Mei are made-up learners. Their progress is sample data.">
      Demo family · synthetic data
    </p>
  );
}

/** `bar` renders the line inside the kid nav's phone bar (styled by kid-tabs.css); `pill` is the floating label. */
export function DemoLabel({ variant = "pill" }: { variant?: Variant }) {
  return (
    <Suspense fallback={null}>
      <Label variant={variant} />
    </Suspense>
  );
}
