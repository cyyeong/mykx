// A pretend camera for trying Home Link without one: serves our synthetic pictures (public/art/sim) as JPEG snapshots.
//   node dev/fake-camera.ts [--port 8099] [--hold 2] [--auth user:password]
// Snapshot addresses to paste into Home Link (port 8099):
//   http://127.0.0.1:8099/snapshot/living.jpg    cycles through the living-room pictures (also kitchen, study, entrance)
//   http://127.0.0.1:8099/snapshot/living-tv.jpg one fixed picture (any file name in public/art/sim, without -640)
//   http://127.0.0.1:8099/snapshot/all.jpg       cycles through every picture
// Each cycling address moves to the next picture after --hold requests (default 2), so some rounds show no change.
// With --auth the camera wants Basic sign-in, like a real one. The pictures are synthetic art made for myKx.
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";

const { values } = parseArgs({ options: { port: { type: "string", default: "8099" }, hold: { type: "string", default: "2" }, auth: { type: "string" } }, strict: true });
const port = Number(values.port);
const hold = Math.max(1, Number(values.hold) || 2);
const want = values.auth ? `Basic ${Buffer.from(values.auth).toString("base64")}` : null;

const dir = join(import.meta.dirname, "..", "..", "..", "public", "art", "sim");
const names = readdirSync(dir)
  .filter((f) => f.endsWith(".webp") && !f.includes("-640") && !f.includes("-sam"))
  .map((f) => basename(f, ".webp"))
  .sort();
if (!names.length) throw new Error(`No pictures found in ${dir}.`);

const cache = new Map<string, Buffer>();
async function jpeg(name: string): Promise<Buffer> {
  let b = cache.get(name);
  if (!b) {
    b = await sharp(readFileSync(join(dir, `${name}.webp`))).jpeg({ quality: 85 }).toBuffer();
    cache.set(name, b);
  }
  return b;
}

const counts = new Map<string, number>();
function pick(alias: string): string | null {
  if (names.includes(alias)) return alias;
  const pool = alias === "all" ? names : names.filter((n) => n.startsWith(`${alias}-`));
  if (!pool.length) return null;
  const n = counts.get(alias) ?? 0;
  counts.set(alias, n + 1);
  return pool[Math.floor(n / hold) % pool.length];
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (want && req.headers.authorization !== want) {
    console.log(`${req.method} ${url.pathname} -> 401`);
    res.writeHead(401, { "www-authenticate": 'Basic realm="fake camera"' }).end("Sign in");
    return;
  }
  const m = /^\/snapshot\/([\w-]+)\.jpg$/.exec(url.pathname);
  const name = m ? pick(m[1]) : null;
  if (!name) {
    res.writeHead(404).end("Try /snapshot/living.jpg");
    return;
  }
  void jpeg(name).then((body) => {
    console.log(`${req.method} ${url.pathname} -> ${name}`);
    res.writeHead(200, { "content-type": "image/jpeg", "content-length": body.length, "cache-control": "no-store" }).end(body);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Fake camera on http://127.0.0.1:${port}/snapshot/living.jpg${want ? " (Basic sign-in required)" : ""}\nPictures: ${names.join(", ")}`);
});
