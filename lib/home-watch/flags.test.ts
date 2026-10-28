import { describe, expect, it } from "vitest";
import { alertFor } from "./flags.ts";
import type { HomeStatus, RoomReading } from "./home-watch.ts";
import { settleReading, type ReaderKid } from "./reader.ts";

const KIDS: ReaderKid[] = [{ nickname: "Jordan", band: "junior", description: "youngest, light blue T-shirt" }, { nickname: "Abby", band: "junior", description: "curly hair, yellow T-shirt" }];
const reading = (o: Partial<RoomReading> = {}): RoomReading => ({ people: [{ who: "child", likely: "Jordan", confidence: 0.8, cue: "calm" }], activity: "reading or homework", note: "", cue: "calm", hazard: "none", concern: "none", reason: "Jordan is reading.", confidence: 0.8, source: "live", ...o });
const status = (minAgo: number, r: Partial<RoomReading>): HomeStatus => ({ id: String(minAgo), cameraId: "c", at: new Date(Date.parse(AT) - minAgo * 60_000).toISOString(), reading: reading(r) });
const AT = "2026-10-30T09:08:00Z";
const base = { at: AT, recent: [] as HomeStatus[], burst: false, softened: new Set<string>(), lastAlerts: [] };

describe("the Home Reader's guards (rule 15)", () => {
  it("never names an adult or gives them a cue, and names only this family's kids", () => {
    const r = settleReading(
      { camera: "living", people: [{ who: "adult", likely: "Mum", confidence: 0.9, cue: "frowning" }, { who: "child", likely: "abby", confidence: 0.7, cue: "crying" }, { who: "child", likely: "Kai", confidence: 0.9, cue: "calm" }, { who: "child", likely: "Jordan", confidence: 0.3, cue: "smiling or laughing" }], activity: "talking", note: "n", hazard: "none", concern: "watch", reason: "r", confidence: 0.7 },
      KIDS,
      "live",
    );
    expect(r.people.map((p) => [p.who, p.likely, p.cue])).toEqual([["adult", null, null], ["child", "Abby", "crying"], ["child", null, "calm"], ["child", null, "smiling or laughing"]]);
    expect(r.cue).toBe("crying");
  });

  it("an empty room is nobody here, whatever the model said", () => {
    expect(settleReading({ camera: "k", people: [], activity: "eating or drinking", note: "", hazard: "none", concern: "none", reason: "", confidence: 0.9 }, KIDS, "live").activity).toBe("nobody here");
  });
});

describe("alert rules", () => {
  it("a window, fire or a child lying still is urgent at once; a lit stove is watch", () => {
    expect(alertFor({ ...base, reading: reading({ hazard: "child near an open window or ledge" }) })).toMatchObject({ level: "urgent", kind: "hazard" });
    expect(alertFor({ ...base, reading: reading({ hazard: "child near a lit stove" }) })).toMatchObject({ level: "watch", kind: "hazard" });
  });

  it("conflict: once is watch, two of three or a burst is urgent; a 'not right' needs one more", () => {
    const fight = { activity: "physical conflict" };
    expect(alertFor({ ...base, reading: reading(fight) })).toMatchObject({ level: "watch", kind: "conflict" });
    expect(alertFor({ ...base, reading: reading(fight), recent: [status(1, fight)] })).toMatchObject({ level: "urgent" });
    expect(alertFor({ ...base, reading: reading(fight), burst: true })).toMatchObject({ level: "urgent" });
    const soft = new Set(["conflict"]);
    expect(alertFor({ ...base, reading: reading(fight), softened: soft })).toBeNull();
    expect(alertFor({ ...base, reading: reading(fight), softened: soft, burst: true })).toMatchObject({ level: "watch" });
    expect(alertFor({ ...base, reading: reading(fight), softened: soft, recent: [status(1, fight), status(2, fight)] })).toMatchObject({ level: "urgent" });
  });

  it("arguing three times in ten minutes, or crying for five, is watch; no repeat within ten minutes", () => {
    const argue = { activity: "arguing" };
    expect(alertFor({ ...base, reading: reading(argue), recent: [status(3, argue)] })).toBeNull();
    expect(alertFor({ ...base, reading: reading(argue), recent: [status(3, argue), status(7, argue)] })).toMatchObject({ level: "watch", kind: "arguing" });
    expect(alertFor({ ...base, reading: reading(argue), recent: [status(3, argue), status(7, argue)], lastAlerts: [{ kind: "arguing", at: status(4, {}).at }] })).toBeNull();
    const cry = { people: [{ who: "child" as const, likely: "Jordan", confidence: 0.8, cue: "crying" }] };
    expect(alertFor({ ...base, reading: reading(cry), recent: [status(2, cry)] })).toBeNull();
    expect(alertFor({ ...base, reading: reading(cry), recent: [status(6, cry)] })).toMatchObject({ kind: "crying" });
  });

  it("Muse's own urgent sense becomes watch, and calm rooms raise nothing", () => {
    expect(alertFor({ ...base, reading: reading({ concern: "urgent", confidence: 0.7 }) })).toMatchObject({ level: "watch", kind: "muse" });
    expect(alertFor({ ...base, reading: reading({ concern: "urgent", confidence: 0.4 }) })).toBeNull();
    expect(alertFor({ ...base, reading: reading() })).toBeNull();
  });
});
