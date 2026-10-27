// "Demo family · synthetic data": shown on every signed-in page while the demo family is signed in, so the
// synthetic learners and their sample progress are never mistaken for real children (AGENTS.md rule 8).
import { Suspense } from "react";
import { isDemoFamily } from "@/lib/auth/server";
import "./demoLabel.css";

async function Label() {
  if (!(await isDemoFamily())) return null;
  return (
    <p className="demo-label" title="Ari, Zara and Mei are made-up learners. Their progress is sample data.">
      Demo family · synthetic data
    </p>
  );
}

export function DemoLabel() {
  return (
    <Suspense fallback={null}>
      <Label />
    </Suspense>
  );
}
