// Each kid's door (founder, 29 Oct): Leonard keeps the neon portal, Abby gets the sky door, and every look's art exists.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOOKS, lookFor } from "./looks.ts";

describe("door looks", () => {
  it("gives an Anime Sky teen the sky door and leaves the others as they were", () => {
    expect(lookFor("teen", "anime-sky")).toBe("sky");
    expect(lookFor("teen", "idol-stage")).toBe("teen");
    expect(lookFor("junior", "anime-sky")).toBe("junior");
    expect(lookFor("default", "anime-sky")).toBe("default");
  });

  it("has the art for every look", () => {
    for (const look of Object.values(LOOKS)) {
      for (const file of [`${look.city}.webp`, `${look.city}-800.webp`, look.leafL, look.leafR, ...look.flyers, ...look.walkers]) {
        expect(existsSync(join("public", file)), file).toBe(true);
      }
    }
  });
});
