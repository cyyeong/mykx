"use client";

// A line diff of a pack's changed files (lib/diff.ts): between two versions, or a proposal from Muse and the draft.
import { useMemo, useState } from "react";
import { diffHunks, diffLines, diffStats } from "@/lib/diff";

export interface DiffPair {
  path: string;
  before: string | null;
  after: string | null;
}

export function DiffView({ title, pairs, onClose }: { title: string; pairs: DiffPair[]; onClose: () => void }) {
  const changed = useMemo(
    () =>
      pairs
        .filter((p) => p.before !== p.after)
        .map((p) => {
          const lines = diffLines(p.before ?? "", p.after ?? "");
          return { ...p, lines, stats: diffStats(lines) };
        }),
    [pairs],
  );
  const [open, setOpen] = useState<string | null>(null);
  const shown = changed.find((c) => c.path === open) ?? changed[0];
  return (
    <section className="sk-card sk-diff" aria-label={title}>
      <div className="sk-top">
        <h2 className="sk-h2">{title}</h2>
        <button type="button" className="sk-btn sk-btn--sm" onClick={onClose}>
          Close the diff
        </button>
      </div>
      {!changed.length ? (
        <p className="sk-muted">No differences.</p>
      ) : (
        <>
          <div className="sk-difffiles" role="group" aria-label="Changed files">
            {changed.map((c) => (
              <button key={c.path} type="button" className={`sk-btn sk-btn--sm${c.path === shown?.path ? " sk-btn--pri" : ""}`} aria-pressed={c.path === shown?.path} onClick={() => setOpen(c.path)}>
                {c.path} <span aria-label={`${c.stats.added} added, ${c.stats.removed} removed`}>{c.before === null ? "new" : c.after === null ? "removed" : `+${c.stats.added} −${c.stats.removed}`}</span>
              </button>
            ))}
          </div>
          {shown && (
            <pre className="sk-diffbody sk-mono" aria-label={`Diff of ${shown.path}`}>
              {diffHunks(shown.lines, 2)
                .slice(0, 1500)
                .map((l, i) => (
                  <span key={i} className={l.kind === "add" ? "sk-add" : l.kind === "del" ? "sk-del" : l.kind === "gap" ? "sk-gap" : "sk-ctx"}>
                    {l.text || " "}
                  </span>
                ))}
            </pre>
          )}
        </>
      )}
    </section>
  );
}
