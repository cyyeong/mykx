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
  return (
    <section aria-label={t.title} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 16px", borderRadius: "var(--radius-md)", background: "#1B2350", color: "#fff", marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, lineHeight: "24px" }}>{t.title}</h2>
      <p style={{ margin: 0, fontSize: 15, lineHeight: "22px" }}>{t.text}</p>
      <small style={{ fontSize: 12, lineHeight: "17px", color: "#B9C3EA" }}>{t.source === "live" ? `Muse Spark, from today’s screen time, learning, the map and the cameras · ${clock(t.at)}` : `Summary from the rules (Muse Spark wasn’t available) · ${clock(t.at)}`}</small>
    </section>
  );
}
