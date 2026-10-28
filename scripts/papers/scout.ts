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
import { decide, latestPapers, packFor, parseListing, parseRobots, robotsAllows, type PaperRef, type RobotsRules, type SiteId } from "../../lib/papers/scout.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(process.env.MYKX_PAPERS_DIR ?? join(ROOT, "..", "mykx-papers"));
const UA = "Mozilla/5.0 (compatible; myKx-paper-scout/0.1; admin-approved sites only; +https://mykx.vercel.app)";
const DELAY_MS = 1_500;
const MAX_BYTES = 20 * 1024 * 1024;
const FETCH = process.argv.includes("--fetch");

/** The admin-approved allowlist (founder, 28 Oct 2026) and the listing pages for myKx's levels. */
const SITES: { id: SiteId; origin: string; pages: string[]; terms?: string; fileHosts?: string[]; manualNote?: string }[] = [
  {
    id: "sgexam",
    origin: "https://sgexam.com",
    pages: ["primary-3-science", "primary-3-maths", "primary-3-english", "primary-3-chinese", "primary-6-science", "primary-6-maths", "primary-6-english"].map((p) => `https://sgexam.com/${p}/`),
    fileHosts: ["https://drive.google.com", "https://drive.usercontent.google.com"],
    manualNote: "sgexam serves its PDFs from Google Drive, whose robots.txt disallows automated downloads. Open the page and download by hand.",
  },
  {
    id: "testpapersfree",
    origin: "https://testpapersfree.com",
    // Newest first, 25 a page: the first six pages of each listing cover the latest year.
    pages: ["https://testpapersfree.com/p3/", "https://testpapersfree.com/p6/", "https://testpapersfree.com/secondary/2025/"].flatMap((u) => [u, ...[2, 3, 4, 5, 6].map((n) => `${u}?page=${n}`)]),
    manualNote: "testpapersfree's robots.txt disallows /paper-file.php, its download link. Open the page and download by hand.",
  },
  { id: "sgtestpaper", origin: "https://www.sgtestpaper.com", pages: ["https://www.sgtestpaper.com/p3/", "https://www.sgtestpaper.com/p6/"] },
  {
    id: "tutorly",
    origin: "https://www.tutorly.sg",
    pages: ["https://www.tutorly.sg/app/exam-papers"],
    terms: "“Users may not reproduce, distribute, or share content outside of personal educational use without written permission.”",
  },
  { id: "mathtutor", origin: "https://mathtutor.com.sg", pages: ["https://mathtutor.com.sg/secondary-2-math-exam-papers/"] },
];

const TARGET_LEVELS = new Set(["P3", "P6", "Sec 2"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const problems: string[] = [];

async function get(url: string): Promise<{ status: number; text: string } | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(25_000) });
    return { status: res.status, text: await res.text() };
  } catch (e) {
    problems.push(`Couldn't reach ${url}: ${(e as Error).message}`);
    return null;
  }
}

const robotsCache = new Map<string, RobotsRules>();
async function robotsFor(origin: string): Promise<RobotsRules> {
  if (!robotsCache.has(origin)) {
    const r = await get(`${origin}/robots.txt`);
    robotsCache.set(origin, parseRobots(r && r.status === 200 && !/<html/i.test(r.text) ? r.text : null));
    await sleep(DELAY_MS);
  }
  return robotsCache.get(origin)!;
}

async function main() {
  const packs = readdirSync(join(ROOT, "content", "skills")).filter((d) => existsSync(join(ROOT, "content", "skills", d, "skill.json")));
  const all: (PaperRef & { siteName: SiteId })[] = [];
  const siteRobots = new Map<SiteId, { page: RobotsRules; file: RobotsRules | null }>();
  for (const site of SITES) {
    const page = await robotsFor(site.origin);
    const file = site.fileHosts ? await robotsFor(site.fileHosts[0]) : null;
    siteRobots.set(site.id, { page, file });
    for (const url of site.pages) {
      if (!robotsAllows(page, url)) {
        problems.push(`${site.id}: robots.txt disallows the listing ${url}; skipped.`);
        continue;
      }
      const r = await get(url);
      await sleep(DELAY_MS);
      if (!r) continue;
      if (r.status !== 200) {
        problems.push(`${site.id}: ${url} answered ${r.status}.`);
        continue;
      }
      const found = parseListing(site.id, r.text, url);
      const isMorePage = /[?&]page=\d+/.test(url);
      if (!found.length && !isMorePage) problems.push(`${site.id}: no papers found on ${url} (the page layout may have changed).`);
      all.push(...found.map((p) => ({ ...p, siteName: site.id })));
    }
  }

  const targets = all.filter((p) => p.level && TARGET_LEVELS.has(p.level));
  const latest = latestPapers(targets);
  const rows = latest.flatMap((g) => {
    return g.papers.map((p) => {
      const site = SITES.find((s) => s.id === p.site)!;
      const robots = siteRobots.get(p.site)!;
      // A site whose newest paper for this level and subject is older than the latest found anywhere is stale.
      const siteNewest = Math.max(...targets.filter((t) => t.site === p.site && `${t.level}|${t.subject}` === g.key).map((t) => t.year ?? 0));
      const d = decide(p, { pageRobots: robots.page, fileRobots: robots.file, termsBlock: site.terms ?? null, stale: siteNewest < g.year }, site.manualNote);
      return { ...p, latestYear: g.year, ...packFor(p.level, p.subject, packs), ...d };
    });
  });
  // Sites with only older papers for a level and subject: say so once.
  for (const g of latest) {
    for (const site of SITES) {
      const mine = targets.filter((t) => t.site === site.id && `${t.level}|${t.subject}` === g.key);
      if (mine.length && !mine.some((t) => (t.year ?? 0) >= g.year)) {
        problems.push(`${site.id}: no latest ${g.key.replace("|", " ")} (newest free is ${Math.max(...mine.map((t) => t.year ?? 0))}; latest anywhere is ${g.year}). Skipped.`);
      }
    }
  }

  for (const site of SITES) if (site.terms) problems.push(`${site.id}: its terms say ${site.terms} Listed only; nothing fetched until the site gives written permission.`);
  for (const pack of packs) {
    const [lvl, subject] = [pack.split("-")[0], pack.split("-").slice(1).join("-")];
    const level = lvl.startsWith("s") ? `Sec ${lvl.slice(1)}` : lvl.toUpperCase();
    if (!latest.some((g) => g.key === `${level}|${subject}`)) problems.push(`No allowlisted site has ${level} ${subject} papers (pack ${pack}). Add a source or upload papers you have.`);
  }

  const day = new Date().toISOString().slice(0, 10);
  mkdirSync(join(OUT, "scout"), { recursive: true });
  const downloaded: { file: string; sha256: string; source: string; bytes: number }[] = [];
  if (FETCH) {
    for (const r of rows.filter((x) => x.fetch === "auto" && x.fileUrl)) {
      const dest = join(OUT, r.site, String(r.year), `${r.title.replace(/[^\w.-]+/g, "_").slice(0, 120)}.pdf`);
      if (existsSync(dest)) continue;
      try {
        const res = await fetch(r.fileUrl!, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000) });
        const buf = Buffer.from(await res.arrayBuffer());
        await sleep(DELAY_MS);
        if (res.status !== 200) throw new Error(`status ${res.status}`);
        if (buf.length > MAX_BYTES) throw new Error(`${(buf.length / 1e6).toFixed(1)} MB is over the 20 MB limit`);
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
