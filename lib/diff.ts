// A line diff for the admin's version screens (skills and agents): which lines a version added, removed or kept.
// Longest common subsequence over lines; fine for the few hundred lines a skill file or an agent's instructions
// hold. Pure, so the browser and the server show the same result.

export type DiffLine = { kind: "same" | "add" | "del"; text: string };

/** Lines of `before` and `after`, in order, each marked kept, added or removed. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  // Above this size an exact table gets slow; fall back to "everything changed", which is still correct.
  if (a.length * b.length > 4_000_000) return [...a.map((text) => ({ kind: "del" as const, text })), ...b.map((text) => ({ kind: "add" as const, text }))];
  const n = a.length;
  const m = b.length;
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ kind: "del", text: a[i++] });
    else out.push({ kind: "add", text: b[j++] });
  }
  while (i < n) out.push({ kind: "del", text: a[i++] });
  while (j < m) out.push({ kind: "add", text: b[j++] });
  return out;
}

/** Counts of added and removed lines. */
export function diffStats(lines: readonly DiffLine[]): { added: number; removed: number } {
  return { added: lines.filter((l) => l.kind === "add").length, removed: lines.filter((l) => l.kind === "del").length };
}

/** Only the changed lines with `context` kept lines around each change; gaps become a single "…" line. */
export function diffHunks(lines: readonly DiffLine[], context = 2): (DiffLine | { kind: "gap"; text: string })[] {
  const keep = lines.map((l) => l.kind !== "same");
  const near = lines.map((_, i) => keep.slice(Math.max(0, i - context), i + context + 1).some(Boolean));
  const out: (DiffLine | { kind: "gap"; text: string })[] = [];
  let gap = false;
  lines.forEach((l, i) => {
    if (near[i]) {
      out.push(l);
      gap = false;
    } else if (!gap) {
      out.push({ kind: "gap", text: "…" });
      gap = true;
    }
  });
  return out;
}
