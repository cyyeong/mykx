// Server only: one Home Reader call (Muse Spark, Standard) for a tick's frames, grouped by camera (a burst's three
// frames go together). Frames are shrunk to 640 px for the model and dropped afterwards. If the live call fails, a
// frame the simulator sends that was read live before uses that earlier reading, labelled "cached" (rule 7); a real
// camera's frame just isn't read this tick.
import sharp from "sharp";
import { instructionsFor } from "../agents/runtime.ts";
import { hasMetaApiKey } from "../meta/client.ts";
import { sparkStructured } from "../meta/spark.ts";
import { sha256Hex, type RoomReading } from "./home-watch.ts";
import { readerPrompt, readerSchema, settleReading, type ReaderKid, type ReaderOutput } from "./reader.ts";
import SIM_READINGS from "./sim-readings.json" with { type: "json" };

export interface TickFrame {
  cameraKey: string;
  room: string;
  at: string;
  bytes: Uint8Array;
}

export interface TickReading {
  readings: Map<string, RoomReading>;
  source: "live" | "cached" | "none";
  error: string | null;
}

const CACHE = SIM_READINGS as unknown as Record<string, Omit<ReaderOutput["cameras"][number], "camera">>;
const sgClock = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).toISOString().slice(11, 19);

export async function shrink(bytes: Uint8Array): Promise<Buffer> {
  return sharp(bytes).resize({ width: 640, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
}

export function frameHash(bytes: Uint8Array): string {
  return sha256Hex(Buffer.from(bytes).toString("base64"));
}

export async function readTick(frames: readonly TickFrame[], kids: readonly ReaderKid[], options: { signal?: AbortSignal } = {}): Promise<TickReading> {
  const byCamera = new Map<string, TickFrame[]>();
  for (const f of frames) byCamera.set(f.cameraKey, [...(byCamera.get(f.cameraKey) ?? []), f]);
  const cached = (): TickReading => {
    const readings = new Map<string, RoomReading>();
    for (const [key, list] of byCamera) {
      const hit = CACHE[frameHash(list[list.length - 1].bytes)];
      if (hit) readings.set(key, settleReading({ camera: key, ...hit }, kids, "cached"));
    }
    return { readings, source: readings.size ? "cached" : "none", error: null };
  };
  if (!hasMetaApiKey()) return { ...cached(), error: "no-key" };
  try {
    const content: ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[] = [{ type: "text", text: `Cameras this tick (${byCamera.size}):` }];
    for (const [key, list] of byCamera) {
      content.push({ type: "text", text: `Camera "${key}", ${list[0].room}, ${sgClock(list[0].at)}${list.length > 1 ? `, a burst of ${list.length} pictures about a second apart` : ""}:` });
      for (const f of list) content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${(await shrink(f.bytes)).toString("base64")}` } });
    }
    const { data } = await sparkStructured(
      { messages: [{ role: "system", content: readerPrompt(kids, await instructionsFor("home-reader", {})) }, { role: "user", content }], schema: readerSchema, schemaName: "home_reading", reasoningEffort: "low" },
      { timeoutMs: 40_000, signal: options.signal },
    );
    const readings = new Map<string, RoomReading>();
    for (const c of data.cameras) if (byCamera.has(c.camera)) readings.set(c.camera, settleReading(c, kids, "live"));
    return { readings, source: "live", error: null };
  } catch (e) {
    return { ...cached(), error: (e as Error).message.slice(0, 160) };
  }
}
