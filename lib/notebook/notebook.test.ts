import { describe, expect, it } from "vitest";
import { applyPatches, MAX_PAGE, refused, type Patch } from "./notebook.ts";
import { sessionReadSchema } from "./session-close.ts";

const p = (x: Partial<Patch>): Patch => ({ page: "asking", op: "append", line: "asks 'why' about animals", reason: "three why questions", ...x });

describe("refused (rule 11)", () => {
  it.each(["might have ADHD", "seems dyslexic", "possibly autistic", "a slow learner", "is lazy", "her score is 80", "anxiety disorder"])("refuses %s", (line) => {
    expect(refused(line)).toBe(true);
  });
  it.each(["asks 'why' about animals", "likes picture clues", "mixes up larva and pupa", "laughed at the tadpole joke"])("keeps %s", (line) => {
    expect(refused(line)).toBe(false);
  });
});

describe("applyPatches", () => {
  it("appends a dated line and skips a repeat", () => {
    const { changed } = applyPatches({}, [p({}), p({ line: "Asks 'why' about animals" })], "2026-10-29");
    expect(changed.asking).toBe("2026-10-29: asks 'why' about animals");
  });

  it("refuses labels, in the line or the reason, and changes nothing for them", () => {
    const { changed, refusedPatches } = applyPatches({}, [p({ line: "may be dyslexic" }), p({ page: "slips", line: "mixes up b and d", reason: "dyslexia signs" })], "2026-10-29");
    expect(changed).toEqual({});
    expect(refusedPatches).toHaveLength(2);
  });

  it("removes a line by its words", () => {
    const { changed } = applyPatches({ slips: "2026-10-20: mixes up larva and pupa\n2026-10-21: forgets units" }, [p({ page: "slips", op: "remove_line", line: "forgets units" })], "2026-10-29");
    expect(changed.slips).toBe("2026-10-20: mixes up larva and pupa");
  });

  it("keeps a page short by dropping the oldest lines", () => {
    const long = Array.from({ length: 30 }, (_, i) => `2026-10-01: an older note number ${i} about how they like to learn`).join("\n");
    const { changed } = applyPatches({ personality: long }, [p({ page: "personality", line: "loves drawing the answer" })], "2026-10-29");
    expect(changed.personality!.length).toBeLessThanOrEqual(MAX_PAGE);
    expect(changed.personality!.endsWith("loves drawing the answer")).toBe(true);
    expect(changed.personality!.startsWith("2026-10-01: an older note number 0 ")).toBe(false);
  });
});

describe("sessionReadSchema", () => {
  it("accepts a reading and rejects a made-up mood", () => {
    const ok = { mood: "curious", confidence: "medium", evidence: ["why do tadpoles have tails"], concern: false, patches: [] };
    expect(sessionReadSchema.safeParse(ok).success).toBe(true);
    expect(sessionReadSchema.safeParse({ ...ok, mood: "depressed" }).success).toBe(false);
    expect(sessionReadSchema.safeParse({ ...ok, evidence: ["a", "b", "c", "d"] }).success).toBe(false);
  });
});

describe("notebookNotes", () => {
  it("is empty without pages, and strips dates otherwise", async () => {
    const { notebookNotes } = await import("./notebook.ts");
    expect(notebookNotes("Jordan", [])).toBe("");
    const out = notebookNotes("Jordan", [{ slug: "asking", body: "2026-10-29: asks why about animals" }]);
    expect(out).toContain("How they ask: asks why about animals");
    expect(out).not.toContain("2026-10-29");
  });
});
