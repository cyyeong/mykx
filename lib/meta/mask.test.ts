import { decodeMaskToRaster, parseImageStream, recordsOfKind } from "@meta-sam/parser";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  type MaskRaster,
  alphaBox,
  alphaCoverage,
  applyAlpha,
  fillHoles,
  frameSizeFromRawOutput,
  masksToAlpha,
  selectMasks,
} from "./mask.ts";
import { cutoutFromMasks } from "./sam.ts";

// 2x2 raster on a 4x4 frame, box (1,1)-(3,3): an "L" shape.
const L: MaskRaster = {
  bounds: { left: 1, top: 1, right: 3, bottom: 3 },
  width: 2,
  height: 2,
  raster: Uint8Array.from([1, 0, 1, 1]),
};

const grid = (alpha: Uint8Array, width: number) =>
  Array.from({ length: alpha.length / width }, (_, y) => Array.from(alpha.slice(y * width, (y + 1) * width)));

describe("masksToAlpha", () => {
  it("places a box-sized raster at its box", () => {
    const alpha = masksToAlpha([L], { width: 4, height: 4 });
    expect(grid(alpha, 4)).toEqual([
      [0, 0, 0, 0],
      [0, 255, 0, 0],
      [0, 255, 255, 0],
      [0, 0, 0, 0],
    ]);
  });

  it("scales a raster smaller than its box (nearest neighbour)", () => {
    const one: MaskRaster = { bounds: { left: 0, top: 0, right: 2, bottom: 2 }, width: 1, height: 1, raster: Uint8Array.from([1]) };
    expect(grid(masksToAlpha([one], { width: 3, height: 3 }), 3)).toEqual([
      [255, 255, 0],
      [255, 255, 0],
      [0, 0, 0],
    ]);
  });

  it("scales frame coordinates when the output is a different size", () => {
    // SAM saw 4x4; we paint into 8x8, so every mask pixel becomes 2x2.
    const alpha = masksToAlpha([L], { width: 4, height: 4 }, { width: 8, height: 8 });
    expect(alphaBox(alpha, { width: 8, height: 8 })).toEqual({ left: 2, top: 2, right: 6, bottom: 6 });
    expect(alphaCoverage(alpha)).toBeCloseTo(12 / 64);
  });

  it("unions several masks and rejects a raster of the wrong length", () => {
    const dot: MaskRaster = { bounds: { left: 3, top: 0, right: 4, bottom: 1 }, width: 1, height: 1, raster: Uint8Array.from([1]) };
    const alpha = masksToAlpha([L, dot], { width: 4, height: 4 });
    expect(alpha[3]).toBe(255);
    expect(alphaCoverage(alpha)).toBe(4 / 16);
    expect(() => masksToAlpha([{ ...L, raster: new Uint8Array(3) }], { width: 4, height: 4 })).toThrow(RangeError);
  });

  it("decodes a real one_bit SAM payload and paints it 1:1", () => {
    const mask = { encoding: "one_bit", width: 5, height: 5, payload: "!!!!!(QO(0lu8?" } as const;
    const raster = decodeMaskToRaster(mask);
    expect(raster).toHaveLength(25);
    const alpha = masksToAlpha([{ bounds: { left: 0, top: 0, right: 5, bottom: 5 }, width: 5, height: 5, raster }], { width: 5, height: 5 });
    expect(Array.from(alpha)).toEqual(Array.from(raster, (v) => v * 255));
  });
});

describe("selectMasks / applyAlpha / alphaBox", () => {
  const big: MaskRaster = { ...L, raster: Uint8Array.from([1, 1, 1, 1]) };

  it("picks the most confident mask, then the largest", () => {
    expect(selectMasks([{ ...L, confidence: 0.9 }, { ...big, confidence: 0.4 }])[0].confidence).toBe(0.9);
    expect(selectMasks([L, big])[0]).toBe(big);
    expect(selectMasks([L, big], "union")).toHaveLength(2);
    expect(selectMasks([])).toEqual([]);
  });

  it("multiplies the source alpha by the mask", () => {
    const rgba = Uint8Array.from([10, 20, 30, 255, 10, 20, 30, 128]);
    expect(Array.from(applyAlpha(rgba, Uint8Array.from([255, 255])))).toEqual([10, 20, 30, 255, 10, 20, 30, 128]);
    expect(Array.from(applyAlpha(rgba, Uint8Array.from([0, 128])))).toEqual([10, 20, 30, 0, 10, 20, 30, 64]);
  });

  it("finds a padded, clamped box, or null for an empty mask", () => {
    const alpha = masksToAlpha([L], { width: 4, height: 4 });
    expect(alphaBox(alpha, { width: 4, height: 4 })).toEqual({ left: 1, top: 1, right: 3, bottom: 3 });
    expect(alphaBox(alpha, { width: 4, height: 4 }, 5)).toEqual({ left: 0, top: 0, right: 4, bottom: 4 });
    expect(alphaBox(new Uint8Array(16), { width: 4, height: 4 })).toBeNull();
  });
});

describe("SAM output -> cutout", () => {
  // From the @meta-sam/parser README: one frame, prompt "button", two objects on a 320x334 frame.
  const outputText =
    "<0f>0<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|>" +
    "<|mask;x=0;y=0;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>" +
    ",1<|box;x1=155;y1=228;x2=202;y2=254;w=320;h=334|>" +
    "<|mask;x=0;y=0;data=27,48,~!!!!J!0c[q=Pj_zs=*4C4(/./x#:/`S_GnD`=o3?X{emCgO$y@|>\n";

  async function* events() {
    const lane = { item_id: "msg_1", output_index: 0, content_index: 0 };
    const split = outputText.indexOf(",1<|box");
    yield { type: "response.output_text.delta" as const, ...lane, delta: outputText.slice(0, split) };
    yield { type: "response.output_text.delta" as const, ...lane, delta: outputText.slice(split) };
    yield { type: "response.output_text.done" as const, ...lane, text: outputText };
    yield { type: "response.completed" as const };
  }

  it("reads the frame size from raw output", () => {
    expect(frameSizeFromRawOutput(outputText)).toEqual({ width: 320, height: 334 });
    expect(frameSizeFromRawOutput("")).toBeNull();
  });

  it("parses box-sized rasters that paint inside their boxes", async () => {
    const result = await parseImageStream(events()).finalResult;
    expect(result.outcome.status).toBe("completed");
    const masks: MaskRaster[] = recordsOfKind(result.records, "mask").map((r) => ({
      bounds: { ...r.bounds },
      width: r.mask.width,
      height: r.mask.height,
      raster: decodeMaskToRaster(r.mask),
    }));
    expect(masks.map((m) => [m.bounds, m.width, m.height])).toEqual([
      [{ left: 211, top: 228, right: 271, bottom: 255 }, 60, 27],
      [{ left: 155, top: 228, right: 203, bottom: 255 }, 48, 27],
    ]);
    const frame = { width: 320, height: 334 };
    const alpha = masksToAlpha(masks, frame);
    const box = alphaBox(alpha, frame);
    expect(box).not.toBeNull();
    expect(box!.left).toBeGreaterThanOrEqual(155);
    expect(box!.right).toBeLessThanOrEqual(271);
    expect(box!.top).toBeGreaterThanOrEqual(228);
    expect(box!.bottom).toBeLessThanOrEqual(255);
  });

  it("cuts a tiny synthetic image into a transparent PNG", async () => {
    const red = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 } } })
      .png()
      .toBuffer();

    const cropped = await cutoutFromMasks(red, [L], null, { featherPx: 0, paddingPx: 0 });
    expect([cropped.width, cropped.height]).toEqual([2, 2]);
    expect(cropped.box).toEqual({ left: 1, top: 1, right: 3, bottom: 3 });
    expect(cropped.coverage).toBe(3 / 16);
    const { data, info } = await sharp(cropped.png).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);
    expect([data[3], data[7], data[11], data[15]]).toEqual([255, 0, 255, 255]);
    expect([data[0], data[1], data[2]]).toEqual([255, 0, 0]);

    const full = await cutoutFromMasks(red, [L], null, { featherPx: 0, crop: false });
    const fullRaw = await sharp(full.png).raw().toBuffer();
    expect(Array.from({ length: 16 }, (_, i) => fullRaw[i * 4 + 3])).toEqual(Array.from(masksToAlpha([L], { width: 4, height: 4 })));

    const soft = await cutoutFromMasks(red, [L], null, { featherPx: 1, crop: false });
    const softRaw = await sharp(soft.png).raw().toBuffer();
    const softAlpha = Array.from({ length: 16 }, (_, i) => softRaw[i * 4 + 3]);
    expect(softAlpha.some((a) => a > 0 && a < 255)).toBe(true);

    await expect(cutoutFromMasks(red, [{ ...L, raster: new Uint8Array(4) }], null)).rejects.toThrow(/empty/);
  });
});

describe("fillHoles", () => {
  // 0 = background, 1 = subject; a ring with a hole in the middle and a notch open to the edge.
  const grid = (rows: string[]) => Uint8Array.from(rows.join("").split("").map((c) => (c === "1" ? 255 : 0)));
  const size = { width: 7, height: 5 };

  it("fills a hole the subject encloses and keeps background that touches the border", () => {
    const alpha = grid(["0000000", "0111110", "0100010", "0111110", "0000000"]);
    const filled = fillHoles(alpha, size);
    expect(Array.from(filled)).toEqual(Array.from(grid(["0000000", "0111110", "0111110", "0111110", "0000000"])));
    expect(alpha[2 * 7 + 2]).toBe(0); // input untouched
  });

  it("leaves a notch open to the edge transparent", () => {
    const alpha = grid(["0000000", "0111110", "0100000", "0111110", "0000000"]);
    expect(Array.from(fillHoles(alpha, size))).toEqual(Array.from(alpha));
  });

  it("rejects a plane of the wrong length", () => {
    expect(() => fillHoles(new Uint8Array(3), size)).toThrow(RangeError);
  });
});
