import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARI_SAMPLE_FOCUS_NOTE } from "../auth/demo-family.ts";
import {
  DEFAULT_BASELINE,
  DIP_POINTS,
  MIN_BASELINE_MINUTES,
  NUDGE_GAP_MS,
  canNudge,
  detectFocusDip,
  focusBaseline,
  focusEvidence,
  minuteScore,
  type FocusBaseline,
  type FocusMinute,
} from "./focus.ts";

const T0 = Date.parse("2026-10-28T08:00:00Z");
const at = (i: number) => new Date(T0 + i * 60_000).toISOString();

/** A calm, attentive minute unless told otherwise. */
const M = (i: number, p: Partial<Omit<FocusMinute, "minute">> = {}): FocusMinute => ({
  minute: at(i),
  awaySeconds: 3,
  eyesClosedEvents: 0,
  yawns: 0,
  facePresentRatio: 1,
  ...p,
});
const calm = (from: number, n: number) => Array.from({ length: n }, (_, k) => M(from + k, { awaySeconds: k % 3 === 0 ? 6 : 3 }));
const drifting = (i: number) => M(i, { awaySeconds: 35, eyesClosedEvents: 1, yawns: 1 });

describe("minute score", () => {
  it("is 100 for a minute facing the screen, and drops with looking away, shut eyes and yawns", () => {
    expect(minuteScore(M(0, { awaySeconds: 0 }))).toBe(100);
    expect(minuteScore(M(0, { awaySeconds: 30 }))).toBe(76);
    expect(minuteScore(M(0, { awaySeconds: 0, eyesClosedEvents: 2 }))).toBe(80);
    expect(minuteScore(M(0, { awaySeconds: 0, yawns: 1 }))).toBe(92);
    expect(minuteScore(M(0, { awaySeconds: 60, eyesClosedEvents: 30, yawns: 20 }))).toBe(0);
  });

  it("forgives a short time out of view, but a whole minute away costs about as much as looking away", () => {
    expect(minuteScore(M(0, { awaySeconds: 0, facePresentRatio: 0.8 }))).toBe(100);
    expect(minuteScore(M(0, { awaySeconds: 0, facePresentRatio: 0 }))).toBe(50);
    expect(minuteScore(M(0, { awaySeconds: 60 }))).toBe(52);
  });
});

describe("baseline", () => {
  it("uses a starting guess until there are enough of the child's own minutes", () => {
    const b = focusBaseline(calm(0, MIN_BASELINE_MINUTES - 1));
    expect(b).toEqual({ ...DEFAULT_BASELINE, minutes: MIN_BASELINE_MINUTES - 1 });
    expect(b.fromDefault).toBe(true);
  });

  it("is the median of the child's own recent minutes, ignoring minutes they were away from the screen", () => {
    const history = [...calm(0, 12), M(12, { facePresentRatio: 0 }), M(13, { facePresentRatio: 0.1 })];
    const b = focusBaseline(history);
    expect(b).toMatchObject({ score: 98, awaySeconds: 3, eyesClosedEvents: 0, yawns: 0, minutes: 12, fromDefault: false });
  });

  it("only reads minutes before `before`, so the minutes being judged don't set their own bar", () => {
    const history = [...calm(0, 10), drifting(10), drifting(11), drifting(12)];
    expect(focusBaseline(history, at(10)).score).toBe(98);
    expect(focusBaseline(history).score).toBeLessThan(98);
  });

  it("keeps one copy of a resent minute (the later one)", () => {
    const b = focusBaseline([...calm(0, 10), M(9, { awaySeconds: 60 })]);
    expect(b.minutes).toBe(10);
  });
});

describe("possibly losing focus", () => {
  const baseline = focusBaseline(calm(0, 40));

  it("fires when 3 consecutive minutes all sit well below the child's usual", () => {
    const signal = detectFocusDip([...calm(40, 5), drifting(45), drifting(46), drifting(47)], baseline);
    expect(signal).toMatchObject({ level: "watch", from: at(45), to: at(48), confidence: "high" });
    expect(signal?.evidence).toBe(
      "In 3 minutes: looked away 1 min 45 s (usually about 9 s), eyes closed 3 times (usually none), 3 yawns (usually none). Focus about 54, against a usual 98.",
    );
  });

  it("needs all three: two low minutes, or a run broken by one good minute, is not enough", () => {
    expect(detectFocusDip([drifting(0), drifting(1)], baseline)).toBeNull();
    expect(detectFocusDip([drifting(0), drifting(1), M(2), drifting(3)], baseline)).toBeNull();
    expect(detectFocusDip([drifting(0), M(1), drifting(2), drifting(3)], baseline)).toBeNull();
  });

  it("needs the minutes back to back: a gap (tab hidden, camera off) breaks the run", () => {
    expect(detectFocusDip([drifting(0), drifting(1), drifting(3)], baseline)).toBeNull();
  });

  it("is measured against the child's own baseline, not an absolute bar", () => {
    const restless: FocusBaseline = { ...baseline, score: 60 };
    expect(detectFocusDip([drifting(0), drifting(1), drifting(2)], restless)).toBeNull();
    const justUnder = M(0, { awaySeconds: 0, eyesClosedEvents: 2 }); // 80
    const b: FocusBaseline = { ...baseline, score: 80 + DIP_POINTS };
    expect(detectFocusDip([justUnder, { ...justUnder, minute: at(1) }, { ...justUnder, minute: at(2) }], b)).not.toBeNull();
    expect(detectFocusDip([justUnder, { ...justUnder, minute: at(1) }, { ...justUnder, minute: at(2) }], { ...b, score: b.score - 1 })).toBeNull();
  });

  it("raises one note per run: minutes before the last note's end don't count again", () => {
    const run = [drifting(0), drifting(1), drifting(2), drifting(3)];
    const first = detectFocusDip(run.slice(0, 3), baseline)!;
    expect(detectFocusDip(run, baseline, { after: first.to })).toBeNull();
    const later = [...run, drifting(4), drifting(5)];
    expect(detectFocusDip(later, baseline, { after: first.to })).toMatchObject({ from: at(3), to: at(6) });
  });

  it("counts sustained time out of view, and says so, with low confidence", () => {
    const away = (i: number) => M(i, { awaySeconds: 0, facePresentRatio: 0.1 });
    const signal = detectFocusDip([away(0), away(1), away(2)], baseline);
    expect(signal?.confidence).toBe("low");
    expect(signal?.evidence).toContain("Out of the camera's view for about 2 min 40 s.");
  });

  it("is low confidence on the starting guess, and says it is a guess", () => {
    const signal = detectFocusDip([drifting(0), drifting(1), drifting(2)], focusBaseline([]));
    expect(signal?.confidence).toBe("low");
    expect(signal?.evidence).toMatch(/starting guess of 85: too few minutes yet to know their usual\.$/);
    expect(signal?.evidence).not.toContain("usually");
  });

  it("is medium confidence with a shorter history or a smaller drop", () => {
    const short = focusBaseline(calm(0, 12));
    expect(detectFocusDip([drifting(20), drifting(21), drifting(22)], short)?.confidence).toBe("medium");
    const mild = (i: number) => M(i, { awaySeconds: 30, eyesClosedEvents: 0, yawns: 0 }); // 76
    expect(detectFocusDip([mild(50), mild(51), mild(52)], baseline)?.confidence).toBe("medium");
  });

  it("never names, labels or diagnoses: evidence is counts against the usual", () => {
    const signal = detectFocusDip([drifting(0), drifting(1), drifting(2)], baseline)!;
    expect(signal.evidence).not.toMatch(/ADHD|attention deficit|lazy|tired|sleepy|bored|disorder/i);
  });

  it("writes the demo family's sample note word for word", () => {
    const sample = [M(0, { awaySeconds: 38, eyesClosedEvents: 1, yawns: 1 }), M(1, { awaySeconds: 40, eyesClosedEvents: 1 }), M(2, { awaySeconds: 32, eyesClosedEvents: 1, yawns: 1 })];
    const usual: FocusBaseline = { score: 86, awaySeconds: 5, eyesClosedEvents: 0, yawns: 0, minutes: 20, fromDefault: false };
    const signal = detectFocusDip(sample, usual);
    expect(signal).toMatchObject({ evidence: ARI_SAMPLE_FOCUS_NOTE.evidence, confidence: ARI_SAMPLE_FOCUS_NOTE.confidence });
    expect(focusEvidence(sample, usual)).toBe(ARI_SAMPLE_FOCUS_NOTE.evidence);
    for (const f of ["../../supabase/seed.sql", "../../supabase/migrations/20261028_focus_camera.sql"]) {
      const text = readFileSync(new URL(f, import.meta.url), "utf8");
      expect(text).toContain(ARI_SAMPLE_FOCUS_NOTE.evidence);
      expect(text).toContain(ARI_SAMPLE_FOCUS_NOTE.id);
    }
  });
});

describe("Kix's break suggestion", () => {
  it("comes at most once every 10 minutes", () => {
    expect(canNudge(null, T0)).toBe(true);
    expect(canNudge(T0, T0 + NUDGE_GAP_MS - 1)).toBe(false);
    expect(canNudge(T0, T0 + NUDGE_GAP_MS)).toBe(true);
  });
});

describe("boundaries", () => {
  it("never imports mastery or rewards (rule 5): signals can't change them", () => {
    for (const f of ["./focus.ts", "./camera.ts", "./schemas.ts"]) {
      const text = readFileSync(new URL(f, import.meta.url), "utf8");
      expect(text).not.toMatch(/from\s+["'][^"']*(domain|mastery|rewards|ledger)[^"']*["']/);
    }
  });

  it("reads no clock: the same input gives the same output", () => {
    const text = readFileSync(new URL("./focus.ts", import.meta.url), "utf8");
    expect(text).not.toMatch(/Date\.now\(|new Date\(\)|performance\.now/);
    const minutes = [...calm(0, 30), drifting(30), drifting(31), drifting(32)];
    expect(detectFocusDip(minutes, focusBaseline(minutes, at(30)))).toEqual(detectFocusDip(minutes, focusBaseline(minutes, at(30))));
  });
});
