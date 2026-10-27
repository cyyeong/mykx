#!/usr/bin/env node
// Generate or edit images with Meta Muse Image (muse-image-1.0) and record provenance.
//
//   node gen-image.mjs --prompt "..." --out public/art/kix --name idol-stage \
//     [--size 1792x1024] [--n 2] [--format webp|png|jpeg] [--ref kix-base.png ...] \
//     [--pack idol-stage] [--kind kix] [--manifest public/art/manifest.json] [--dry-run]
//
// With one or more --ref, calls /v1/images/edits (reference/edit); otherwise /v1/images/generations.
// Key: MODEL_API_KEY (dev.meta.ai docs) or META_API_KEY (Muse CLI). Standard-mode key only.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

const BASE = process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1";
const MODEL = "muse-image-1.0";
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

function parseArgs(argv) {
  const args = { ref: [], n: 1, format: "webp" };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "");
    if (key === "dry-run") { args.dryRun = true; continue; }
    const value = argv[++i];
    if (value === undefined) throw new Error(`missing value for --${key}`);
    if (key === "ref") args.ref.push(value);
    else if (key === "n") args.n = Number(value);
    else if (key === "prompt-file") args.prompt = readFileSync(value, "utf8").trim();
    else args[key] = value;
  }
  if (!args.prompt) throw new Error("--prompt or --prompt-file is required");
  if (!args.out || !args.name) throw new Error("--out and --name are required");
  if (!(args.n >= 1 && args.n <= 10)) throw new Error("--n must be 1..10");
  return args;
}

function dataUrl(path) {
  const mime = MIME[extname(path).toLowerCase()];
  if (!mime) throw new Error(`unsupported reference type: ${path}`);
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
}

async function callApi(path, body, key) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      const retryAfter = Number(res.headers.get("retry-after")) * 1000 || 0;
      const wait = Math.max(retryAfter, 500 * 2 ** attempt + Math.random() * 250);
      console.error(`HTTP ${res.status}, retrying in ${Math.round(wait)}ms`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`HTTP ${res.status} from ${path}: ${text.slice(0, 500)}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const editing = args.ref.length > 0;
  const path = editing ? "/images/edits" : "/images/generations";
  const body = { model: MODEL, prompt: args.prompt, n: args.n, response_format: "b64_json", output_format: args.format };
  if (args.size) body.size = args.size;
  if (editing) body.images = args.ref.map((r) => ({ image_url: dataUrl(r) }));

  if (args.dryRun) {
    const shown = { ...body, images: body.images?.map((_, i) => `<${args.ref[i]}>`) };
    console.log(`POST ${BASE}${path}\n${JSON.stringify(shown, null, 2)}`);
    return;
  }
  const key = process.env.MODEL_API_KEY ?? process.env.META_API_KEY;
  if (!key) throw new Error("set MODEL_API_KEY (or META_API_KEY) to a Standard-mode Meta Model API key");

  const json = await callApi(path, body, key);
  const items = json.data ?? [];
  if (items.length === 0) throw new Error(`no images returned: ${JSON.stringify(json).slice(0, 300)}`);

  mkdirSync(args.out, { recursive: true });
  const ext = args.format === "jpeg" ? "jpg" : args.format;
  const entries = [];
  for (const [i, item] of items.entries()) {
    const buf = item.b64_json
      ? Buffer.from(item.b64_json, "base64")
      : Buffer.from(await (await fetch(item.url)).arrayBuffer());
    const file = join(args.out, `${args.name}${items.length > 1 ? `-${i + 1}` : ""}.${ext}`);
    writeFileSync(file, buf);
    entries.push({
      id: basename(file, `.${ext}`), path: file, pack: args.pack ?? null, kind: args.kind ?? null,
      model: MODEL, route: "api", prompt: args.prompt, refs: args.ref, size: args.size ?? "default",
      created: new Date().toISOString().slice(0, 10), sha256: createHash("sha256").update(buf).digest("hex"), cut_by: null,
    });
    console.log(file);
  }

  if (args.manifest) {
    const manifest = existsSync(args.manifest) ? JSON.parse(readFileSync(args.manifest, "utf8")) : [];
    writeFileSync(args.manifest, `${JSON.stringify([...manifest, ...entries], null, 2)}\n`);
    console.log(`manifest: +${entries.length} → ${args.manifest}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
