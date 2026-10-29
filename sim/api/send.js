// The Home simulator's server (Vercel function in the mykx-sim project; `node sim/dev.mjs` locally). It holds the
// Home Link device token for the demo family (SIM_HOME_LINK_TOKEN, a server-side setting, never sent to the page)
// and sends only its own synthetic frames and scripted points to myKx's real APIs, exactly like a real Home Link
// and phone. The page must give the passcode (SIM_PASSCODE). myKx caps this device at 300 frames a day.
import { timingSafeEqual } from "node:crypto";
import { FRAMES, ROLES, ROOMS, SPOTS, cameraKey } from "../script.js";

const MYKX = () => (process.env.MYKX_URL ?? "https://mykx.vercel.app").replace(/\/$/, "");
let synced = false;
let kidsCache = null;
let lastAt = 0;

function passcodeOk(request) {
  const want = process.env.SIM_PASSCODE ?? "";
  const got = request.headers.get("x-sim-passcode") ?? "";
  // At least 6 characters (the founder's choice, 29 Oct): it only guards sending synthetic data into the sample household.
  if (want.length < 6 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

async function mykx(path, init = {}) {
  const t0 = Date.now();
  const res = await fetch(`${MYKX()}${path}`, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${process.env.SIM_HOME_LINK_TOKEN ?? ""}` } });
  const body = await res.json().catch(() => ({ ok: false, reason: "not-json" }));
  return { status: res.status, ms: Date.now() - t0, body };
}

async function kids() {
  if (kidsCache) return kidsCache;
  const r = await mykx("/api/home/family");
  if (r.status !== 200) throw new Error(`myKx /api/home/family answered ${r.status} (${r.body.reason ?? ""})`);
  const list = r.body.kids;
  const pick = (name, i) => list.find((k) => k.nickname === name) ?? [...list].sort((a, b) => (a.band === b.band ? 0 : a.band === "junior" ? -1 : 1))[i] ?? null;
  kidsCache = { A: pick(ROLES.A, 0), B: pick(ROLES.B, 1), C: pick(ROLES.C, 2) };
  return kidsCache;
}

async function syncCameras() {
  if (synced) return;
  const r = await mykx("/api/home/cameras", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ cameras: ROOMS.map((room) => ({ key: cameraKey(room), room })) }) });
  if (r.status !== 200) throw new Error(`myKx /api/home/cameras answered ${r.status} (${r.body.reason ?? ""})`);
  synced = true;
}

async function sendFrames(frames, burst) {
  await syncCameras();
  const form = new FormData();
  const meta = [];
  let i = 0;
  for (const f of frames.slice(0, 4)) {
    if (!FRAMES[f.frame] || !ROOMS.includes(f.room)) throw new Error("unknown frame or room");
    const img = await fetch(`${MYKX()}/art/sim/${f.frame}.webp`);
    if (!img.ok) throw new Error(`couldn't load ${f.frame}`);
    const bytes = new Uint8Array(await img.arrayBuffer());
    for (let b = 0; b < (burst ? 3 : 1); b++) {
      meta.push({ camera: cameraKey(f.room), at: new Date(Date.now() + b * 1000).toISOString(), burst: b });
      form.set(`frame${i++}`, new File([bytes], `${f.frame}.webp`, { type: "image/webp" }));
    }
  }
  form.set("meta", JSON.stringify({ frames: meta }));
  return mykx("/api/home/frames", { method: "POST", body: form });
}

async function sendLocation(role, spotName) {
  const kid = (await kids())[role];
  const spot = SPOTS[spotName];
  if (!kid || !spot) throw new Error("unknown kid or spot");
  // Two fixes ten seconds apart with a little GPS wobble, as a phone would batch them. Times only ever move forward,
  // even when two sends come close together: myKx ignores a point older than the kid's last one.
  const at1 = Math.max(Date.now() - 10_000, lastAt + 1000);
  const at2 = Math.max(Date.now(), at1 + 1000);
  lastAt = at2;
  const points = [at1, at2].map((at, i) => ({ at: new Date(at).toISOString(), lat: spot.lat + (i ? 0 : 0.00008), lng: spot.lng + (i ? 0 : -0.00006), accuracyM: 9 + i * 3, speed: spot.speed, heading: null, activity: spot.activity, battery: 64 }));
  return mykx("/api/location", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kidId: kid.id, points }) });
}

export async function POST(request) {
  if (!passcodeOk(request)) return Response.json({ ok: false, reason: "passcode" }, { status: 401 });
  if (!process.env.SIM_HOME_LINK_TOKEN) return Response.json({ ok: false, reason: "not-paired" }, { status: 503 });
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  try {
    const results = [];
    if (body.type === "location" || body.spot) results.push({ what: `location · ${ROLES[body.role] ?? body.role} at ${body.spot}`, ...(await sendLocation(body.role, body.spot)) });
    if (body.frames?.length) results.push({ what: `frames · ${body.frames.map((f) => f.room).join(", ")}${body.burst ? " (burst)" : ""}`, ...(await sendFrames(body.frames, Boolean(body.burst))) });
    return Response.json({ ok: true, results });
  } catch (e) {
    return Response.json({ ok: false, reason: "error", note: String(e.message ?? e).slice(0, 200) }, { status: 502 });
  }
}

export async function GET(request) {
  if (!passcodeOk(request)) return Response.json({ ok: false, reason: "passcode" }, { status: 401 });
  if (!process.env.SIM_HOME_LINK_TOKEN) return Response.json({ ok: false, reason: "not-paired", mykx: MYKX() });
  try {
    const k = await kids();
    return Response.json({ ok: true, mykx: MYKX(), kids: Object.fromEntries(Object.entries(k).map(([role, kid]) => [role, kid?.nickname ?? null])) });
  } catch (e) {
    return Response.json({ ok: false, reason: "error", note: String(e.message ?? e).slice(0, 200), mykx: MYKX() }, { status: 502 });
  }
}
