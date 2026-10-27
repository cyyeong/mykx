import { describe, expect, it } from "vitest";
import { PACK_IDS } from "@/components/theme/packs";
import { buildTransformPrompt } from "./prompt";

describe("buildTransformPrompt", () => {
  it("adds the world's accessory and up to two interest props, each with a SAM noun", () => {
    const p = buildTransformPrompt("terrarium", ["Bugs and critters", "Jets", "Music"]);
    expect(p.bodyNoun).toBe("plush toy");
    expect(p.accessoryNouns).toEqual(["hat", "magnifying glass", "goggles"]);
    expect(p.prompt).toMatch(/explorer hat/);
    expect(p.prompt).not.toMatch(/headphones/); // only two interests
  });

  it("always asks for exactly one character and nothing across the body", () => {
    for (const pack of PACK_IDS) {
      const { prompt } = buildTransformPrompt(pack, []);
      expect(prompt).toMatch(/exactly one character/);
      expect(prompt).toMatch(/nothing wrapped across its body/);
      expect(prompt).not.toMatch(/scarf|garland|sash/i);
    }
  });

  it("ignores interests it doesn't know", () => {
    expect(buildTransformPrompt("dreamlight", ["Unknown"]).accessoryNouns).toEqual(["lantern"]);
  });

  it("never names real franchises or brands", () => {
    const text = PACK_IDS.map((p) => buildTransformPrompt(p, ["Jets", "Music", "Football"]).prompt).join(" ");
    expect(text).not.toMatch(/ghibli|pixar|disney|nike|pokemon|top gun|mission impossible|k-?pop/i);
  });
});
