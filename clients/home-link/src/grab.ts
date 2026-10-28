// One still picture from a camera: a snapshot address (HTTP GET, Basic sign-in sent as a header) or an RTSP stream
// (one frame through ffmpeg). Errors carry plain words written here; the camera's address and password are never in
// them (a library's own message might echo the address, so it is never passed on).
import { spawn as nodeSpawn } from "node:child_process";
import { redact, sourceOf, splitCredentials, type CameraConfig } from "./config.ts";

export type GrabKind = "unreachable" | "auth" | "http" | "not-image" | "no-ffmpeg" | "timeout" | "ffmpeg-failed";

export class GrabError extends Error {
  kind: GrabKind;
  constructor(kind: GrabKind, message: string) {
    super(message);
    this.name = "GrabError";
    this.kind = kind;
  }
}

export const SNAPSHOT_TIMEOUT_MS = 10_000;
export const RTSP_TIMEOUT_MS = 15_000;
/** A still picture bigger than this is not a camera snapshot. */
export const MAX_PICTURE_BYTES = 15 * 1024 * 1024;

export const FFMPEG_HELP = "Pictures from an RTSP address need ffmpeg, and it isn't installed. Install it with “brew install ffmpeg” on a Mac or “winget install ffmpeg” on Windows, then try again.";

export interface GrabDeps {
  fetch?: typeof fetch;
  spawn?: typeof nodeSpawn;
  /** The ffmpeg program; MYKX_HOME_LINK_FFMPEG overrides it (a full path on Windows, say). */
  ffmpeg?: string;
  timeoutMs?: number;
}

/** What an image is, from its first bytes (JPEG, PNG or WebP), or null. */
export function imageKind(b: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}

/** The arguments for one frame as JPEG on stdout. The address is in them, so they are never logged. */
export function ffmpegArgs(url: string): string[] {
  return ["-hide_banner", "-loglevel", "error", "-rtsp_transport", "tcp", "-i", url, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "mjpeg", "-"];
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_PICTURE_BYTES) throw new GrabError("not-image", "The address answered with something far too big to be a camera picture.");
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PICTURE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new GrabError("not-image", "The address answered with something far too big to be a camera picture.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function grabSnapshot(address: string, deps: GrabDeps = {}): Promise<Uint8Array> {
  const { url, authorization } = splitCredentials(address);
  const host = new URL(url).host;
  const doFetch = deps.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(url, { headers: authorization ? { authorization, accept: "image/*" } : { accept: "image/*" }, signal: AbortSignal.timeout(deps.timeoutMs ?? SNAPSHOT_TIMEOUT_MS) });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new GrabError(timedOut ? "timeout" : "unreachable", timedOut ? `${host} didn't answer in time.` : `Can't reach the camera at ${host}.`);
  }
  if (res.status === 401 || res.status === 403) {
    await res.body?.cancel().catch(() => undefined);
    const digest = /^\s*digest/i.test(res.headers.get("www-authenticate") ?? "");
    throw new GrabError(
      "auth",
      digest ? "This camera wants Digest sign-in, which Home Link can't do yet. Turn on Basic sign-in in the camera, or use its RTSP address." : "The camera refused the user name or password.",
    );
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new GrabError("http", `The camera answered with an error (HTTP ${res.status}).`);
  }
  let bytes: Uint8Array;
  try {
    bytes = await readCapped(res);
  } catch (e) {
    if (e instanceof GrabError) throw e;
    throw new GrabError("unreachable", `The connection to ${host} dropped before the picture arrived.`);
  }
  if (!imageKind(bytes)) throw new GrabError("not-image", "That address answered, but not with a still picture (JPEG, PNG or WebP). Use the camera's snapshot address.");
  return bytes;
}

export async function grabRtsp(address: string, deps: GrabDeps = {}): Promise<Uint8Array> {
  const program = deps.ffmpeg ?? (process.env.MYKX_HOME_LINK_FFMPEG || "ffmpeg");
  const doSpawn = deps.spawn ?? nodeSpawn;
  const timeoutMs = deps.timeoutMs ?? RTSP_TIMEOUT_MS;
  const host = (() => {
    try {
      return new URL(address).host;
    } catch {
      return "the camera";
    }
  })();
  return new Promise<Uint8Array>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const child = doSpawn(program, ffmpegArgs(address), { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const out: Buffer[] = [];
    let size = 0;
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      done(() => reject(new GrabError("timeout", `${host} didn't send a picture within ${Math.round(timeoutMs / 1000)} seconds.`)));
    }, timeoutMs);
    child.stdout?.on("data", (d: Buffer) => {
      size += d.length;
      if (size > MAX_PICTURE_BYTES) {
        child.kill("SIGKILL");
        done(() => reject(new GrabError("not-image", "The stream sent something far too big to be one picture.")));
      } else out.push(d);
    });
    child.stderr?.on("data", (d: Buffer) => {
      if (err.length < 4000) err += d.toString("utf8");
    });
    child.on("error", (e: NodeJS.ErrnoException) => {
      done(() => reject(e.code === "ENOENT" ? new GrabError("no-ffmpeg", FFMPEG_HELP) : new GrabError("ffmpeg-failed", "ffmpeg couldn't start. Check that it's installed properly.")));
    });
    child.on("close", () => {
      done(() => {
        const bytes = Buffer.concat(out);
        if (imageKind(bytes)) return resolve(bytes);
        // ffmpeg's own words may repeat the address with its password: read them here, never pass them on.
        const said = redact(err, address);
        if (/401|403|unauthori[sz]ed|forbidden/i.test(said)) return reject(new GrabError("auth", "The camera refused the user name or password."));
        if (/refused|no route|unreachable|timed out|not known|resolve|connection/i.test(said)) return reject(new GrabError("unreachable", `Can't reach the camera at ${host}.`));
        reject(new GrabError("ffmpeg-failed", `ffmpeg couldn't read a picture from ${host}. Check the stream address.`));
      });
    });
  });
}

/** One still picture from a configured camera (or an address being tested). */
export function grabPicture(address: string, deps: GrabDeps = {}): Promise<Uint8Array> {
  return sourceOf(address) === "rtsp" ? grabRtsp(address, deps) : grabSnapshot(address, deps);
}

export const grabCamera = (camera: Pick<CameraConfig, "url">, deps: GrabDeps = {}): Promise<Uint8Array> => grabPicture(camera.url, deps);
