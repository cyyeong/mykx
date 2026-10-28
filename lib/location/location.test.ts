import { describe, expect, it } from "vitest";
import { distanceM, motionOf, placeAt, placeEvents, sharingNow, type LocationPoint, type Place } from "./location.ts";

const pt = (at: string, lat: number, lng: number, extra: Partial<LocationPoint> = {}): LocationPoint => ({ at, lat, lng, accuracyM: 10, speed: null, heading: null, battery: null, ...extra });
const HOME: Place = { id: "h", name: "Home", kind: "home", lat: 1.3918, lng: 103.8954, radiusM: 150 };
const SCHOOL: Place = { id: "s", name: "School", kind: "school", lat: 1.3966, lng: 103.8865, radiusM: 200 };

describe("where they are", () => {
  it("measures distance on the ground", () => {
    expect(Math.round(distanceM(HOME, SCHOOL))).toBeGreaterThan(1000);
    expect(Math.round(distanceM(HOME, SCHOOL))).toBeLessThan(1200);
  });

  it("reads motion from the phone's speed, or from distance over time", () => {
    expect(motionOf(pt("2026-10-30T07:00:00Z", 1.39, 103.89, { speed: 0.1 }), [])).toBe("still");
    expect(motionOf(pt("2026-10-30T07:00:00Z", 1.39, 103.89, { speed: 1.3 }), [])).toBe("walking");
    expect(motionOf(pt("2026-10-30T07:00:00Z", 1.39, 103.89, { speed: 3 }), [])).toBe("running");
    expect(motionOf(pt("2026-10-30T07:00:00Z", 1.39, 103.89, { speed: 9 }), [])).toBe("vehicle");
    // 140 m in 2 minutes is about 1.2 m/s: walking.
    const a = pt("2026-10-30T07:00:00Z", 1.39, 103.89);
    expect(motionOf(pt("2026-10-30T07:02:00Z", 1.39126, 103.89), [a])).toBe("walking");
    expect(motionOf(pt("2026-10-30T07:00:00Z", 1.39, 103.89), [])).toBe("unknown");
  });

  it("only calls cycling after a minute of it, and playing when lively but staying put", () => {
    expect(motionOf(pt("2026-10-30T07:00:00Z", 1.39, 103.89, { speed: 5 }), [])).toBe("running");
    const before = pt("2026-10-30T06:58:30Z", 1.389, 103.89, { speed: 5.2 });
    expect(motionOf(pt("2026-10-30T07:00:00Z", 1.39, 103.89, { speed: 5 }), [before])).toBe("cycling");
    const here = pt("2026-10-30T07:00:00Z", 1.39, 103.89);
    expect(motionOf(pt("2026-10-30T07:03:00Z", 1.39005, 103.89, { activity: 6, speed: 0.5 }), [here])).toBe("playing");
    expect(motionOf(pt("2026-10-30T07:03:00Z", 1.392, 103.89, { activity: 6, speed: 0.5 }), [here])).toBe("walking");
    // Just arrived: the walk there is still in the window, so the first fix isn't "playing", the next ones are.
    const walk = [pt("2026-10-30T07:00:00Z", 1.3921, 103.8952, { speed: 1.3 }), pt("2026-10-30T07:01:00Z", 1.3923, 103.8954, { speed: 1.3 })];
    const first = pt("2026-10-30T07:02:00Z", 1.3949, 103.8907, { activity: 7, speed: 0.6 });
    expect(motionOf(first, walk)).toBe("walking");
    const second = pt("2026-10-30T07:02:40Z", 1.39491, 103.89071, { activity: 7, speed: 0.6 });
    expect(motionOf(second, [...walk, first])).toBe("walking"); // 1 of the last 3 is nearby
    expect(motionOf(pt("2026-10-30T07:03:20Z", 1.39492, 103.89072, { activity: 7, speed: 0.6 }), [...walk, first, second])).toBe("playing"); // 2 of 3
  });

  it("places a fix, allowing for its accuracy, and turns moves into arrived and left", () => {
    expect(placeAt({ lat: 1.3919, lng: 103.8955, accuracyM: 20 }, [HOME, SCHOOL])?.name).toBe("Home");
    expect(placeAt({ lat: 1.394, lng: 103.891, accuracyM: 20 }, [HOME, SCHOOL])).toBeNull();
    const trip = [pt("2026-10-30T07:12:00Z", 1.394, 103.891), pt("2026-10-30T07:41:00Z", 1.3918, 103.8954)];
    const events = placeEvents("ari", { lat: SCHOOL.lat, lng: SCHOOL.lng, accuracyM: 10 }, trip, [HOME, SCHOOL]);
    expect(events.map((e) => `${e.kind} ${e.placeName} ${e.at.slice(11, 16)}`)).toEqual(["left School 07:12", "arrived Home 07:41"]);
    // A vague fix moves nobody.
    expect(placeEvents("ari", null, [pt("2026-10-30T07:00:00Z", HOME.lat, HOME.lng, { accuracyM: 400 })], [HOME])).toEqual([]);
  });

  it("school hours run on weekdays from 13:00 to 19:00 Singapore time", () => {
    expect(sharingNow("balanced", new Date("2026-11-01T02:00:00Z"))).toBe(true);
    expect(sharingNow("school", new Date("2026-10-30T07:00:00Z"))).toBe(true); // Fri 15:00 SGT
    expect(sharingNow("school", new Date("2026-10-30T12:00:00Z"))).toBe(false); // Fri 20:00 SGT
    expect(sharingNow("school", new Date("2026-10-31T07:00:00Z"))).toBe(false); // Sat
  });
});
