// Paper connectors for the two sites the scout can't download from (skill: .agents/skills/past-paper-scout).
// Works from the latest scout report in MYKX_PAPERS_DIR/scout/.
//
//   node --env-file=.env.local scripts/papers/connect.ts sgexam [--level P3] [--subject science] [--limit 10]
//     sgexam hosts its PDFs as public Google Drive files. Bots may not use Drive's download links, so this goes
//     through Google's Drive API (files.get, alt=media) with GOOGLE_API_KEY: the sanctioned way to read a public
//     file. Metadata first (PDF only, ≤ 20 MB), one file every 2 s, at most 50 a run, stops on any refusal.
//
//   node scripts/papers/connect.ts testpapersfree [--level P3] [--subject science] [--limit 10]
//     testpapersfree's download sits behind Google reCAPTCHA, so it is never automated. This opens the next pages
//     in your own browser; you pass the check and download each PDF, then upload them together in
//     Admin → Add knowledge. It remembers which pages it opened.
//
// Papers are private reference only (AGENTS.md rule 10): never committed, never shown to children.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { driveFileId, driveMediaUrl, driveMetaUrl, isHumanGate } from "../../lib/papers/drive.ts";
import type { PaperRef } from "../../lib/papers/scout.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(process.env.MYKX_PAPERS_DIR ?? join(ROOT, "..", "mykx-papers"));
const UA = "Mozilla/5.0 (compatible; myKx-paper-connector/0.1; admin-run; +https://mykx.vercel.app)";
const MAX_BYTES = 20 * 1024 * 1024;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const [site, ...args] = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const limit = Math.min(50, Math.max(1, Number(flag("limit") ?? 10)));
const level = flag("level");
const subject = flag("subject");

type Row = PaperRef & { fetch: string; reason: string; pack?: string };

function latestReport(): { rows: Row[]; file: string } {
  const dir = join(OUT, "scout");
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
  if (!files.length) throw new Error(`No scout report in ${dir}. Run: node scripts/papers/scout.ts`);
  const file = join(dir, files[files.length - 1]);
  return { rows: (JSON.parse(readFileSync(file, "utf8")) as { rows: Row[] }).rows, file };
}

function pick(rows: Row[], id: string): Row[] {
  return rows.filter((r) => r.site === id && (!level || r.level === level) && (!subject || r.subject === subject));
}

const slug = (r: Row) => `${r.title.replace(/[^\w.-]+/g, "_").slice(0, 120)}.pdf`;

async function sgexam() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) {
    console.log("GOOGLE_API_KEY isn't set. Create one in Google Cloud: enable the Google Drive API, create an API key restricted to it, and add GOOGLE_API_KEY=… to .env.local (it stays on this machine).");
    process.exit(1);
  }
  const manifestPath = join(OUT, "sgexam", "manifest.json");
  const manifest: Record<string, { file: string; sha256: string; page: string; driveId: string; bytes: number; at: string }> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  const todo = pick(latestReport().rows, "sgexam").filter((r) => !manifest[r.pageUrl]).slice(0, limit);
  console.log(`sgexam: ${todo.length} to fetch through the Drive API${level ? ` (${level})` : ""}${subject ? ` (${subject})` : ""}.`);
  const problems: string[] = [];
  for (const r of todo) {
    try {
      const page = await fetch(r.pageUrl, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(25_000) });
      const html = await page.text();
      if (isHumanGate(html)) throw new Error("the page asks for a human check; skipped");
      const id = driveFileId(html);
      if (!id) throw new Error("no Drive file on the page (layout changed?)");
      await sleep(1_000);
      const meta = await fetch(driveMetaUrl(id, key), { signal: AbortSignal.timeout(20_000) });
      if (meta.status === 403 || meta.status === 429) throw Object.assign(new Error(`Drive API refused (${meta.status}): quota or key restrictions. Stopping.`), { stop: true });
      if (!meta.ok) throw new Error(`Drive metadata ${meta.status}`);
      const m = (await meta.json()) as { name?: string; size?: string; mimeType?: string };
      if (m.mimeType !== "application/pdf") throw new Error(`not a PDF (${m.mimeType})`);
      if (Number(m.size ?? 0) > MAX_BYTES) throw new Error(`${(Number(m.size) / 1e6).toFixed(1)} MB is over 20 MB`);
      const media = await fetch(driveMediaUrl(id, key), { signal: AbortSignal.timeout(90_000) });
      if (!media.ok) throw new Error(`Drive download ${media.status}`);
      const buf = Buffer.from(await media.arrayBuffer());
      if (buf.subarray(0, 4).toString() !== "%PDF") throw new Error("the file isn't a PDF");
      const dest = join(OUT, "sgexam", String(r.year ?? "unknown"), slug(r));
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, buf);
      manifest[r.pageUrl] = { file: dest, sha256: createHash("sha256").update(buf).digest("hex"), page: r.pageUrl, driveId: id, bytes: buf.length, at: new Date().toISOString() };
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`  ✓ ${r.title} (${(buf.length / 1e6).toFixed(1)} MB)`);
    } catch (e) {
      problems.push(`${r.title}: ${(e as Error).message}`);
      console.log(`  ! ${r.title}: ${(e as Error).message}`);
      if ((e as { stop?: boolean }).stop) break;
    }
    await sleep(2_000);
  }
  console.log(`\nSaved in ${join(OUT, "sgexam")}. Upload them in Admin → Add knowledge (rights: school paper, private reference).`);
  if (problems.length) console.log(`${problems.length} problem(s) above.`);
}

function testpapersfree() {
  const openedPath = join(OUT, "testpapersfree", "opened.json");
  const opened: string[] = existsSync(openedPath) ? JSON.parse(readFileSync(openedPath, "utf8")) : [];
  const todo = pick(latestReport().rows, "testpapersfree").filter((r) => !opened.includes(r.pageUrl)).slice(0, limit);
  if (!todo.length) return console.log("testpapersfree: every page in the latest report has been opened.");
  console.log(`testpapersfree: opening ${todo.length} pages in your browser. On each, pass the check and download the PDF.`);
  for (const r of todo) {
    console.log(`  → ${r.level} ${r.subject} ${r.year} ${r.type ?? ""} · ${r.school ?? ""}: ${r.pageUrl}`);
    execFileSync("open", [r.pageUrl]);
  }
  mkdirSync(dirname(openedPath), { recursive: true });
  writeFileSync(openedPath, JSON.stringify([...opened, ...todo.map((r) => r.pageUrl)], null, 2));
  console.log("\nThen drag the downloaded PDFs into Admin → Add knowledge together (rights: school paper, private reference).");
}

if (site === "sgexam") await sgexam();
else if (site === "testpapersfree") testpapersfree();
else {
  console.log("Usage: connect.ts sgexam|testpapersfree [--level P3] [--subject science] [--limit 10]");
  process.exit(1);
}
