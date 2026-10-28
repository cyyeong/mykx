import { describe, expect, it } from "vitest";
import { DEMO_OUTINGS } from "./sample.ts";
import { inviteText, outingDates, plannerSchema, refreshesLeft, scoutPrompt, settleIdeas, startMinutes } from "./outings.ts";
import { weatherLines } from "./weather.ts";

describe("outings", () => {
  it("picks the coming Saturday and Sunday, or what's left of the weekend, in Singapore time", () => {
    expect(outingDates(new Date("2026-10-28T09:00:00Z"))).toEqual(["2026-10-31", "2026-11-01"]); // Wednesday
    expect(outingDates(new Date("2026-10-31T01:00:00Z"))).toEqual(["2026-10-31", "2026-11-01"]); // Saturday
    expect(outingDates(new Date("2026-11-01T01:00:00Z"))).toEqual(["2026-11-01"]); // Sunday
    expect(outingDates(new Date("2026-10-30T17:00:00Z"))).toEqual(["2026-10-31", "2026-11-01"]); // Saturday 01:00 in Singapore
  });

  it("tells the Scout only the area, radius, interests and dates", () => {
    const p = scoutPrompt({ area: "Sengkang", radiusKm: 3, interests: ["badminton", "cycling"], dates: ["2026-10-31", "2026-11-01"] });
    expect(p).toContain("near Sengkang, Singapore, within about 3 km");
    expect(p).toContain("badminton, cycling");
    expect(p).not.toMatch(/\b(Jordan|Abby|Leonard)\b|\bage\b|\bchild/i);
  });

  it("keeps only ideas for the asked dates whose source the Scout really cited, once each", () => {
    const idea = (day: string, source: string, tag = "Cycling") => ({ day, when: "9:00", tag, title: "A title", where: "Somewhere", facts: "Some facts", why: "Because", source });
    const out = plannerSchema.parse({
      summary: "A drier Saturday and a showery Sunday.",
      ideas: [
        idea("2026-10-31", "https://www.nparks.gov.sg/parks/sengkang-riverside-park/"),
        idea("2026-10-31", "https://nparks.gov.sg/parks/sengkang-riverside-park"), // the same page again
        idea("2026-11-01", "https://made-up.example/place"), // never cited
        idea("2026-11-09", "https://www.nparks.gov.sg/parks/sengkang-riverside-park"), // not a date asked
        idea("2026-11-01", "https://www.activesgcircle.gov.sg/facilities/sengkang-sport-hall", "Chess"),
      ],
    });
    const ideas = settleIdeas(out, ["https://www.nparks.gov.sg/parks/sengkang-riverside-park", "https://www.activesgcircle.gov.sg/facilities/sengkang-sport-hall"], ["2026-10-31", "2026-11-01"], ["cycling", "badminton"]);
    expect(ideas.map((i) => [i.day, i.tag, i.sourceHost])).toEqual([["2026-10-31", "Cycling", "nparks.gov.sg"], ["2026-11-01", "Other", "activesgcircle.gov.sg"]]);
  });

  it("allows three searches a day, counted in Singapore time", () => {
    const now = new Date("2026-10-28T09:00:00Z");
    expect(refreshesLeft([], now)).toBe(3);
    expect(refreshesLeft(["2026-10-28T01:00:00Z", "2026-10-28T02:00:00Z"], now)).toBe(1);
    expect(refreshesLeft(["2026-10-27T01:00:00Z"], now)).toBe(3);
  });

  it("writes a short invitation, and the demo sample is well-formed and sourced", () => {
    expect(inviteText({ day: "2026-10-31", when: "9:00–11:00", title: "Cycle the riverside", where: "Sengkang Riverside Park" })).toBe("Saturday 9:00–11:00: Cycle the riverside at Sengkang Riverside Park. Want to come?");
    expect(DEMO_OUTINGS.ideas.length).toBeGreaterThanOrEqual(4);
    for (const i of DEMO_OUTINGS.ideas) expect(i.sourceUrl).toMatch(/^https:\/\//);
  });

  it("turns NEA's outlook into plain lines, and nothing when the feed is down", async () => {
    const feed = { data: { records: [{ forecasts: [{ timestamp: "2026-10-31T00:00:00+08:00", forecast: { text: "Partly Cloudy (Day)" }, temperature: { low: 26, high: 35 } }, { timestamp: "2026-11-01T00:00:00+08:00", forecast: { text: "Thundery Showers" }, temperature: { low: 25, high: 33 } }] }] } };
    const ok = (async () => new Response(JSON.stringify(feed))) as unknown as typeof fetch;
    expect(await weatherLines(["2026-10-31", "2026-11-01"], ok)).toEqual(["Saturday 31 Oct: partly cloudy (day), 26–35°C", "Sunday 1 Nov: thundery showers, 25–33°C, showers likely"]);
    expect(await weatherLines(["2026-10-31"], (async () => new Response("no", { status: 500 })) as unknown as typeof fetch)).toEqual([]);
  });

  it("sorts by the real start time, whatever way the time is written", () => {
    expect(["9:00–11:00", "15:30–17:00", "8:00–10:00", "8am", "Sat 3-5pm", "12-1:30pm", "10am-12pm", "17:15", "no time"].map(startMinutes)).toEqual([540, 930, 480, 480, 900, 720, 600, 1035, 0]);
  });
});
