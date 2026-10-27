// From camera frames to per-minute counts, in the browser (docs/prd/PARENT_INSIGHTS.md §1, AGENTS.md rule 12).
// Each frame's face landmarks are reduced on the spot to a head angle and three blendshape scores, those to
// "looking away", "eyes shut" and "yawning" spells, and the spells to the counts in a FocusMinute. Frames,
// landmarks and angles are never stored or sent: only the finished minutes leave this file.
//
// Pure: the caller passes every time (wall-clock ms), so the counter runs the same in tests as in the browser.
import { MINUTE_MS, type FocusMinute } from "./focus.ts";

/** What one frame says about the child: a face reading, or null for no face (or too dark to find one). */
export interface FaceReading {
  /** Head turn left or right, degrees (0 = facing the camera). */
  yaw: number;
  /** Head tilt up or down, degrees. */
  pitch: number;
  /** Mean of the eyeBlinkLeft and eyeBlinkRight blendshapes (0–1). */
  eyesClosed: number;
  /** The jawOpen blendshape (0–1). */
  jawOpen: number;
}

export const CAMERA = {
  /** Degrees from the child's own straight-ahead before a frame counts as looking away. */
  yawDeg: 28,
  pitchDeg: 24,
  /** A look away counts once it lasts this long. */
  awayHoldMs: 2000,
  /** Eyes count as shut above this score, once shut this long (a normal blink is well under half a second). */
  eyesClosedScore: 0.55,
  eyesHoldMs: 1000,
  /** A yawn: the mouth wide open this long (talking and laughing open and close much faster). */
  jawOpenScore: 0.6,
  yawnHoldMs: 1500,
  /** A longer gap between frames (tab hidden, camera restarting) is a break: no time is counted across it. */
  maxGapMs: 2500,
  /** A minute watched for less than this is dropped rather than guessed at. */
  minWatchedMs: 20_000,
  /** Straight-ahead is the median of this many recent in-view frames (about a minute), so a webcam above the screen reads as ahead. */
  neutralFrames: 240,
  /** …but never further off-axis than this, so a long look away can't become the new "ahead". */
  neutralClampYaw: 15,
  neutralClampPitch: 20,
} as const;

const DEG = 180 / Math.PI;

/**
 * Head yaw and pitch from MediaPipe's 4 × 4 facial transformation matrix (column-major, as the Tasks API returns
 * it). Rotation R = Rz · Ry · Rx; r(i, j) = data[j * 4 + i].
 */
export function headAngles(matrix: { data: readonly number[] }): { yaw: number; pitch: number } {
  const r = (i: number, j: number) => matrix.data[j * 4 + i] ?? (i === j ? 1 : 0);
  const yaw = Math.atan2(-r(2, 0), Math.hypot(r(0, 0), r(1, 0))) * DEG;
  const pitch = Math.atan2(r(2, 1), r(2, 2)) * DEG;
  return { yaw, pitch };
}

/** The biggest face in the frame (the child nearest the screen, not a sibling behind), or -1 for none. */
export function largestFaceIndex(faces: readonly (readonly { x: number; y: number }[])[]): number {
  let best = -1;
  let bestArea = 0;
  faces.forEach((points, i) => {
    if (!points.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const area = (maxX - minX) * (maxY - minY);
    if (area > bestArea) {
      bestArea = area;
      best = i;
    }
  });
  return best;
}

/** A blendshape score by name, 0 when missing. */
export function blendshape(categories: readonly { categoryName: string; score: number }[], name: string): number {
  return categories.find((c) => c.categoryName === name)?.score ?? 0;
}

interface Bucket {
  minute: number;
  watchedMs: number;
  inViewMs: number;
  awayMs: number;
  eyesClosedEvents: number;
  yawns: number;
}

/** A spell that counts once it has lasted `holdMs`. */
interface Spell {
  since: number | null;
  counted: boolean;
}

const idle = (): Spell => ({ since: null, counted: false });
const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Turns a stream of frame readings into finished minutes. `push` returns the minutes it closed (a minute closes
 * when the first frame of a later minute arrives); `flush` closes the current one early (page closing, camera off).
 */
export class FocusCounter {
  private bucket: Bucket | null = null;
  private lastAt: number | null = null;
  private away = idle();
  private eyes = idle();
  private yawn = idle();
  private readonly ahead: { yaw: number; pitch: number }[] = [];
  /** When a face was last in view (ms), or null. */
  lastFaceAt: number | null = null;

  push(reading: FaceReading | null, at: number): FocusMinute[] {
    const done: FocusMinute[] = [];
    const minute = Math.floor(at / MINUTE_MS) * MINUTE_MS;
    if (this.bucket && this.bucket.minute !== minute) {
      const closed = this.close();
      if (closed) done.push(closed);
    }
    this.bucket ??= { minute, watchedMs: 0, inViewMs: 0, awayMs: 0, eyesClosedEvents: 0, yawns: 0 };

    const gap = this.lastAt === null ? null : at - this.lastAt;
    this.lastAt = at;
    if (gap === null || gap <= 0 || gap > CAMERA.maxGapMs) {
      // First frame, or back after a break: start the spells fresh and count time from the next frame.
      this.away = idle();
      this.eyes = idle();
      this.yawn = idle();
      if (reading) this.lastFaceAt = at;
      return done;
    }

    const b = this.bucket;
    b.watchedMs += gap;
    if (!reading) {
      // No face: out of view, not "looking away". Spells can't continue without a face.
      this.away = idle();
      this.eyes = idle();
      this.yawn = idle();
      return done;
    }
    b.inViewMs += gap;
    this.lastFaceAt = at;

    const ahead = this.straightAhead();
    const off = Math.abs(reading.yaw - ahead.yaw) > CAMERA.yawDeg || Math.abs(reading.pitch - ahead.pitch) > CAMERA.pitchDeg;
    // Every in-view frame feeds straight-ahead: the median ignores the minority of looks away.
    this.ahead.push({ yaw: reading.yaw, pitch: reading.pitch });
    if (this.ahead.length > CAMERA.neutralFrames) this.ahead.shift();

    // Looking away: once a spell reaches 2 s, its whole length counts, then every frame it goes on.
    if (off) {
      this.away.since ??= at - gap;
      const held = at - this.away.since;
      if (!this.away.counted && held >= CAMERA.awayHoldMs) {
        this.away.counted = true;
        b.awayMs += held;
      } else if (this.away.counted) b.awayMs += gap;
    } else this.away = idle();

    // Eyes shut and yawns are read only while facing ahead: looking down lowers the eyelids on its own.
    this.eyes = off ? idle() : this.hold(this.eyes, reading.eyesClosed >= CAMERA.eyesClosedScore, at, gap, CAMERA.eyesHoldMs, () => b.eyesClosedEvents++);
    this.yawn = off ? idle() : this.hold(this.yawn, reading.jawOpen >= CAMERA.jawOpenScore, at, gap, CAMERA.yawnHoldMs, () => b.yawns++);
    return done;
  }

  /** Closes the current minute now (if it was watched long enough). Later frames in the same minute start afresh. */
  flush(): FocusMinute[] {
    const closed = this.close();
    this.lastAt = null;
    return closed ? [closed] : [];
  }

  private hold(spell: Spell, on: boolean, at: number, gap: number, holdMs: number, count: () => void): Spell {
    if (!on) return idle();
    const since = spell.since ?? at - gap;
    if (!spell.counted && at - since >= holdMs) {
      count();
      return { since, counted: true };
    }
    return { since, counted: spell.counted };
  }

  private straightAhead() {
    if (this.ahead.length < 10) return { yaw: 0, pitch: 0 };
    return {
      yaw: clamp(median(this.ahead.map((a) => a.yaw)), -CAMERA.neutralClampYaw, CAMERA.neutralClampYaw),
      pitch: clamp(median(this.ahead.map((a) => a.pitch)), -CAMERA.neutralClampPitch, CAMERA.neutralClampPitch),
    };
  }

  private close(): FocusMinute | null {
    const b = this.bucket;
    this.bucket = null;
    if (!b || b.watchedMs < CAMERA.minWatchedMs) return null;
    return {
      minute: new Date(b.minute).toISOString(),
      awaySeconds: Math.min(60, Math.round(Math.min(b.awayMs, b.watchedMs) / 1000)),
      eyesClosedEvents: Math.min(30, b.eyesClosedEvents),
      yawns: Math.min(20, b.yawns),
      facePresentRatio: Math.round((b.inViewMs / b.watchedMs) * 100) / 100,
    };
  }
}

/** The parts of a MediaPipe FaceLandmarkerResult this file reads. */
export interface LandmarkerResult {
  faceLandmarks: readonly (readonly { x: number; y: number }[])[];
  faceBlendshapes?: readonly { categories: readonly { categoryName: string; score: number }[] }[];
  facialTransformationMatrixes?: readonly { data: readonly number[] }[];
}

/** One frame, reduced on the spot: the largest face's angle and three scores, or null when there's no face. */
export function readFace(result: LandmarkerResult): FaceReading | null {
  const i = largestFaceIndex(result.faceLandmarks);
  const matrix = i < 0 ? undefined : result.facialTransformationMatrixes?.[i];
  if (!matrix) return null;
  const shapes = result.faceBlendshapes?.[i]?.categories ?? [];
  const { yaw, pitch } = headAngles(matrix);
  return {
    yaw,
    pitch,
    eyesClosed: (blendshape(shapes, "eyeBlinkLeft") + blendshape(shapes, "eyeBlinkRight")) / 2,
    jawOpen: blendshape(shapes, "jawOpen"),
  };
}
