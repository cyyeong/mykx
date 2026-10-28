// Test helpers for Home Link: a pretend camera, a pretend myKx, and pictures with known brightness. Not part of the program.
import { mkdtempSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

export const TOKEN = `hl_${"a".repeat(43)}`;

/** A flat JPEG of one grey level, so its thumbnail's brightness is known. */
export async function grey(level: number, width = 320, height = 180): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: level, g: level, b: level } } }).jpeg({ quality: 90 }).toBuffer();
}

export function tempDir(): { dir: string; remove: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "mykx-home-link-"));
  return { dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
}

const listen = (server: Server) => new Promise<number>((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port)));
const close = (server: Server) => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });

export interface FakeCamera {
  url: string;
  port: number;
  /** The picture it serves next. */
  picture: Buffer;
  /** "ok", or how it misbehaves: "down" (reset connection), "error" (HTTP 500), "text" (not a picture), "hang". */
  mode: "ok" | "down" | "error" | "text" | "hang";
  hits: { url: string; authorization: string | undefined }[];
  close(): Promise<void>;
}

/** A snapshot camera on 127.0.0.1. With `auth` ("user:password") it wants Basic sign-in. */
export async function fakeCamera(picture: Buffer, auth?: string): Promise<FakeCamera> {
  const cam: FakeCamera = { url: "", port: 0, picture, mode: "ok", hits: [], close: () => close(server) };
  const server = createServer((req, res) => {
    cam.hits.push({ url: req.url ?? "", authorization: req.headers.authorization });
    if (cam.mode === "hang") return;
    if (cam.mode === "down") return void req.socket.destroy();
    if (auth && req.headers.authorization !== `Basic ${Buffer.from(auth).toString("base64")}`) return void res.writeHead(401, { "www-authenticate": 'Basic realm="cam"' }).end("no");
    if (cam.mode === "error") return void res.writeHead(500).end("oops");
    if (cam.mode === "text") return void res.writeHead(200, { "content-type": "text/html" }).end("<html>hello</html>");
    res.writeHead(200, { "content-type": "image/jpeg", "content-length": cam.picture.length }).end(cam.picture);
  });
  cam.port = await listen(server);
  cam.url = `http://127.0.0.1:${cam.port}/snapshot.jpg`;
  return cam;
}

export interface Seen {
  method: string;
  path: string;
  authorization: string | undefined;
  contentType: string | undefined;
  /** Every byte of the request body. */
  raw: Buffer;
  json?: Record<string, unknown>;
  meta?: { frames: { camera: string; at: string; burst: number }[] };
  frames?: { name: string; type: string; bytes: Buffer }[];
}
export interface Reply {
  status: number;
  body: unknown;
}
export interface FakeMyKx {
  url: string;
  seen: Seen[];
  /** Overrides the default answer; return undefined to use the default. */
  answer: ((req: Seen) => Reply | undefined) | null;
  close(): Promise<void>;
}

async function body(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

/** A pretend myKx: answers /api/home/pair, /cameras and /frames the way the real routes do when all is well. */
export async function fakeMyKx(): Promise<FakeMyKx> {
  const my: FakeMyKx = { url: "", seen: [], answer: null, close: () => close(server) };
  const server = createServer(async (req, res) => {
    const raw = await body(req);
    const seen: Seen = { method: req.method ?? "", path: req.url ?? "", authorization: req.headers.authorization, contentType: req.headers["content-type"], raw };
    if (seen.contentType?.startsWith("multipart/form-data")) {
      const form = await new Response(new Uint8Array(raw), { headers: { "content-type": seen.contentType } }).formData();
      seen.meta = JSON.parse(String(form.get("meta")));
      seen.frames = [];
      for (let i = 0; form.get(`frame${i}`); i++) {
        const f = form.get(`frame${i}`) as File;
        seen.frames.push({ name: f.name, type: f.type, bytes: Buffer.from(await f.arrayBuffer()) });
      }
    } else if (raw.length) seen.json = JSON.parse(raw.toString("utf8"));
    my.seen.push(seen);
    const mine = my.answer?.(seen) ?? fallback(seen);
    res.writeHead(mine.status, { "content-type": "application/json" }).end(JSON.stringify(mine.body));
  });
  const fallback = (req: Seen): Reply => {
    if (req.path === "/api/home/pair") {
      return req.json?.code === "K7Q4-MZ2P" ? { status: 200, body: { ok: true, token: TOKEN, device: { id: "d1", name: "Study laptop", kind: "home-link" } } } : { status: 401, body: { ok: false, reason: "wrong" } };
    }
    if (req.path === "/api/home/cameras") return { status: 200, body: { ok: true, cameras: [] } };
    if (req.path === "/api/home/frames") {
      const cameras = [...new Set(req.meta?.frames.map((f) => f.camera))];
      return { status: 202, body: { ok: true, accepted: req.meta?.frames.length ?? 0, camerasOn: true, read: "live", statuses: cameras.map((camera) => ({ camera, activity: "watching a screen", cue: null, concern: "none", reason: "", source: "live" })), alerts: [] } };
    }
    return { status: 404, body: { ok: false, reason: "not-found" } };
  };
  my.url = `http://127.0.0.1:${await listen(server)}`;
  return my;
}
