// Kix's caring reply when a child's words show distress (AGENTS.md rule 12): kind words, a trusted adult, and the
// helplines, every time. Kix never counsels and never promises a secret; the grown-up already has an urgent flag.
import type { CSSProperties } from "react";

export interface Care {
  reply: string;
  helplines: readonly { name: string; number: string; note: string }[];
}

export function CareCard({ care, style }: { care: Care; style?: CSSProperties }) {
  return (
    <section
      role="alert"
      aria-label="Kix cares"
      style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderRadius: "var(--radius-lg)", background: "var(--surface-raised)", color: "var(--ink)", boxShadow: "inset 0 0 0 3px var(--accent), var(--shadow-raised)", ...style }}
    >
      <p style={{ margin: 0, fontSize: 18, lineHeight: "26px", fontWeight: 700 }}>{care.reply}</p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {care.helplines.map((h) => (
          <li key={h.number} style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, fontSize: 16, lineHeight: "22px", fontWeight: 700 }}>
            <span>{h.name}</span>
            <a href={`tel:${h.number.replace(/\s/g, "")}`} style={{ color: "var(--accent)", fontWeight: 800, fontSize: 20 }}>
              {h.number}
            </a>
            <span style={{ color: "var(--ink-muted)", fontWeight: 600 }}>({h.note})</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
