// Day 1 smoke test of the Meta Model API through lib/meta:
//   (a) Spark chat  (b) Spark structured output  (c) Spark streaming
//   (d) Muse Image edit of kix-base into the Terrarium pack  (e) SAM 3.1 cutout of (d)
//
//   node --env-file=.env.local scripts/smoke-meta.ts
//
// Outputs go to art-src/smoke/ (git-ignored). Appends a dated section to docs/plan/smoke-log.md.
// Exit codes: 0 all passed, 1 a step failed or was skipped, 2 no API key.
// Budget: stops before any step that could push the estimated total over $0.10; one retry per step.
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { z } from "zod";
import {
  ContributorModelError,
  DEFAULT_SPARK_MODEL,
  MUSE_IMAGE_MODEL,
  MetaApiError,
  MetaConfigError,
  REQUEST_ID_HEADERS,
  type RunInfo,
  SAM_MODEL,
  createMetaClient,
  hasMetaApiKey,
  museImageEdit,
  redactSecrets,
  samCutout,
  sparkChat,
  sparkStream,
  sparkStructured,
} from "../lib/meta/index.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_DIR = join(ROOT, "art-src", "smoke");
const LOG_FILE = join(ROOT, "docs", "plan", "smoke-log.md");
const KIX_BASE = join(ROOT, "public", "art", "kix", "kix-base.webp");
const BUDGET_USD = 0.1;
const STUDIO_BUDGET_MS = 25_000;

// Kix canon and the Terrarium suffix, verbatim from the muse-image-assets skill.
const KIX_CANON =
  "Kix: an ORIGINAL small sidekick creature — a round, soft five-point star-shaped sprite with a glowing four-point " +
  "sparkle on its forehead, big friendly dark eyes with highlights, small rosy cheeks, gentle smile, stubby arms, " +
  "soft lavender body fading to mint at the bottom.";
const TERRARIUM_SUFFIX =
  "lush miniature terrarium world, moss, ferns, smooth pebbles, a lily-pad pond, sparkling dewdrops, warm amber " +
  "sunlight through glass, soft picture-book 3D illustration";
const KIX_TERRARIUM_PROMPT =
  "The same character as in the image, identical shape, proportions and face; restyle as a young nature explorer " +
  "with a tiny leaf scarf, standing on a mossy pebble, full body, centred, clearly separated from the background. " +
  `${KIX_CANON} ${TERRARIUM_SUFFIX}. no text, no letters, no logos, no watermark`;

const FlashcardDeck = z.object({
  topic: z.string().min(1),
  cards: z
    .array(
      z.object({
        front: z.string().min(1),
        back: z.string().min(1),
      }),
    )
    .length(3),
});

interface StepOutcome {
  run: RunInfo | null;
  note: string;
}

interface Step {
  id: string;
  label: string;
  model: string;
  /** Worst-case estimated cost of one attempt, used by the budget guard. */
  maxCostUsd: number;
  exec: () => Promise<StepOutcome>;
}

interface Row {
  step: Step;
  status: "pass" | "fail" | "skipped";
  attempts: number;
  run: RunInfo | null;
  note: string;
}

const now = new Date();
const sgt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour12: false, ...opts }).format(now);
const stamp = `${sgt({ year: "numeric" })}${sgt({ month: "2-digit" })}${sgt({ day: "2-digit" })}-${sgt({ hour: "2-digit", minute: "2-digit" }).replace(":", "")}`;
const outFile = (name: string) => join(OUT_DIR, `${stamp}-${name}`);
const rel = (path: string) => relative(ROOT, path);

let spentUsd = 0;
let editedKix: Buffer | null = null;

const steps: Step[] = [
  {
    id: "0",
    label: "List models (free)",
    model: "-",
    maxCostUsd: 0,
    async exec() {
      const { data, response } = await createMetaClient({ maxRetries: 0 }).models.list({ timeout: 15_000 }).withResponse();
      const ids = new Set(data.data.map((m) => m.id));
      const wanted = [DEFAULT_SPARK_MODEL, MUSE_IMAGE_MODEL, SAM_MODEL]
        .map((id) => `${id} ${ids.has(id) ? "listed" : "NOT listed"}`)
        .join(", ");
      const idHeaders = [...response.headers.keys()].filter((h) => /request|trace|-id$|^x-fb/i.test(h));
      const known = REQUEST_ID_HEADERS.filter((h) => response.headers.has(h));
      return {
        run: null,
        note: `${ids.size} models; ${wanted}. id-like headers: ${idHeaders.join(", ") || "none"} (matched: ${known.join(", ") || "none"})`,
      };
    },
  },
  {
    id: "a",
    label: "Spark chat",
    model: DEFAULT_SPARK_MODEL,
    maxCostUsd: 0.01,
    async exec() {
      const res = await sparkChat(
        {
          messages: [
            { role: "system", content: "You are Kix, a cheerful study sidekick for primary school pupils. Reply in one short sentence." },
            { role: "user", content: "Say hello and tell me one fun fact about frogs." },
          ],
          reasoningEffort: "low",
          maxCompletionTokens: 2000,
        },
        { timeoutMs: 30_000, maxRetries: 0 },
      );
      writeFileSync(outFile("a-chat.txt"), `${res.text}\n`);
      return { run: res.run, note: `"${clip(res.text, 90)}" (finish: ${res.finishReason})` };
    },
  },
  {
    id: "b",
    label: "Spark structured",
    model: DEFAULT_SPARK_MODEL,
    maxCostUsd: 0.015,
    async exec() {
      const res = await sparkStructured(
        {
          schema: FlashcardDeck,
          schemaName: "flashcard_deck",
          messages: [
            { role: "system", content: "You write short, accurate science flashcards for Singapore Primary 4 pupils." },
            { role: "user", content: "Make exactly 3 flashcards on the life cycle of a frog. One fact per card, back under 20 words." },
          ],
          reasoningEffort: "low",
          maxCompletionTokens: 3000,
        },
        { timeoutMs: 60_000, maxRetries: 0 },
      );
      writeFileSync(outFile("b-flashcards.json"), `${JSON.stringify(res.data, null, 2)}\n`);
      return { run: res.run, note: `zod ok, ${res.data.cards.length} cards: ${clip(res.data.cards.map((c) => c.front).join(" / "), 110)}` };
    },
  },
  {
    id: "c",
    label: "Spark streaming",
    model: DEFAULT_SPARK_MODEL,
    maxCostUsd: 0.01,
    async exec() {
      const stream = sparkStream(
        {
          messages: [
            { role: "system", content: "You are Kix, a friendly tutor. Never give the final answer; give one hint." },
            { role: "user", content: "In two short sentences, hint why my shadow is longest in the early morning." },
          ],
          reasoningEffort: "low",
          maxCompletionTokens: 2000,
        },
        { timeoutMs: 30_000, maxRetries: 0 },
      );
      let deltas = 0;
      for await (const delta of stream) {
        if (deltas === 0) process.stdout.write("    first delta: ");
        if (deltas < 6) process.stdout.write(delta.replace(/\s+/g, " "));
        deltas++;
      }
      process.stdout.write("\n");
      const res = await stream.result;
      writeFileSync(outFile("c-stream.txt"), `${res.text}\n`);
      return {
        run: res.run,
        note: `${deltas} deltas, first token ${ms(res.run.firstTokenMs)}, total ${ms(res.run.latencyMs)}; usage ${res.run.inputTokens === null ? "not reported" : "reported"} in stream`,
      };
    },
  },
  {
    id: "d",
    label: "Muse Image edit",
    model: MUSE_IMAGE_MODEL,
    maxCostUsd: 0.01,
    async exec() {
      const res = await museImageEdit(
        { prompt: KIX_TERRARIUM_PROMPT, images: KIX_BASE, size: "1024x1024", n: 1, outputFormat: "webp" },
        { timeoutMs: 90_000, maxRetries: 0 },
      );
      editedKix = res.images[0];
      const file = outFile("d-kix-terrarium.webp");
      writeFileSync(file, editedKix);
      writeFileSync(outFile("d-prompt.txt"), `${KIX_TERRARIUM_PROMPT}\n${res.revisedPrompt ? `\nrevised: ${res.revisedPrompt}\n` : ""}`);
      const meta = await sharp(editedKix).metadata();
      return {
        run: res.run,
        note: `${meta.width}x${meta.height} ${meta.format}, ${kb(editedKix.length)}; ${res.run.latencyMs <= STUDIO_BUDGET_MS ? "within" : "OVER"} 25 s alone → ${rel(file)}`,
      };
    },
  },
  {
    id: "e",
    label: "SAM 3.1 cutout",
    model: SAM_MODEL,
    maxCostUsd: 0.0025,
    async exec() {
      const source = editedKix ?? KIX_BASE;
      const res = await samCutout(
        { image: source, prompt: "star-shaped mascot", featherPx: 1, paddingPx: 8 },
        { timeoutMs: 30_000, maxRetries: 0 },
      );
      const file = outFile("e-kix-terrarium-cutout.png");
      writeFileSync(file, res.png);
      return {
        run: res.run,
        note: `${editedKix ? "from (d)" : "FALLBACK: from kix-base (d failed)"}; ${res.masks} mask(s), covers ${(res.coverage * 100).toFixed(1)}%, ${res.width}x${res.height} PNG ${kb(res.png.length)} → ${rel(file)}`,
      };
    },
  },
];

function isRetryable(err: unknown): boolean {
  if (err instanceof ContributorModelError || err instanceof MetaConfigError) return false;
  if (err instanceof MetaApiError) {
    if (err.status !== null && [400, 401, 402, 403, 404, 413].includes(err.status)) return false;
    if (err.code === "aborted") return false;
  }
  return true;
}

function errorText(err: unknown): string {
  return redactSecrets(err instanceof Error ? err.message : String(err)).replace(/\s+/g, " ");
}

async function runStep(step: Step): Promise<Row> {
  const row: Row = { step, status: "skipped", attempts: 0, run: null, note: "" };
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (spentUsd + step.maxCostUsd > BUDGET_USD) {
      row.note ||= `skipped: would exceed the $${BUDGET_USD.toFixed(2)} budget`;
      return row;
    }
    row.attempts = attempt;
    console.log(`  ${step.id}. ${step.label}${attempt > 1 ? " (retry)" : ""} ...`);
    try {
      const outcome = await step.exec();
      spentUsd += outcome.run?.costUsd ?? 0;
      return { ...row, status: "pass", run: outcome.run, note: outcome.note };
    } catch (err) {
      const run = err instanceof MetaApiError ? err.run : null;
      spentUsd += run?.costUsd ?? 0;
      Object.assign(row, { status: "fail", run, note: clip(errorText(err), 220) });
      console.log(`    failed: ${row.note}`);
      if (!isRetryable(err)) break;
    }
  }
  return row;
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
function ms(value: number | null | undefined): string {
  return value == null ? "–" : `${value.toLocaleString("en-US")} ms`;
}
function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}
function usd(value: number | null | undefined): string {
  return value == null ? "–" : `$${value.toFixed(4)}`;
}
function tokens(run: RunInfo | null): string {
  if (!run) return "–";
  if (run.inputTokens === null && run.outputTokens === null) return run.images === null ? "–" : `${run.images} img`;
  const t = `${run.inputTokens ?? "?"}/${run.outputTokens ?? "?"}`;
  return run.images === null ? t : `${run.images} img (${t})`;
}

function printTable(rows: Row[]): void {
  const header = ["Step", "Model", "Result", "Latency", "TTFT", "Tokens in/out", "Est. cost", "Request ID", "Response ID"];
  const body = rows.map((r) => [
    `${r.step.id}. ${r.step.label}`,
    r.step.model,
    r.status + (r.attempts > 1 ? ` (${r.attempts} tries)` : ""),
    ms(r.run?.latencyMs),
    ms(r.run?.firstTokenMs),
    tokens(r.run),
    usd(r.run?.costUsd),
    r.run?.requestId ?? "–",
    r.run?.responseId ?? "–",
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  console.log(`\n${line(header)}\n${widths.map((w) => "-".repeat(w)).join("  ")}`);
  for (const row of body) console.log(line(row));
  console.log("\nNotes:");
  for (const r of rows) console.log(`  ${r.step.id}. ${r.note}`);
}

function appendLog(rows: Row[], transformMs: number | null): void {
  const cell = (s: string) => s.replace(/\|/g, "\\|");
  const code = (s: string | null | undefined) => (s ? `\`${s}\`` : "–");
  const passed = rows.filter((r) => r.status === "pass").length;
  const keyVar = process.env.MODEL_API_KEY?.trim() ? "MODEL_API_KEY" : "META_API_KEY";
  const lines = [
    "",
    `## ${sgt({ day: "numeric", month: "short", year: "numeric" })}, ${sgt({ hour: "2-digit", minute: "2-digit" })} SGT`,
    "",
    `\`scripts/smoke-meta.ts\` · Node ${process.version} · key from \`${keyVar}\` · ${passed}/${rows.length} steps passed · est. cost ${usd(spentUsd)} (budget $${BUDGET_USD.toFixed(2)})` +
      (transformMs === null ? "" : ` · transform path (d + e) ${ms(transformMs)} vs 25,000 ms Studio budget`),
    "",
    "| Step | Model | Result | Latency | TTFT | Tokens in/out | Est. cost | Request ID | Response ID | Notes |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) =>
      [
        "",
        `${r.step.id}. ${r.step.label}`,
        r.step.model === "-" ? "–" : `\`${r.step.model}\``,
        r.status + (r.attempts > 1 ? ` (${r.attempts} tries)` : ""),
        ms(r.run?.latencyMs),
        ms(r.run?.firstTokenMs),
        tokens(r.run),
        usd(r.run?.costUsd),
        code(r.run?.requestId),
        code(r.run?.responseId),
        cell(r.note),
        "",
      ].join(" | ").trim(),
    ),
    "",
  ];
  if (!existsSync(LOG_FILE)) writeFileSync(LOG_FILE, "# Meta Model API smoke log\n");
  appendFileSync(LOG_FILE, `${lines.join("\n")}\n`);
}

async function main(): Promise<number> {
  if (!hasMetaApiKey()) {
    console.error(
      "No Meta API key found. Put a Standard-mode key in .env.local as MODEL_API_KEY=… and run:\n" +
        "  node --env-file=.env.local scripts/smoke-meta.ts",
    );
    return 2;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Meta smoke test ${stamp} SGT (budget $${BUDGET_USD.toFixed(2)}), outputs in ${rel(OUT_DIR)}/`);

  const rows: Row[] = [];
  for (const step of steps) rows.push(await runStep(step));

  const d = rows.find((r) => r.step.id === "d");
  const e = rows.find((r) => r.step.id === "e");
  const transformMs =
    d?.status === "pass" && e?.status === "pass" && d.run && e.run ? d.run.latencyMs + e.run.latencyMs : null;

  printTable(rows);
  console.log(`\nEstimated total: ${usd(spentUsd)}${transformMs === null ? "" : ` · transform path (d + e): ${ms(transformMs)}`}`);
  appendLog(rows, transformMs);
  console.log(`Appended to ${rel(LOG_FILE)}`);
  return rows.every((r) => r.status === "pass") ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`smoke-meta crashed: ${errorText(err)}`);
    process.exit(1);
  },
);
