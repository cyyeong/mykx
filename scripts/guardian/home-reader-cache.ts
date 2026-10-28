// Runs the real Home Reader (Muse Spark 1.3, Standard) on each synthetic simulator frame (public/art/sim), prints
// what it saw, and saves the model's answers keyed by each file's hash to lib/home-watch/sim-readings.json: the
// cached fallback the frames route uses for these exact frames if a live call fails (rule 7). Synthetic only.
//   node --env-file=.env.local scripts/guardian/home-reader-cache.ts
import { readFileSync, writeFileSync } from "node:fs";
import { sparkStructured } from "../../lib/meta/spark.ts";
import { frameHash, shrink } from "../../lib/home-watch/read.ts";
import { readerPrompt, readerSchema, settleReading } from "../../lib/home-watch/reader.ts";

const FRAMES = ["living-reading", "living-tv", "kitchen-snack", "study-homework", "living-argument", "living-window", "entrance-arrive", "kitchen-empty"];
const ROOM: Record<string, string> = { living: "Living room", kitchen: "Kitchen", study: "Study", entrance: "Entrance" };
const KIDS = [
  { nickname: "Jordan", band: "junior" as const, description: "Youngest, about 9, short straight black hair, often a light blue T-shirt" },
  { nickname: "Abby", band: "junior" as const, description: "About 12, curly chin-length hair, often a mustard-yellow T-shirt" },
  { nickname: "Leonard", band: "teen" as const, description: "About 14, long black ponytail and round glasses, often a grey hoodie" },
];

const out: Record<string, unknown> = {};
for (const name of FRAMES) {
  const bytes = new Uint8Array(readFileSync(`public/art/sim/${name}.webp`));
  const room = ROOM[name.split("-")[0]];
  const t0 = Date.now();
  const { data, run } = await sparkStructured(
    {
      messages: [
        { role: "system", content: readerPrompt(KIDS) },
        { role: "user", content: [{ type: "text", text: `Cameras this tick (1):` }, { type: "text", text: `Camera "cam", ${room}, 17:08:31:` }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${(await shrink(bytes)).toString("base64")}` } }] },
      ],
      schema: readerSchema,
      schemaName: "home_reading",
      reasoningEffort: "low",
    },
    { timeoutMs: 60_000 },
  );
  const cam = data.cameras[0];
  if (!cam) throw new Error(`${name}: no reading`);
  const rest: Partial<typeof cam> = { ...cam };
  delete rest.camera;
  out[frameHash(bytes)] = rest;
  const r = settleReading(cam, KIDS, "live");
  console.log(`${name.padEnd(16)} ${String(Date.now() - t0).padStart(5)} ms  in ${run.inputTokens ?? "?"}  out ${run.outputTokens ?? "?"}  | ${r.activity} · ${r.concern} · hazard: ${r.hazard} · ${r.people.map((p) => p.likely ?? p.who).join(", ") || "nobody"} · cue: ${r.cue ?? "-"}\n${" ".repeat(18)}${r.reason}`);
}
writeFileSync("lib/home-watch/sim-readings.json", JSON.stringify(out, null, 2) + "\n");
console.log(`saved ${Object.keys(out).length} readings`);
