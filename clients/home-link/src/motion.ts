// The motion filter, on this computer (docs/prd/GUARDIAN.md §2.2): each picture shrinks to a 64×36 grey thumbnail and
// is compared with the last one SENT for that camera. Only a change (or a slow heartbeat) goes to myKx.
import sharp from "sharp";

export const THUMB_W = 64;
export const THUMB_H = 36;
/** Mean absolute difference (0–255) at which a picture counts as changed. */
export const SEND_DIFF = 6;
/** ...and as a big change, which sends a burst of three. */
export const BURST_DIFF = 25;
/** A picture goes anyway after this long without one, so myKx knows the camera is still there. */
export const HEARTBEAT_MS = 10 * 60_000;
export const BURST_SIZE = 3;
export const BURST_GAP_MS = 1000;

/** What we send: at most 960 px wide, JPEG quality 70 (about 40–90 KB). */
export const SEND_WIDTH = 960;
export const SEND_QUALITY = 70;
/** myKx refuses a frame over 1.5 MB and a request over 4 MB; stay well under both. */
export const MAX_FRAME_BYTES = 1_200_000;
export const WALL_WIDTH = 320;

export async function thumbnail(bytes: Uint8Array): Promise<Uint8Array> {
  const { data } = await sharp(bytes).rotate().removeAlpha().resize(THUMB_W, THUMB_H, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return new Uint8Array(data);
}

export function meanAbsDiff(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length || a.length === 0) return 255;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

export interface LastSent {
  thumb: Uint8Array;
  at: number;
}

export type Reason = "first" | "changed" | "big-change" | "heartbeat" | "same";
export interface Decision {
  send: boolean;
  /** Three pictures a second apart instead of one. */
  burst: boolean;
  reason: Reason;
  /** Mean absolute difference from the last picture sent; null for the first picture. */
  diff: number | null;
}

/** Send, burst or hold back. The first picture after start always goes. */
export function decide(thumb: Uint8Array, last: LastSent | null, now: number): Decision {
  if (!last) return { send: true, burst: false, reason: "first", diff: null };
  const diff = meanAbsDiff(thumb, last.thumb);
  if (diff >= BURST_DIFF) return { send: true, burst: true, reason: "big-change", diff };
  if (diff >= SEND_DIFF) return { send: true, burst: false, reason: "changed", diff };
  if (now - last.at >= HEARTBEAT_MS) return { send: true, burst: false, reason: "heartbeat", diff };
  return { send: false, burst: false, reason: "same", diff };
}

/** The picture as uploaded. A noisy one that is still too big is squeezed again rather than refused. */
export async function forUpload(bytes: Uint8Array): Promise<Buffer> {
  const attempts: [number, number][] = [[SEND_WIDTH, SEND_QUALITY], [640, 55], [480, 40]];
  let out = Buffer.alloc(0);
  for (const [width, quality] of attempts) {
    out = await sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality }).toBuffer();
    if (out.length <= MAX_FRAME_BYTES) break;
  }
  return out;
}

/** The small picture the wall shows for a camera. */
export function forWall(bytes: Uint8Array, width = WALL_WIDTH): Promise<Buffer> {
  return sharp(bytes).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
}
