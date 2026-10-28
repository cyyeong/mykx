// Frames from a device's cameras (GUARDIAN §2.2): multipart, a `meta` JSON part and up to 12 images (`frame0`…).
// Checked here: the device's cameras, the family's camera hours and pause, image type and size, and the device's
// daily budget (simulator 300, Home Link 3000). The Home Reader (Muse Spark, M2) reads them into room statuses;
// frames are never stored, except the ones behind a flag (24 h). Until M2, frames are checked and counted only.
import { withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import { requireDevice } from "@/lib/home-watch/device-auth";
import { DAILY_FRAMES, camerasOn, imageKind, sgDay } from "@/lib/home-watch/home-watch";
import { framesMeta } from "@/lib/home-watch/schemas";

export const maxDuration = 60;
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
      if (!kind) return fail(415, "not-allowed");
      frames.push({ cameraId: camera.id, at: f.at, burst: f.burst, bytes, kind });
    }
    if (total > MAX_TOTAL) return fail(413, "too-large");
    if (!(await store.homeWatch.spendFrames(device.id, sgDay(now), frames.length, DAILY_FRAMES[device.kind], now.toISOString()))) return fail(429, "slow-down");
    await store.homeWatch.touchCameras(device.householdId, [...new Set(frames.map((f) => f.cameraId))], now.toISOString());
    return ok({ accepted: frames.length, camerasOn: true, read: false }, 202);
  });
}
