import { describe, expect, it } from "vitest";
import { diffHunks, diffLines, diffStats } from "./diff.ts";

describe("line diff", () => {
  it("marks added, removed and kept lines in order", () => {
    const d = diffLines("a\nb\nc", "a\nc\nd");
    expect(d).toEqual([
      { kind: "same", text: "a" },
      { kind: "del", text: "b" },
      { kind: "same", text: "c" },
      { kind: "add", text: "d" },
    ]);
    expect(diffStats(d)).toEqual({ added: 1, removed: 1 });
  });

  it("shows nothing changed for the same text, and folds long unchanged runs", () => {
    expect(diffStats(diffLines("x\ny", "x\ny"))).toEqual({ added: 0, removed: 0 });
    const before = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    const after = before.replace("line 10", "line ten");
    const h = diffHunks(diffLines(before, after), 1);
    expect(h.filter((l) => l.kind === "gap")).toHaveLength(2);
    expect(h.find((l) => l.kind === "add")?.text).toBe("line ten");
  });
});
