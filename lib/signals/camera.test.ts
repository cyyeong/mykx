import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MEDIAPIPE_VERSION, MODEL_URL, WASM_URL } from "../../components/camera/mediapipe.ts";
import { CAMERA, FocusCounter, blendshape, headAngles, largestFaceIndex, readFace, type FaceReading } from "./camera.ts";
import type { FocusMinute } from "./focus.ts";

const T0 = Date.parse("2026-10-28T08:00:00Z");
const STEP = 300; // about 3.3 frames a second, as in the browser
const ahead: FaceReading = { yaw: 2, pitch: -8, eyesClosed: 0.05, jawOpen: 0.05 };

/** Runs `frame(t)` from `from` to `to` ms after T0 and returns every minute that closed. */
function run(counter: FocusCounter, from: number, to: number, frame: (t: number) => FaceReading | null, step = STEP): FocusMinute[] {
  const out: FocusMinute[] = [];
  for (let t = from; t < to; t += step) out.push(...counter.push(frame(t), T0 + t));
  return out;
}

/** Column-major 4 × 4 rotation, like MediaPipe's facial transformation matrix. */
function rotation(yawDeg: number, pitchDeg: number): { data: number[] } {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  const ry = [
    [Math.cos(y), 0, Math.sin(y)],
    [0, 1, 0],
    [-Math.sin(y), 0, Math.cos(y)],
  ];
  const rx = [
    [1, 0, 0],
    [0, Math.cos(p), -Math.sin(p)],
    [0, Math.sin(p), Math.cos(p)],
  ];
  const r = ry.map((row, i) => [0, 1, 2].map((j) => row.reduce((s, _, k) => s + ry[i][k] * rx[k][j], 0)));
  const data: number[] = [];
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) data.push(i < 3 && j < 3 ? r[i][j] : i === j ? 1 : i === 3 ? 0 : [0, 0, -40][i]);
  return { data };
}

describe("reading a frame", () => {
  it("gets yaw and pitch from the transformation matrix", () => {
    const turned = headAngles(rotation(35, 0));
    expect(turned.yaw).toBeCloseTo(35, 5);
    expect(turned.pitch).toBeCloseTo(0, 5);
    const down = headAngles(rotation(0, -30));
    expect(down.yaw).toBeCloseTo(0, 5);
    expect(down.pitch).toBeCloseTo(-30, 5);
    const both = headAngles(rotation(20, 10));
    expect(both.yaw).toBeCloseTo(20, 5);
    expect(both.pitch).toBeCloseTo(10, 5);
  });

  it("picks the largest face when there are several, and -1 for none", () => {
    const box = (x: number, y: number, s: number) => [
      { x, y },
      { x: x + s, y: y + s },
    ];
    expect(largestFaceIndex([box(0.1, 0.1, 0.1), box(0.4, 0.3, 0.35), box(0.7, 0.1, 0.05)])).toBe(1);
    expect(largestFaceIndex([])).toBe(-1);
    expect(largestFaceIndex([[]])).toBe(-1);
  });

  it("reduces a whole Face Landmarker result to the largest face's angle and three scores", () => {
    const small = [{ x: 0.1, y: 0.1 }, { x: 0.15, y: 0.15 }];
    const big = [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.8 }];
    const shapes = (blink: number, jaw: number) => ({
      categories: [
        { categoryName: "eyeBlinkLeft", score: blink },
        { categoryName: "eyeBlinkRight", score: blink },
        { categoryName: "jawOpen", score: jaw },
        { categoryName: "mouthSmileLeft", score: 0.9 },
      ],
    });
    const reading = readFace({
      faceLandmarks: [small, big],
      faceBlendshapes: [shapes(0.1, 0.1), shapes(0.8, 0.7)],
      facialTransformationMatrixes: [rotation(0, 0), rotation(40, 0)],
    });
    expect(reading).toEqual({ yaw: expect.closeTo(40, 5), pitch: expect.closeTo(0, 5), eyesClosed: 0.8, jawOpen: 0.7 });
    expect(Object.keys(reading!).sort()).toEqual(["eyesClosed", "jawOpen", "pitch", "yaw"]);
    expect(readFace({ faceLandmarks: [] })).toBeNull();
  });

  it("reads blendshapes by name", () => {
    expect(blendshape([{ categoryName: "jawOpen", score: 0.7 }], "jawOpen")).toBe(0.7);
    expect(blendshape([], "eyeBlinkLeft")).toBe(0);
  });
});

describe("per-minute counts", () => {
  it("closes a minute when the next one starts, with nothing but the counts", () => {
    const c = new FocusCounter();
    const minutes = run(c, 0, 61_000, () => ahead);
    expect(minutes).toEqual([{ minute: new Date(T0).toISOString(), awaySeconds: 0, eyesClosedEvents: 0, yawns: 0, facePresentRatio: 1 }]);
    expect(Object.keys(minutes[0]).sort()).toEqual(["awaySeconds", "eyesClosedEvents", "facePresentRatio", "minute", "yawns"]);
  });

  it("counts looking away only from 2 s, then the whole spell", () => {
    const c = new FocusCounter();
    const turned = { ...ahead, yaw: 50 };
    // Glances of 1.5 s every 10 s don't count; one 10 s look away does.
    const minutes = run(c, 0, 61_000, (t) => {
      if (t >= 40_000 && t < 50_000) return turned;
      return t % 10_000 < 1_500 && t < 40_000 ? turned : ahead;
    });
    expect(minutes[0].awaySeconds).toBe(10);
  });

  it("ignores normal blinks, counts eyes shut for 1 s once per closing", () => {
    const c = new FocusCounter();
    const minutes = run(c, 0, 61_000, (t) => {
      const blink = t % 4_000 < 300; // a frame or so, every 4 s
      const shut = t >= 20_000 && t < 22_500;
      return { ...ahead, eyesClosed: blink || shut ? 0.9 : 0.05 };
    });
    expect(minutes[0].eyesClosedEvents).toBe(1);
  });

  it("counts a yawn when the mouth stays wide open for 1.5 s, not when talking", () => {
    const c = new FocusCounter();
    const minutes = run(c, 0, 61_000, (t) => {
      const talking = t < 10_000 && t % 900 < 450;
      const yawn = t >= 30_000 && t < 33_000;
      return { ...ahead, jawOpen: talking ? 0.7 : yawn ? 0.85 : 0.05 };
    });
    expect(minutes[0].yawns).toBe(1);
  });

  it("treats no face (poor light, walked away) as out of view, not as looking away", () => {
    const c = new FocusCounter();
    const minutes = run(c, 0, 61_000, (t) => (t >= 30_000 ? null : ahead));
    expect(minutes[0]).toMatchObject({ awaySeconds: 0, facePresentRatio: 0.5 });
  });

  it("learns straight-ahead from the child's own pose, so a webcam above the screen isn't 'away'", () => {
    const c = new FocusCounter();
    const belowCamera = { ...ahead, pitch: -30 };
    const minutes = run(c, 0, 121_000, () => belowCamera);
    expect(minutes[1].awaySeconds).toBe(0);
  });

  it("counts no time across a gap (tab hidden), and drops a minute watched under 20 s", () => {
    const c = new FocusCounter();
    const first = run(c, 0, 15_000, () => ahead);
    const later = run(c, 50_000, 125_000, () => ahead);
    expect(first).toEqual([]);
    // Minute 0 was watched for about 25 s in two parts; minute 1 in full.
    expect(later.map((m) => m.minute)).toEqual([new Date(T0).toISOString(), new Date(T0 + 60_000).toISOString()]);
  });

  it("keeps up on a slow device (1 frame a second)", () => {
    const c = new FocusCounter();
    const minutes = run(c, 0, 61_000, (t) => (t >= 10_000 && t < 20_000 ? { ...ahead, yaw: -45 } : ahead), 1_000);
    expect(minutes[0].awaySeconds).toBe(10);
  });

  it("flushes a partly watched minute when the camera stops", () => {
    const c = new FocusCounter();
    run(c, 0, 30_000, () => ahead);
    expect(c.flush()).toHaveLength(1);
    expect(c.flush()).toEqual([]);
    run(c, 30_000, 40_000, () => ahead);
    expect(c.flush()).toEqual([]); // under CAMERA.minWatchedMs
    expect(CAMERA.minWatchedMs).toBe(20_000);
  });
});

describe("MediaPipe assets", () => {
  it("loads the WASM at exactly the installed version, and the model from Google's MediaPipe storage", () => {
    const installed = JSON.parse(readFileSync(new URL("../../node_modules/@mediapipe/tasks-vision/package.json", import.meta.url), "utf8")).version;
    const pinned = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).dependencies["@mediapipe/tasks-vision"];
    expect(MEDIAPIPE_VERSION).toBe(installed);
    expect(pinned).toBe(installed); // exact pin, no range
    expect(WASM_URL).toBe(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${installed}/wasm`);
    expect(MODEL_URL).toMatch(/^https:\/\/storage\.googleapis\.com\/mediapipe-models\/face_landmarker\/face_landmarker\/float16\/\d+\/face_landmarker\.task$/);
  });
});
