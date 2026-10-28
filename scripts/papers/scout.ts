// The past-paper scout (skill: .agents/skills/past-paper-scout). Reads the admin-approved sites' listing pages,
// finds the latest papers for myKx's levels, decides for each whether the agent may download it (robots.txt and
// the site's terms), and writes a report plus a click-list for the ones the admin must download by hand.
//
//   node scripts/papers/scout.ts            report only (no downloads)
//   node scripts/papers/scout.ts --fetch    also downloads the "auto" papers (PDF only, ≤ 20 MB each)
//
// Everything lands in MYKX_PAPERS_DIR (default: ../mykx-papers, outside the repo). Papers are private reference
// only (AGENTS.md rule 10): never committed, never served to children; the knowledge agent derives archetypes.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { latestPapers } from "../../lib/papers/scout.ts";
import { MAX_PAPER_BYTES, SCOUT_UA, scanSites } from "../../lib/papers/scan.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(process.env.MYKX_PAPERS_DIR ?? join(ROOT, "..", "mykx-papers"));
const DELAY_MS = 1_500;
const FETCH = process.argv.includes("--fetch");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const packs = readdirSync(join(ROOT, "content", "skills")).filter((d) => existsSync(join(ROOT, "content", "skills", d, "skill.json")));
  const { rows, problems } = await scanSites({ packs, delayMs: DELAY_MS });
  const latest = latestPapers(rows);

  const day = new Date().toISOString().slice(0, 10);
  mkdirSync(join(OUT, "scout"), { recursive: true });
  const downloaded: { file: string; sha256: string; source: string; bytes: number }[] = [];
  if (FETCH) {
    for (const r of rows.filter((x) => x.fetch === "auto" && x.fileUrl)) {
      const dest = join(OUT, r.site, String(r.year), `${r.title.replace(/[^\w.-]+/g, "_").slice(0, 120)}.pdf`);
      if (existsSync(dest)) continue;
      try {
        const res = await fetch(r.fileUrl!, { headers: { "user-agent": SCOUT_UA }, signal: AbortSignal.timeout(60_000) });
        const buf = Buffer.from(await res.arrayBuffer());
        await sleep(DELAY_MS);
        if (res.status !== 200) throw new Error(`status ${res.status}`);
        if (buf.length > MAX_PAPER_BYTES) throw new Error(`${(buf.length / 1e6).toFixed(1)} MB is over the 20 MB limit`);
        if (buf.subarray(0, 4).toString() !== "%PDF") throw new Error("not a PDF");
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, buf);
        downloaded.push({ file: dest, sha256: createHash("sha256").update(buf).digest("hex"), source: r.fileUrl!, bytes: buf.length });
      } catch (e) {
        problems.push(`Download failed for ${r.title} (${r.fileUrl}): ${(e as Error).message}`);
      }
    }
  }

  const report = { at: new Date().toISOString(), rights: "school paper, private reference: archetypes and statistics only (AGENTS.md rule 10)", rows, problems, downloaded };
  writeFileSync(join(OUT, "scout", `${day}.json`), JSON.stringify(report, null, 2));
  const md = [
    `# Past-paper scout, ${day}`,
    "",
    "Private reference only: never commit these papers or show them to children. Upload them in Admin → Add knowledge.",
    "",
    "## Problems",
    ...(problems.length ? problems.map((p) => `- ${p}`) : ["- None."]),
    "",
    "## Download by hand (open each page, download the PDF, then upload them together)",
    ...rows.filter((r) => r.fetch === "manual").map((r) => `- [ ] ${r.level} ${r.subject} ${r.year} ${r.type ?? ""} · ${r.school ?? ""} → ${r.pack}${r.isNew ? " (new pack)" : ""}: ${r.pageUrl}`),
    "",
    "## Downloaded by the agent",
    ...(downloaded.length ? downloaded.map((d) => `- ${d.file} (${(d.bytes / 1e6).toFixed(1)} MB)`) : [FETCH ? "- None." : "- Run with --fetch to download the auto ones."]),
    "",
    "## Skipped",
    ...rows.filter((r) => r.fetch === "skip").map((r) => `- ${r.site} ${r.level} ${r.subject} ${r.year}: ${r.reason}`),
  ].join("\n");
  writeFileSync(join(OUT, "scout", `${day}.md`), md);

  const count = (f: string) => rows.filter((r) => r.fetch === f).length;
  console.log(`Latest papers for P3, P6 and Sec 2: ${rows.length} (auto ${count("auto")}, by hand ${count("manual")}, skipped ${count("skip")}).`);
  for (const g of latest) console.log(`  ${g.key.replace("|", " ").padEnd(18)} latest ${g.year}: ${g.papers.length} papers from ${[...new Set(g.papers.map((p) => p.site))].join(", ")}`);
  if (problems.length) {
    console.log("\nProblems:");
    for (const p of problems) console.log(`  ! ${p}`);
  }
  console.log(`\nReport: ${join(OUT, "scout", `${day}.md`)}`);
}

await main();
