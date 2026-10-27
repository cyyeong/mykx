import { describe, expect, it } from "vitest";
import { pseudonymise } from "./private-names.ts";
import { FORBIDDEN_FILE_RE, findBanned, scannableText } from "./safety.ts";

describe("stand-in names", () => {
  it("swaps a private name for its stand-in, keeping case, whole words only", () => {
    const map = { Kenzo: "Jordan" }; // a made-up "real" name: tests never hold the real ones
    expect(pseudonymise("Ask Kenzo. KENZO's card, tutor-kenzo, Kenzoland.", map)).toBe("Ask Jordan. JORDAN's card, tutor-jordan, Kenzoland.");
  });
});

describe("skill-pack safety scanner", () => {
  it.each([
    ["a child's name", "Ask Jordan to explain it back."],
    ["another child's name", "Abby's exam is on Friday."],
    ["a diagnosis", "built for a student with ADHD"],
    ["a school", "from the Nan Hua paper"],
    ["a school code", "RGPS Q21(b): 424 pages"],
    ["a school code in brackets", "ACS(J) Q6"],
    ["a paper code", "Duration graph (AT11, NH28b)"],
    ["a prelim paper code", "Example (RS P1 Q24)"],
    ["a source ref", "verified against the 2025 EOY papers"],
    ["a prelim ref", "a real 2026 prelim item"],
    ["an exam date", "PSLE Science on Tuesday 29 September 2026"],
    ["a trait", "he loses focus unless it is fun"],
    ["a past-paper site", "scans from sgexam.com"],
    ["a profile field", '{ "exam_date": "2026-10-22" }'],
  ])("flags %s", (_label, text) => {
    expect(findBanned(text).length).toBeGreaterThan(0);
  });

  it("lets ordinary teaching text through", () => {
    const text = "Like poles repel. The learner explains the frog's life cycle in 3 stages (AR5: wire problems). Do not copy a past paper.";
    expect(findBanned(text)).toEqual([]);
  });

  it("skips the names of private files a manifest lists on purpose", () => {
    const manifest = JSON.stringify({ id: "x", excluded: ["references/past-papers-2025.md"], legacy_scripts: { files: ["scripts/tracker.py"] } });
    expect(findBanned(scannableText("p/skill.json", manifest))).toEqual([]);
    expect(findBanned(scannableText("p/other.json", manifest)).length).toBeGreaterThan(0);
  });

  it("rejects learner-state and script file names", () => {
    expect(FORBIDDEN_FILE_RE.test("learner_profile.json")).toBe(true);
    expect(FORBIDDEN_FILE_RE.test("tracker.py")).toBe(true);
    expect(FORBIDDEN_FILE_RE.test("P3Kai-Regular.ttf")).toBe(true);
    expect(FORBIDDEN_FILE_RE.test("demo.json")).toBe(false);
  });
});
