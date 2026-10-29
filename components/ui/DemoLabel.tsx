// The sample family's honesty line, on every signed-in page while it is signed in (AGENTS.md rule 8). Jordan, Abby and
// Leonard are sample learners and their history is made up, but what happens now is real (founder, 29 Oct): with a
// model key, Kix and the other agents answer live from Meta's models, and new answers, reports and fixes are real.
// Without one (the guest site, a fresh clone) the replies are ready-made samples, and the line says so.
import { Suspense } from "react";
import { isDemoFamily } from "@/lib/auth/server";
import { hasMetaApiKey } from "@/lib/meta/client";
import "./demoLabel.css";

type Variant = "pill" | "bar";

async function Label({ variant }: { variant: Variant }) {
  if (!(await isDemoFamily())) return null;
  const live = hasMetaApiKey(); // false on the guest site (lib/guest.ts) and without MODEL_API_KEY
  const what = live ? "live AI" : "sample replies";
  const title = live
    ? "Jordan, Abby and Leonard are sample learners, and their history (progress, messages, readings) is made up. What happens now is real: Kix's replies come live from Meta's models, and new answers, reports and fixes are real."
    : "Jordan, Abby and Leonard are sample learners, and their history is made up. Kix answers here with ready-made sample replies.";
  return (
    <p className={variant === "bar" ? "kidnav-demo" : "demo-label"} title={title}>
      {variant === "bar" ? `Sample family · ${what}` : `Sample family · made-up history · ${what}`}
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
