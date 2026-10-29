import { describe, expect, it } from "vitest";
import { KID_TABS, isKidNavHidden, kidNavCurrent } from "./kid-tabs";

describe("kid nav tabs", () => {
  it("has the founder-decided tabs in order (Ask Kix added 28 Oct for homework help, Critters 29 Oct)", () => {
    expect(KID_TABS.map((t) => t.id)).toEqual(["home", "learn", "ask", "play", "critters", "treasure", "vibe"]);
    expect(KID_TABS.map((t) => t.label)).toEqual(["Home", "Learn", "Ask Kix", "Play", "Critters", "Treasure", "Vibe"]);
  });

  it("points Home and Treasure at built pages", () => {
    const href = Object.fromEntries(KID_TABS.map((t) => [t.id, t.href]));
    expect(href.home).toBe("/home");
    expect(href.treasure).toBe("/treasure");
  });

  it("marks only the unbuilt screens as soon (drop the flag when each screen lands)", () => {
    const soon = Object.fromEntries(KID_TABS.map((t) => [t.id, t.soon ?? false]));
    expect(soon).toEqual({ home: false, learn: false, ask: false, play: false, critters: false, treasure: false, vibe: false });
  });

  it("keeps the canonical hrefs on soon tabs so enabling them is a one-flag change", () => {
    const href = Object.fromEntries(KID_TABS.map((t) => [t.id, t.href]));
    expect(href.play).toBe("/arcade");
    expect(href.vibe).toBe("/vibe");
  });
});

describe("kidNavCurrent", () => {
  it.each([
    ["/home", "home"],
    ["/learn/shadows", "learn"],
    ["/learn", "learn"],
    ["/arcade", "play"],
    ["/arcade/path", "play"],
    ["/arcade/star-typer", "play"],
    ["/critters", "critters"],
    ["/treasure", "treasure"],
    ["/vibe", "vibe"],
  ] as const)("marks %s as %s", (path, tab) => {
    expect(kidNavCurrent(path)).toBe(tab);
  });

  it.each(["/me", "/studio", "/talk", "/question/shadows-2", "/doors"])("marks %s as no tab", (path) => {
    expect(kidNavCurrent(path)).toBeNull();
  });

  it("ignores a trailing slash", () => {
    expect(kidNavCurrent("/home/")).toBe("home");
  });
});

describe("isKidNavHidden", () => {
  it.each(["/question/shadows-2", "/question", "/learn/shadows/done", "/learn/frogs/done/"])("hides %s", (path) => {
    expect(isKidNavHidden(path)).toBe(true);
  });

  it.each(["/arcade/star-typer", "/arcade/word-garden", "/arcade/neon-strike"])("hides the Arcade round %s", (path) => {
    expect(isKidNavHidden(path)).toBe(true);
  });

  it.each(["/home", "/learn/shadows", "/learn", "/arcade", "/arcade/path", "/treasure", "/vibe", "/me", "/studio", "/talk"])(
    "shows %s",
    (path) => {
      expect(isKidNavHidden(path)).toBe(false);
    },
  );
});
