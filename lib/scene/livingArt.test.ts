import { describe, expect, it } from "vitest";
import { type LivingArtData, livingArtHtml, livingPieces } from "./livingArt.ts";

const art: LivingArtData = {
  art: "test",
  width: 1600,
  height: 1000,
  layers: [
    { id: "fall", motion: "flow", src: "/art/living/test/fall.webp", x: 60, y: 20, w: 4, h: 40, mask: true },
    { id: "fern-1", motion: "sway", src: "/art/living/test/fern-1.webp", x: 10, y: 50, w: 10, h: 20, mask: false },
    { id: "cloud-1", motion: "mist", src: "/art/living/test/cloud-1.webp", x: 0, y: 0, w: 30, h: 20, mask: false },
    { id: "neon", motion: "neon", src: "/art/living/test/neon.webp", x: 0, y: 50, w: 100, h: 50, mask: true },
  ],
};

describe("living art pieces", () => {
  it("draws clouds first and light last, and gives a waterfall a splash at its foot", () => {
    const pieces = livingPieces(art);
    expect(pieces.map((p) => p.key)).toEqual(["cloud-1", "fern-1", "fall", "fall-splash", "neon"]);
    const splash = pieces.find((p) => p.kind === "splash");
    expect(splash?.kind === "splash" && splash.style).toMatchObject({ "--x": "62%", "--y": "58.8%" });
  });

  it("moves cut-outs and masks light into a part's own shape", () => {
    const [cloud, fern, fall] = livingPieces(art, (s) => `/_blob/${s.split("/").pop()}`);
    expect(cloud).toMatchObject({ kind: "img", className: "la-l la-mist", src: "/_blob/cloud-1.webp" });
    expect(fern).toMatchObject({ className: "la-l la-sway" });
    expect(fall).toMatchObject({ kind: "mask", className: "la-l la-mask la-flow" });
    expect(fall.style["mask-image"]).toBe("url(/_blob/fall.webp)");
  });

  it("is deterministic and places the art's cover box", () => {
    expect(livingArtHtml(art)).toBe(livingArtHtml(art));
    expect(livingArtHtml(art)).toContain('style="--ar: 1600 / 1000; --ox: 50%; --oy: 50%"');
  });
});
