import { describe, expect, it } from "vitest";
import { fallbackTonight, hasTonight, tonightDigest, tonightFacts, type TonightInput } from "./tonight.ts";

const input = (): TonightInput => ({
  kids: [
    { nickname: "Jordan", screenMin: 34, limitMin: 30, over: true, lateMin: 12, learnMin: 18, sessions: 2, flags: ["Possibly tired in the evening"] },
    { nickname: "Leonard", screenMin: 0, limitMin: 60, over: false, lateMin: 0, learnMin: 0, sessions: 0, flags: [] },
  ],
  home: { arrivals: ["Jordan arrived at Home 15:41"], stretches: ["Jordan and Abby: watching a screen, 16:05–17:05 (Living room)"], notes: ["Watch: arguing in the Living room at 17:08 (checked: not right)"] },
  plans: ["Saturday 9:00–11:00: Cycle the riverside"],
});

describe("Tonight's facts", () => {
  it("lists each kid's day, the afternoon at home, the checked notes and the plan, and never a coordinate", () => {
    const f = tonightFacts(input());
    expect(f).toContain("Jordan: 34 min on myKx today (limit 30), over the limit; 2 learning sessions, 18 min; 12 min in quiet hours. Not yet seen: Possibly tired in the evening.");
    expect(f).not.toContain("Leonard:"); // nothing to say about Leonard today
    expect(f).toContain("Arrivals: Jordan arrived at Home 15:41.");
    expect(f).toContain("Note: Watch: arguing in the Living room at 17:08 (checked: not right).");
    expect(f).toContain("Planned for the weekend: Saturday 9:00–11:00: Cycle the riverside.");
    expect(f).not.toMatch(/\d\.\d{3}/);
  });

  it("changes only when the facts do, and knows an empty day", () => {
    const a = input();
    const b = input();
    expect(tonightDigest(a)).toBe(tonightDigest(b));
    b.kids[0].screenMin = 35;
    expect(tonightDigest(a)).not.toBe(tonightDigest(b));
    expect(hasTonight({ kids: [input().kids[1]], home: null, plans: [] })).toBe(false);
    expect(hasTonight(input())).toBe(true);
  });

  it("falls back to the rules' own words, attention first", () => {
    expect(fallbackTonight(input())).toBe("2 things to look at: Jordan: Possibly tired in the evening; Watch: arguing in the Living room at 17:08 (checked: not right). Jordan arrived at Home 15:41. On myKx today: Jordan 34 min (over the limit). This weekend: Saturday 9:00–11:00: Cycle the riverside.");
    // A flag that already starts with the child's nickname isn't prefixed again.
    const named = input();
    named.kids[0].flags = ["Jordan seemed tired in 3 evening sessions"];
    expect(fallbackTonight(named)).toContain("to look at: Jordan seemed tired in 3 evening sessions;");
    expect(fallbackTonight({ kids: [], home: null, plans: [] })).toBe("Nothing needs a look tonight.");
  });
});
