// The face-free replay (founder, 28 Oct; AGENTS.md rule 12): so a grown-up can check a "possibly losing focus" note,
// the device keeps a few seconds of face-mesh POINTS around each moment the camera counted (eyes shut, a yawn, a
// look away). Only the outline of the face, eyes, brows and lips, as rounded numbers: never a picture, never sent.
// A parent replays them as a line drawing on the same device and marks the note right or not right. Pure.
import { CAMERA, type FaceReading } from "./camera.ts";

/** MediaPipe Face Mesh contours (indices into its 478 landmarks), drawn as closed or open lines. */
export const MESH = {
  oval: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  leftEye: [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
  rightEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  leftBrow: [276, 283, 282, 295, 285, 300, 293, 334, 296, 336],
  rightBrow: [46, 53, 52, 65, 55, 70, 63, 105, 66, 107],
  lipsOuter: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
  lipsInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191],
  irises: [468, 473],
} as const;
export type MeshPart = keyof typeof MESH;
export const CLOSED: readonly MeshPart[] = ["oval", "leftEye", "rightEye", "lipsOuter", "lipsInner"];

/** Every kept index, in order: a frame stores x, y for each (0–999). */
export const REPLAY_INDEX: readonly number[] = Object.values(MESH).flat();

export type ClipKind = "eyes" | "yawn" | "away";
export const CLIP_LABEL: Record<ClipKind, string> = { eyes: "Eyes closed", yawn: "Yawn", away: "Looking away" };
export interface ReplayFrame {
  /** Milliseconds from the clip's start. */
  t: number;
  /** x, y pairs in REPLAY_INDEX order, 0–999 (null: no face in this frame). */
  p: number[] | null;
}
export interface ReplayClip {
  kind: ClipKind;
  at: string;
  frames: ReplayFrame[];
}
/** What the device keeps for one note: its time window and up to three clips. */
export interface NoteReplay {
  from: string;
  to: string;
  savedAt: string;
  clips: ReplayClip[];
}

const BEFORE_MS = 1500;
const MAX_CLIP_MS = 5000;
const KEEP_MS = 10_000;
const MAX_CLIPS = 12;

export function quantize(points: readonly { x: number; y: number }[]): number[] | null {
  if (points.length < 474) return null;
  const out: number[] = [];
  for (const i of REPLAY_INDEX) {
    const pt = points[i];
    out.push(Math.round(Math.min(1, Math.max(0, pt.x)) * 999), Math.round(Math.min(1, Math.max(0, pt.y)) * 999));
  }
  return out;
}

type Held = { since: number; end: number | null } | null;

/** Watches each frame's reading and keeps a short clip of points around every counted moment. */
export class ReplayRecorder {
  private buffer: { at: number; p: number[] | null }[] = [];
  private held: Record<ClipKind, Held> = { eyes: null, yawn: null, away: null };
  private clips: (ReplayClip & { atMs: number })[] = [];

  push(points: readonly { x: number; y: number }[] | null, reading: FaceReading | null, now: number): void {
    this.buffer.push({ at: now, p: points ? quantize(points) : null });
    while (this.buffer.length && now - this.buffer[0].at > KEEP_MS) this.buffer.shift();
    const on: Record<ClipKind, boolean> = {
      eyes: !!reading && reading.eyesClosed > CAMERA.eyesClosedScore,
      yawn: !!reading && reading.jawOpen > CAMERA.jawOpenScore,
      away: !!reading && (Math.abs(reading.yaw) > CAMERA.yawDeg || Math.abs(reading.pitch) > CAMERA.pitchDeg),
    };
    const hold: Record<ClipKind, number> = { eyes: CAMERA.eyesHoldMs, yawn: CAMERA.yawnHoldMs, away: CAMERA.awayHoldMs };
    for (const kind of Object.keys(on) as ClipKind[]) {
      const h = this.held[kind];
      if (on[kind]) {
        if (!h) this.held[kind] = { since: now, end: null };
        else if (now - h.since >= MAX_CLIP_MS - BEFORE_MS) this.capture(kind, h.since, now);
      } else if (h) {
        if (now - h.since >= hold[kind]) this.capture(kind, h.since, now);
        this.held[kind] = null;
      }
    }
  }

  private capture(kind: ClipKind, since: number, now: number) {
    const start = since - BEFORE_MS;
    const frames = this.buffer.filter((f) => f.at >= start && f.at <= now).map((f) => ({ t: f.at - start, p: f.p }));
    this.held[kind] = null;
    if (frames.filter((f) => f.p).length < 3) return;
    this.clips.push({ kind, at: new Date(since).toISOString(), atMs: since, frames });
    if (this.clips.length > MAX_CLIPS) this.clips.shift();
  }

  /** Up to three clips inside a note's window, one of each kind first. */
  clipsBetween(fromIso: string, toIso: string): ReplayClip[] {
    const from = Date.parse(fromIso);
    const to = Date.parse(toIso);
    const inside = this.clips.filter((c) => c.atMs >= from && c.atMs <= to);
    const picked: typeof inside = [];
    for (const kind of ["eyes", "yawn", "away"] as ClipKind[]) {
      const c = inside.filter((x) => x.kind === kind).pop();
      if (c) picked.push(c);
    }
    for (const c of inside.reverse()) if (picked.length < 3 && !picked.includes(c)) picked.push(c);
    return picked.slice(0, 3).map(({ kind, at, frames }) => ({ kind, at, frames }));
  }
}

/** The points of one part of the mesh in a frame, for drawing. */
export function partPoints(p: readonly number[], part: MeshPart): [number, number][] {
  let offset = 0;
  for (const name of Object.keys(MESH) as MeshPart[]) {
    if (name === part) break;
    offset += MESH[name].length;
  }
  return MESH[part].map((_, i) => [p[(offset + i) * 2] / 999, p[(offset + i) * 2 + 1] / 999]);
}

/** A replay drawn from simple shapes for the demo family's sample note (labelled "Sample", rule 8): eyes closing,
 *  a yawn, a look away. Never a real face. */
export function sampleReplay(from: string, to: string): NoteReplay {
  const ellipse = (n: number, cx: number, cy: number, rx: number, ry: number, start = -Math.PI / 2) =>
    Array.from({ length: n }, (_, i) => {
      const a = start + (i / n) * Math.PI * 2;
      return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as [number, number];
    });
  const arc = (n: number, cx: number, cy: number, rx: number, lift: number) => Array.from({ length: n }, (_, i) => [cx - rx + (2 * rx * i) / (n - 1), cy - lift * Math.sin((Math.PI * i) / (n - 1))] as [number, number]);
  const frame = (o: { eyes: number; mouth: number; turn: number }) => {
    const sx = (x: number) => 0.5 + (x - 0.5) * (1 - Math.abs(o.turn) * 0.35) + o.turn * 0.08;
    const parts: Record<MeshPart, [number, number][]> = {
      oval: ellipse(MESH.oval.length, 0.5, 0.5, 0.22, 0.3),
      leftEye: ellipse(MESH.leftEye.length, 0.59, 0.45, 0.055, 0.028 * o.eyes + 0.003, 0),
      rightEye: ellipse(MESH.rightEye.length, 0.41, 0.45, 0.055, 0.028 * o.eyes + 0.003, Math.PI),
      leftBrow: arc(MESH.leftBrow.length, 0.59, 0.39 + (1 - o.eyes) * 0.01, 0.06, 0.02),
      rightBrow: arc(MESH.rightBrow.length, 0.41, 0.39 + (1 - o.eyes) * 0.01, 0.06, 0.02),
      lipsOuter: ellipse(MESH.lipsOuter.length, 0.5, 0.66 + o.mouth * 0.02, 0.075 - o.mouth * 0.015, 0.018 + o.mouth * 0.07, Math.PI),
      lipsInner: ellipse(MESH.lipsInner.length, 0.5, 0.66 + o.mouth * 0.02, 0.06 - o.mouth * 0.015, 0.006 + o.mouth * 0.06, Math.PI),
      irises: o.eyes > 0.35 ? [[0.59, 0.45], [0.41, 0.45]] : [[0.59, 0.452], [0.41, 0.452]],
    };
    return (Object.keys(MESH) as MeshPart[]).flatMap((k) => parts[k].flatMap(([x, y]) => [Math.round(sx(x) * 999), Math.round(y * 999)]));
  };
  const clip = (kind: ClipKind, at: number, curve: (u: number) => { eyes: number; mouth: number; turn: number }): ReplayClip => ({
    kind,
    at: new Date(at).toISOString(),
    frames: Array.from({ length: 16 }, (_, i) => ({ t: i * 300, p: frame(curve(i / 15)) })),
  });
  const bump = (u: number) => Math.max(0, Math.min(1, Math.sin(Math.min(1, Math.max(0, (u - 0.2) / 0.6)) * Math.PI)));
  const t = Date.parse(from);
  return {
    from,
    to,
    savedAt: new Date().toISOString(),
    clips: [
      clip("eyes", t + 40_000, (u) => ({ eyes: 1 - bump(u), mouth: 0, turn: 0 })),
      clip("yawn", t + 95_000, (u) => ({ eyes: 1 - 0.6 * bump(u), mouth: bump(u), turn: 0 })),
      clip("away", t + 150_000, (u) => ({ eyes: 1, mouth: 0, turn: bump(u) })),
    ],
  };
}
