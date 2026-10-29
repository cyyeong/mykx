import { describe, expect, it } from "vitest";
import { enforceStage, explanationSchema, packsForLevel, sampleExplanation, teachingNotes } from "./homework.ts";

describe("Ask Kix", () => {
  it("keeps the answer back until the full stage, whatever the model sends", () => {
    const full = sampleExplanation("full");
    const hint = enforceStage(full, "hint");
    expect(hint.stage).toBe("hint");
    expect(hint.finalAnswer).toBeNull();
    expect(hint.blocks.some((b) => b.kind === "try-this")).toBe(false);
    expect(enforceStage(full, "full").finalAnswer).toBe(full.finalAnswer);
  });

  it("the cached samples are valid explanations at every stage (rule 7)", () => {
    for (const stage of ["hint", "steps", "full"] as const) expect(explanationSchema.safeParse(sampleExplanation(stage)).success).toBe(true);
  });

  it("reads the teaching notes of the kid's level only", () => {
    expect(packsForLevel("P3")).toEqual(["p3-maths", "p3-science", "p3-english", "p3-chinese"]);
    expect(packsForLevel("P6")).toEqual(["p6-maths", "p6-science", "p6-english"]);
    expect(packsForLevel("Sec 2")).toEqual(["s2-science", "s2-english"]);
    const notes = teachingNotes("P6");
    expect(notes).toContain("## Pack p6-maths");
    expect(notes).not.toContain("## Pack p3-");
  });
});
