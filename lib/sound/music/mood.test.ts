// The brief's moods per place: calm for learning, dreamy for Treasure,
// bright for Home, driving for the Arcade.
import { describe, expect, it } from "vitest";
import { moodForPath } from "./mood";

describe("moodForPath", () => {
  it("maps places to moods", () => {
    expect(moodForPath("/treasure")).toBe("dreamy");
    expect(moodForPath("/treasure/cards")).toBe("dreamy");
    expect(moodForPath("/arcade")).toBe("driving");
    expect(moodForPath("/home")).toBe("bright");
    expect(moodForPath("/")).toBe("bright");
  });

  it("keeps learning calm by default", () => {
    for (const p of ["/learn/frog-life-cycle", "/question/p3sci-demo-01", "/learn/frog-life-cycle/done", "/doors", "/signin"]) {
      expect(moodForPath(p)).toBe("calm");
    }
  });
});
