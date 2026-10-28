import { describe, expect, it } from "vitest";
import { parsePrefs } from "./prefs";

describe("sound prefs", () => {
  it("keeps only real booleans, the Beat switch included", () => {
    expect(parsePrefs('{"on":true,"music":false,"beat":false,"ambience":true}')).toEqual({ on: true, music: false, beat: false, ambience: true });
    expect(parsePrefs('{"beat":"yes","on":1}')).toEqual({});
    expect(parsePrefs("not json")).toEqual({});
    expect(parsePrefs("")).toEqual({});
  });
});
