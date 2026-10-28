import { describe, expect, it } from "vitest";
import { ago, briefDigest, briefFacts, fallbackBrief, hasAnything, type BriefInput } from "./brief.ts";

const base = (): BriefInput => ({
  kids: [
    { nickname: "Jordan", sharing: "on", place: null, motion: "walking", minutesAgo: 1, lastEvent: "left School 15:12" },
    { nickname: "Abby", sharing: "on", place: "School", motion: "still", minutesAgo: 6, lastEvent: null },
    { nickname: "Leonard", sharing: "paused", place: "Home", motion: "still", minutesAgo: 40, lastEvent: null },
  ],
  rooms: [{ room: "Living room", who: ["Abby", "Jordan"], activity: "arguing", cue: "frowning", concern: "watch", minutesAgo: 1 }, { room: "Kitchen", who: [], activity: "nobody here", cue: null, concern: "none", minutesAgo: 3 }],
  alerts: [{ level: "watch", kind: "conflict", room: "Living room", minutesAgo: 1 }],
  camerasOn: true,
});

describe("the Guardian Brief's facts", () => {
  it("carries names, places, motion and times, and never a coordinate", () => {
    const f = briefFacts(base());
    expect(f).toContain("Jordan: out and about, possibly walking (just now). Latest: left School 15:12.");
    expect(f).toContain("Leonard: paused location sharing");
    expect(f).toContain("Unchecked watch note: conflict in the Living room");
    expect(f).not.toMatch(/\d\.\d{3,}/);
  });

  it("is coarse in time, so it only changes when something has", () => {
    expect([0, 1, 5, 12, 28, 60, 200].map(ago)).toEqual(["just now", "just now", "a few minutes ago", "about 10 minutes ago", "about 30 minutes ago", "about an hour ago", "a while ago"]);
    const a = base();
    const b = base();
    b.kids[0].minutesAgo = 1.4;
    expect(briefDigest(a)).toBe(briefDigest(b));
    b.rooms[0].activity = "watching a screen";
    expect(briefDigest(a)).not.toBe(briefDigest(b));
  });

  it("writes a fallback in the rules' own words, putting notes first, and knows when there is nothing", () => {
    expect(fallbackBrief(base())).toBe("One note needs a look: conflict in the Living room. Jordan is possibly walking, Abby is at School. Living room: Abby and Jordan (arguing).");
    expect(hasAnything({ kids: [{ nickname: "Jordan", sharing: "on", place: null, motion: null, minutesAgo: null, lastEvent: null }], rooms: [], alerts: [], camerasOn: false })).toBe(false);
    expect(hasAnything(base())).toBe(true);
  });
});
