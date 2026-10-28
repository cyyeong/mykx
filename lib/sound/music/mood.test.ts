// The moods per place: learning is calm, Home bright and Treasure dreamy (light),
// and the games driving (energetic).
import { describe, expect, it } from "vitest";
import { moodForPath } from "./mood";

describe("moodForPath", () => {
  it("maps places to moods", () => {
    expect(moodForPath("/treasure")).toBe("dreamy");
    expect(moodForPath("/treasure/cards")).toBe("dreamy");
    expect(moodForPath("/home")).toBe("bright");
    expect(moodForPath("/")).toBe("bright");
  });

  it("drives the games", () => {
    for (const p of ["/arcade", "/arcade/blaster", "/play", "/play/round-1", "/games"]) expect(moodForPath(p)).toBe("driving");
    expect(moodForPath("/playground-notes")).toBe("calm");
  });

  it("keeps every learning place calm", () => {
    for (const p of [
      "/learn/frog-life-cycle",
      "/learn/frog-life-cycle/done",
      "/question/p3sci-demo-01",
      "/me",
      "/me/papers/p3-science",
      "/talk",
      "/studio",
      "/doors",
      "/signin",
    ]) {
      expect(moodForPath(p), p).toBe("calm");
    }
  });
});
