import { describe, expect, it } from "vitest";
import { guardianFlags, isEvening } from "./flags.ts";
import { nextStep, type NextStepInput } from "./next-step.ts";
import { activityForPath, inQuietHours, JUNIOR_SETTINGS, lastDays, minutesSinceBreak, screenTimeByDay, type Beat } from "./screen-time.ts";
import { focusBaseline, sessionFocus, type GuardianSession } from "./session.ts";
import { checkWords, moodFromWords } from "./words.ts";

const S = JUNIOR_SETTINGS;
/** Beats every 30 s for `min` minutes from an SGT wall time on 28 Oct 2026. */
const beats = (sgt: string, min: number, kind: Beat["kind"]): Beat[] => {
  const start = Date.parse(`2026-10-28T${sgt}:00+08:00`);
  return Array.from({ length: min * 2 }, (_, i) => ({ at: new Date(start + i * 30_000).toISOString(), kind }));
};
const session = (start: string, over: Partial<GuardianSession> = {}): GuardianSession => ({
  id: start,
  start,
  end: new Date(Date.parse(start) + 10 * 60_000).toISOString(),
  answers: [{ ms: 9_000, hinted: false }, { ms: 12_000, hinted: false }],
  idleGaps: 0,
  hiddenMs: 0,
  quitMidQuest: false,
  mood: null,
  cameraTired: false,
  ...over,
});

describe("activity and screen time", () => {
  it("files each kid route under learning, play, making or other", () => {
    expect(["/learn/frog-life-cycle", "/question/x", "/arcade/star-typer", "/vibe", "/talk", "/home", "/treasure", "/me"].map(activityForPath)).toEqual([
      "learn",
      "learn",
      "play",
      "create",
      "create",
      "other",
      "other",
      "other",
    ]);
  });

  it("counts minutes per Singapore day by activity, flags the limit and late minutes", () => {
    const day = screenTimeByDay([...beats("18:00", 40, "learn"), ...beats("19:00", 25, "play"), ...beats("21:10", 6, "learn")], ["2026-10-28"], S)[0];
    expect(day).toMatchObject({ minutes: { learn: 46, play: 25, create: 0, other: 0 }, total: 71, lateMinutes: 6, overLimit: true });
  });

  it("de-duplicates beats from two tabs in the same 30 s", () => {
    const b = beats("18:00", 10, "learn");
    expect(screenTimeByDay([...b, ...b], ["2026-10-28"], S)[0].total).toBe(10);
  });

  it("measures time since the last real break (a gap of 3 min or more)", () => {
    const b = [...beats("18:00", 15, "learn"), ...beats("18:20", 12, "learn")];
    expect(minutesSinceBreak(b, "2026-10-28T18:32:00+08:00")).toBe(12);
    expect(minutesSinceBreak(b, "2026-10-28T19:00:00+08:00")).toBe(0);
  });

  it("knows quiet hours across midnight and the last seven days", () => {
    expect(inQuietHours("2026-10-28T21:30:00+08:00", S)).toBe(true);
    expect(inQuietHours("2026-10-29T06:30:00+08:00", S)).toBe(true);
    expect(inQuietHours("2026-10-28T19:30:00+08:00", S)).toBe(false);
    expect(lastDays("2026-10-28T23:30:00+08:00", 3)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28"]);
  });
});

describe("the child's words", () => {
  it("always catches distress and safety words", () => {
    for (const t of ["I feel like giving up on everything", "i want to die", "Nobody cares about me", "someone hurt me", "I wanna hurt myself", "i dun want to live"]) {
      expect(checkWords(t).distress, t).toBe(true);
    }
  });

  it("doesn't flag ordinary frustration as distress", () => {
    for (const t of ["this sum is killing me", "I hate fractions", "this is so hard", "I died laughing"]) expect(checkWords(t).distress, t).toBe(false);
  });

  it("spots negative self-talk as a watch sign", () => {
    expect(checkWords("I'm so stupid").selfTalk).toBe(true);
    expect(checkWords("I can't do anything right").selfTalk).toBe(true);
    expect(checkWords("I'm stuck on this one").selfTalk).toBe(false);
  });

  it("reads a first mood from the words, caring signs first, and keeps the words behind it", () => {
    expect(moodFromWords([])).toBeNull();
    expect(moodFromWords(["ok next"])).toEqual({ mood: "calm", confidence: "low", evidence: [] });
    expect(moodFromWords(["yay I did it", "I'm so sleepy", "so tired"])).toEqual({ mood: "tired", confidence: "medium", evidence: ["I'm so sleepy", "so tired"] });
    expect(moodFromWords(["why do tadpoles lose their tails?"])?.mood).toBe("curious");
  });
});

describe("session focus", () => {
  it("starts at 100 and loses points for guesses, idle gaps, leaving the app and hints on everything", () => {
    expect(sessionFocus(session("2026-10-28T10:00:00Z"))).toBe(100);
    const busy = session("2026-10-28T10:00:00Z", { answers: [{ ms: 1_500, hinted: true }, { ms: 2_000, hinted: true }], idleGaps: 1, hiddenMs: 120_000 });
    expect(sessionFocus(busy)).toBe(100 - 20 - 8 - 10 - 10);
  });

  it("uses the child's own median as the usual, 80 until there are three sessions", () => {
    expect(focusBaseline([session("2026-10-27T10:00:00Z")], "2026-10-28T10:00:00Z")).toBe(80);
    const three = [session("2026-10-26T10:00:00Z"), session("2026-10-27T10:00:00Z", { idleGaps: 1 }), session("2026-10-27T11:00:00Z", { idleGaps: 3 })];
    expect(focusBaseline(three, "2026-10-28T10:00:00Z")).toBe(92);
  });
});

describe("guardian flags", () => {
  const base = { nickname: "Ari", now: "2026-10-28T13:00:00Z", settings: S, messages: [], sessions: [], days: [] };

  it("raises an urgent flag with the words and the helplines for distress", () => {
    const [f] = guardianFlags({ ...base, messages: [{ at: "2026-10-28T11:42:00Z", text: "I feel like giving up on everything" }] });
    expect(f).toMatchObject({ level: "urgent", kind: "distress", quote: "I feel like giving up on everything", helplines: true, title: "Ari wrote something worrying to Kix" });
  });

  it("watches tired evenings: three sessions after 8 pm with tired signs", () => {
    const evenings = ["2026-10-24T12:30:00Z", "2026-10-26T12:40:00Z", "2026-10-27T13:00:00Z"].map((start, i) =>
      session(start, i === 0 ? { mood: { mood: "tired", confidence: "low", evidence: ["I'm sleepy"] } } : i === 1 ? { cameraTired: true } : { answers: [{ ms: 1_000, hinted: true }, { ms: 1_200, hinted: true }], idleGaps: 2 }),
    );
    expect(isEvening(evenings[0].start, S)).toBe(true);
    const f = guardianFlags({ ...base, sessions: evenings }).find((x) => x.kind === "tired-evenings");
    expect(f?.level).toBe("watch");
    expect(f?.title).toBe("Ari seemed tired in 3 evening sessions");
    expect(f?.saw).toHaveLength(3);
  });

  it("lists over-limit days as info, after urgent and watch flags", () => {
    const days = screenTimeByDay(beats("18:00", 70, "learn"), ["2026-10-28"], S);
    const flags = guardianFlags({ ...base, days, messages: [{ at: "2026-10-28T11:00:00Z", text: "I'm so stupid" }] });
    expect(flags.map((f) => `${f.level}:${f.kind}`)).toEqual(["watch:self-talk", "info:over-limit"]);
  });
});

describe("next step", () => {
  const today = screenTimeByDay(beats("17:00", 10, "learn"), ["2026-10-28"], S)[0];
  const input: NextStepInput = {
    nickname: "Ari",
    now: "2026-10-28T17:20:00+08:00",
    settings: S,
    today,
    sinceBreakMin: 5,
    focusDip: false,
    sleepy: false,
    mood: null,
    reviewsDue: 0,
    quest: { title: "The frog life cycle", href: "/learn/frog-life-cycle", minutes: 9 },
    arcade: true,
    vibe: false,
  };

  it("rests in quiet hours and when the limit is used up", () => {
    expect(nextStep({ ...input, now: "2026-10-28T21:15:00+08:00" }).kind).toBe("rest");
    const full = screenTimeByDay(beats("17:00", 60, "learn"), ["2026-10-28"], S)[0];
    expect(nextStep({ ...input, today: full }).kind).toBe("rest");
  });

  it("suggests a break after the break interval, or sooner when focus dips or Ari seems sleepy", () => {
    expect(nextStep({ ...input, sinceBreakMin: 20 }).kind).toBe("break");
    expect(nextStep({ ...input, sinceBreakMin: 9, focusDip: true }).why).toMatch(/focus dipped/);
    expect(nextStep({ ...input, sleepy: true }).kind).toBe("break");
  });

  it("puts reviews and learning before play, and opens play on learning time, not on scores", () => {
    expect(nextStep({ ...input, reviewsDue: 2 }).kind).toBe("review");
    expect(nextStep(input)).toMatchObject({ kind: "learn", why: "10 of today's 25 learning minutes done; about 15 to go." });
    const learned = screenTimeByDay(beats("16:00", 30, "learn"), ["2026-10-28"], S)[0];
    expect(nextStep({ ...input, today: learned, sinceBreakMin: 2 })).toMatchObject({ kind: "play", href: "/arcade" });
  });

  it("eases off after a frustrated session", () => {
    expect(nextStep({ ...input, mood: "frustrated" })).toMatchObject({ kind: "review", cta: "Warm up" });
  });
});
