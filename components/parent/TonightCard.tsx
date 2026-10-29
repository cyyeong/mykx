"use client";

// Tonight (GUARDIAN §2.5): the evening summary at the top of Today. Muse Spark narrates facts the app collected (each
// kid's screen time and learning, unseen flags, and Guardian's afternoon); when it can't, the rules' own sentence shows,
// labelled. Words only, never a score; "possibly" where it's unsure.
import { useEffect, useState } from "react";
import { api } from "@/components/account/api";
import { clock } from "@/components/location/types";

type Tonight = { text: string; source: "live" | "fallback"; at: string; title: string };

export function TonightCard() {
  const [t, setT] = useState<Tonight | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    void api<{ tonight: Tonight | null }>("GET", "/api/guardian/tonight").then((r) => live && r.ok && r.data && setT(r.data.tonight));
    return () => {
      live = false;
    };
  }, [version]);
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && setVersion((v) => v + 1), 120_000);
    return () => clearInterval(id);
  }, []);

  if (!t) return null;
  // Styled by parent.css (.ptonight): a glass card inside the Today header, in the grown-up's look.
  return (
    <section className="ptonight" aria-label={t.title}>
      <h2>
        <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14">
          <path fill="currentColor" d="M12 2c.6 4.8 4.2 8.4 9 9-4.8.6-8.4 4.2-9 9-.6-4.8-4.2-8.4-9-9 4.8-.6 8.4-4.2 9-9z" />
        </svg>
        {t.title}
      </h2>
      <p>{t.text}</p>
      <small>{t.source === "live" ? `Muse Spark, from today’s screen time, learning, the map and the cameras · ${clock(t.at)}` : `Summary from the rules (Muse Spark wasn’t available) · ${clock(t.at)}`}</small>
    </section>
  );
}
