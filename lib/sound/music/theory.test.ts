import { describe, expect, it } from "vitest";
import { barBeats, barHits, chordPcs, midiOf, nearest, noteOf, parseBarLine, parseChord } from "./theory";

describe("music theory helpers", () => {
  it("reads and writes note names", () => {
    expect(midiOf("C4")).toBe(60);
    expect(midiOf("Bb3")).toBe(58);
    expect(midiOf("F#5")).toBe(78);
    expect(midiOf("H2")).toBeNull();
    expect(noteOf(61)).toBe("C#4");
    expect(nearest(0, 66)).toBe(60);
    expect(nearest(0, 67)).toBe(72);
  });

  it("parses chord symbols, slash basses included", () => {
    expect([...chordPcs(parseChord("Cmaj9")!)].sort((a, b) => a - b)).toEqual([0, 2, 4, 7, 11]);
    expect(parseChord("G/B")!.bass).toBe(11);
    expect(parseChord("D9/F#")!.root).toBe(2);
    expect(parseChord("Bm7b5")!.tones).toEqual([0, 3, 6, 10]);
    expect(parseChord("Ebmaj7")!.root).toBe(3);
    expect(parseChord("Cmaj13")).toBeNull();
    expect(parseChord("X7")).toBeNull();
  });

  it("parses bar lines with rests and dyads", () => {
    const bar = parseBarLine("C5:0.5 E5+G5:1.5 r:2")!;
    expect(bar).toEqual([
      { notes: ["C5"], beats: 0.5 },
      { notes: ["E5", "G5"], beats: 1.5 },
      { notes: [], beats: 2 },
    ]);
    expect(barBeats(bar)).toBe(4);
    expect(parseBarLine("C5:0.3")).toBeNull();
    expect(parseBarLine("C5")).toBeNull();
    expect(parseBarLine("Q5:1")).toBeNull();
  });

  it("reads step patterns with holds, rests and multi-bar cycles", () => {
    expect(barHits("1-..5-..8---5...", 0, 16)).toEqual([
      { step: 0, len: 2, ch: "1" },
      { step: 4, len: 2, ch: "5" },
      { step: 8, len: 4, ch: "8" },
      { step: 12, len: 1, ch: "5" },
    ]);
    // A hold after a rest does not stretch the earlier hit.
    expect(barHits("1..-", 0, 4)).toEqual([{ step: 0, len: 1, ch: "1" }]);
    // Two-bar patterns alternate by bar.
    expect(barHits("1...|5...", 1, 4)).toEqual([{ step: 0, len: 1, ch: "5" }]);
    expect(barHits("1...|5...", 2, 4)).toEqual([{ step: 0, len: 1, ch: "1" }]);
  });
});
