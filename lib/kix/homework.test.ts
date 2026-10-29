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

  it("a hint starts the child off and no more, even when the model writes every step", () => {
    const leaky = {
      ...sampleExplanation("full"),
      blocks: [
        { kind: "say" as const, title: null, text: "Marbles only move, so the total stays the same.", steps: null, bars: null, claim: null, evidence: null, reasoning: null, hook: null, question: null, answer: null },
        { kind: "steps" as const, title: "Solve it", text: null, steps: ["Before: A = 3u, B = 1u.", "After: A = 1p, B = 2p.", "5u = 85, so 1u = 17.", "Box A = 9u = 153."], bars: null, claim: null, evidence: null, reasoning: null, hook: null, question: null, answer: null },
        { kind: "bar-model" as const, title: "See the move", text: null, steps: null, bars: [{ label: "Before", parts: [{ label: "A", value: "9u" }] }], claim: null, evidence: null, reasoning: null, hook: null, question: null, answer: null },
        { kind: "cer" as const, title: null, text: null, steps: null, bars: null, claim: "It died.", evidence: "Ring cut.", reasoning: "No food reached the roots.", hook: null, question: null, answer: null },
        { kind: "memory-hook" as const, title: null, text: "Moving seats doesn't change the class size.", steps: null, bars: null, claim: null, evidence: null, reasoning: null, hook: "story" as const, question: null, answer: null },
      ],
    };
    const hint = enforceStage(leaky, "hint");
    expect(hint.blocks.map((b) => b.kind)).toEqual(["say", "steps", "memory-hook"]);
    expect(hint.blocks[1].steps).toEqual(["Before: A = 3u, B = 1u."]);
    expect(JSON.stringify(hint)).not.toMatch(/153|No food reached/);
    const steps = enforceStage(leaky, "steps");
    expect(steps.blocks.find((b) => b.kind === "cer")?.reasoning).toBeNull();
    expect(steps.blocks.find((b) => b.kind === "bar-model")).toBeTruthy();
    expect(explanationSchema.safeParse(hint).success).toBe(true);
  });

  it("the cached samples are valid explanations at every stage (rule 7)", () => {
    for (const stage of ["hint", "steps", "full"] as const) expect(explanationSchema.safeParse(sampleExplanation(stage)).success).toBe(true);
  });

  it("reads the teaching notes of the kid's level only", () => {
    expect(packsForLevel("P3")).toEqual(["p3-maths", "p3-science", "p3-english", "p3-chinese"]);
    expect(packsForLevel("P6")).toEqual(["p6-english", "p6-maths", "p6-science", "p6-chinese"]);
    expect(packsForLevel("Sec 2")).toEqual(["s2-english", "s2-maths", "s2-science", "s2-chinese"]);
    const notes = teachingNotes("P6");
    expect(notes).toContain("## Pack p6-maths");
    expect(notes).not.toContain("## Pack p3-");
  });
});
