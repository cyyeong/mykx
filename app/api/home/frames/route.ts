// Frames from a device's cameras (GUARDIAN §2.2): multipart, a `meta` JSON part and up to 12 images (`frame0`…).
// Checked here: the device's cameras, the family's camera hours and pause, image type and size, and the device's
// daily budget (simulator 300, Home Link 3000). Then, in one go:
//   1. the Home Reader (Muse Spark, Standard) reads every changed camera in one call (lib/home-watch/read.ts);
//   2. the readings are saved as room statuses (words only);
//   3. the deterministic rules decide alerts (lib/home-watch/flags.ts);
//   4. a flagged camera's frames get SAM 3.1 outlines of the children and are kept privately for 24 h.
// Every other frame is dropped as soon as it's read.
import sharp from "sharp";
import { withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { requireDevice } from "@/lib/home-watch/device-auth";
import { alertFor } from "@/lib/home-watch/flags";
import { DAILY_FRAMES, KEEP_FRAMES_MS, camerasOn, imageKind, sgDay } from "@/lib/home-watch/home-watch";
import { PACK_COLOUR, outlineChildren } from "@/lib/home-watch/outline";
import { readTick, shrink } from "@/lib/home-watch/read";
import { framesMeta } from "@/lib/home-watch/schemas";
import { logRunsFor } from "@/lib/runs/log";

export const maxDuration = 120;
const MAX_FRAME = 1.5 * 1024 * 1024;
const MAX_TOTAL = 4 * 1024 * 1024;

export async function POST(request: Request) {
  return withAuth(request, async ({ store }) => {
    const auth = await requireDevice(store, request, "home-frames", 30);
    if (auth.refused) return auth.refused;
    const device = auth.device;
    if (Number(request.headers.get("content-length") ?? 0) > MAX_TOTAL + 64_000) return fail(413, "too-large");
    const form = await request.formData().catch(() => null);
    const meta = framesMeta.safeParse(JSON.parse(String(form?.get("meta") ?? "null")));
    if (!form || !meta.success) return fail(400, "invalid");
    const now = new Date();
    const prefs = await store.homeWatch.prefs(device.householdId);
    if (!camerasOn(prefs, now)) return ok({ accepted: 0, camerasOn: false });
    const cameras = (await store.homeWatch.cameras(device.householdId)).filter((c) => c.deviceId === device.id && c.enabled);
    const frames: { cameraId: string; at: string; burst: number; bytes: Uint8Array; kind: "jpeg" | "png" | "webp" }[] = [];
    let total = 0;
    for (const [i, f] of meta.data.frames.entries()) {
      const file = form.get(`frame${i}`);
      const camera = cameras.find((c) => c.key === f.camera);
      if (!(file instanceof File) || !camera) return fail(400, "invalid");
      if (file.size > MAX_FRAME) return fail(413, "too-large");
      total += file.size;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const kind = imageKind(bytes);
      // A real image the server can decode, at a size a camera would send.
      const size = kind ? await sharp(bytes).metadata().catch(() => null) : null;
      if (!kind || !size?.width || !size.height || size.width > 4096 || size.height > 4096) return fail(415, "not-allowed");
      frames.push({ cameraId: camera.id, at: f.at, burst: f.burst, bytes, kind });
    }
    if (total > MAX_TOTAL) return fail(413, "too-large");
    if (!(await store.homeWatch.spendFrames(device.id, sgDay(now), frames.length, DAILY_FRAMES[device.kind], now.toISOString()))) return fail(429, "slow-down");
    const hh = device.householdId;
    await store.homeWatch.touchCameras(hh, [...new Set(frames.map((f) => f.cameraId))], now.toISOString());

    // 1. Read. The kids' nicknames and the parent's own words let Muse say "likely Ari"; nothing else about them.
    logRunsFor("home-reader", hh, null);
    const kids = await store.kids(hh);
    const reader = kids.map((k) => ({ nickname: k.nickname, band: k.band ?? "junior", description: prefs.descriptions[k.id] ?? null }));
    const keyOf = new Map(cameras.map((c) => [c.id, c.key]));
    const tick = await readTick(frames.map((f) => ({ cameraKey: keyOf.get(f.cameraId)!, room: cameras.find((c) => c.id === f.cameraId)!.room, at: f.at, bytes: f.bytes })), reader, { signal: request.signal });

    // 2. Save what was read, then 3. decide alerts with the camera's last ten minutes and the parent's checks.
    const since10 = new Date(now.getTime() - 10 * 60_000).toISOString();
    const [recent, history] = await Promise.all([store.homeWatch.statuses(hh, since10), store.homeWatch.alerts(hh, new Date(now.getTime() - 14 * 86_400_000).toISOString())]);
    const rows = [...tick.readings].map(([key, reading]) => {
      const camera = cameras.find((c) => c.key === key)!;
      const mine = frames.filter((f) => f.cameraId === camera.id);
      return { camera, reading, frames: mine, at: mine[mine.length - 1].at };
    });
    await store.homeWatch.saveStatuses(hh, rows.map((r) => ({ cameraId: r.camera.id, at: r.at, reading: r.reading })));
    const colourOf = (nickname: string) => PACK_COLOUR[kids.find((k) => k.nickname === nickname)?.pack ?? ""];
    const raised: { camera: string; level: string; kind: string }[] = [];
    for (const r of rows) {
      const draft = alertFor({
        at: r.at,
        reading: r.reading,
        recent: recent.filter((s) => s.cameraId === r.camera.id),
        burst: r.frames.length > 1,
        softened: new Set(history.filter((a) => a.cameraId === r.camera.id && a.verdict === "not-right").map((a) => a.kind)),
        lastAlerts: history.filter((a) => a.cameraId === r.camera.id),
      });
      if (!draft) continue;
      // 4. Keep this camera's frames for the parent to check: the last one with SAM's outlines of the children.
      const kept = await Promise.all(r.frames.map(async (f, i) => (i === r.frames.length - 1 ? (await outlineChildren(f.bytes, r.reading.people, colourOf)).webp : await shrink(f.bytes))));
      const paths = await store.homeWatch.saveAlertFrames(hh, `${r.camera.id}-${Date.parse(r.at)}`, kept);
      await store.homeWatch.addAlert(hh, { ...draft, cameraId: r.camera.id, at: r.at, framePaths: paths, framesExpireAt: new Date(now.getTime() + KEEP_FRAMES_MS).toISOString() });
      raised.push({ camera: r.camera.key, level: draft.level, kind: draft.kind });
    }
    return ok(
      {
        accepted: frames.length,
        camerasOn: true,
        read: tick.source,
        statuses: rows.map((r) => ({ camera: r.camera.key, activity: r.reading.activity, cue: r.reading.cue, concern: r.reading.concern, reason: r.reading.reason, source: r.reading.source })),
        alerts: raised,
      },
      202,
    );
  });
}
