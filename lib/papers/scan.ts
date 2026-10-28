// The past-paper scout's scan (skill: .agents/skills/past-paper-scout): read the admin-approved sites' listing pages,
// pick the latest papers for myKx's levels and decide for each whether the agent may download it. No files: the CLI
// (scripts/papers/scout.ts) writes a private report from it, and the weekly job (app/api/cron/papers) saves the finds
// for Admin → Add knowledge. Papers stay private reference (AGENTS.md rule 10): only their links are kept here.
import { decide, latestPapers, packFor, parseListing, parseRobots, robotsAllows, type Decision, type PaperRef, type RobotsRules, type SiteId } from "./scout.ts";

export const SCOUT_UA = "Mozilla/5.0 (compatible; myKx-paper-scout/0.1; admin-approved sites only; +https://mykx.vercel.app)";
export const MAX_PAPER_BYTES = 20 * 1024 * 1024;

export interface Site {
  id: SiteId;
  origin: string;
  pages: string[];
  terms?: string;
  fileHosts?: string[];
  manualNote?: string;
}

/** The admin-approved allowlist (founder, 28 Oct 2026) and the listing pages for myKx's levels. */
export const SITES: readonly Site[] = [
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

export type ScoutRow = PaperRef & Decision & { latestYear: number; pack: string | null; isNew: boolean };
export interface Scan {
  rows: ScoutRow[];
  problems: string[];
}

export type Getter = (url: string) => Promise<{ status: number; text: string }>;
export const webGet: Getter = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": SCOUT_UA }, redirect: "follow", signal: AbortSignal.timeout(25_000) });
  return { status: res.status, text: await res.text() };
};

/** One polite pass over every site: robots.txt first, a pause between requests, nothing downloaded. */
export async function scanSites(o: { packs: readonly string[]; get?: Getter; delayMs?: number; sites?: readonly Site[] }): Promise<Scan> {
  const get = o.get ?? webGet;
  const delay = o.delayMs ?? 1_500;
  const sites = o.sites ?? SITES;
  const problems: string[] = [];
  const sleep = () => (delay ? new Promise((r) => setTimeout(r, delay)) : Promise.resolve());
  const tryGet = async (url: string) => {
    try {
      return await get(url);
    } catch (e) {
      problems.push(`Couldn't reach ${url}: ${(e as Error).message}`);
      return null;
    }
  };
  const robotsCache = new Map<string, RobotsRules>();
  const robotsFor = async (origin: string) => {
    if (!robotsCache.has(origin)) {
      const r = await tryGet(`${origin}/robots.txt`);
      robotsCache.set(origin, parseRobots(r && r.status === 200 && !/<html/i.test(r.text) ? r.text : null));
      await sleep();
    }
    return robotsCache.get(origin)!;
  };

  const all: PaperRef[] = [];
  const siteRobots = new Map<SiteId, { page: RobotsRules; file: RobotsRules | null }>();
  for (const site of sites) {
    const page = await robotsFor(site.origin);
    const file = site.fileHosts ? await robotsFor(site.fileHosts[0]) : null;
    siteRobots.set(site.id, { page, file });
    for (const url of site.pages) {
      if (!robotsAllows(page, url)) {
        problems.push(`${site.id}: robots.txt disallows the listing ${url}; skipped.`);
        continue;
      }
      const r = await tryGet(url);
      await sleep();
      if (!r) continue;
      if (r.status !== 200) {
        problems.push(`${site.id}: ${url} answered ${r.status}.`);
        continue;
      }
      const found = parseListing(site.id, r.text, url);
      if (!found.length && !/[?&]page=\d+/.test(url)) problems.push(`${site.id}: no papers found on ${url} (the page layout may have changed).`);
      all.push(...found);
    }
  }

  const targets = all.filter((p) => p.level && TARGET_LEVELS.has(p.level));
  const latest = latestPapers(targets);
  const rows: ScoutRow[] = latest.flatMap((g) =>
    g.papers.map((p) => {
      const site = sites.find((s) => s.id === p.site)!;
      const robots = siteRobots.get(p.site)!;
      // A site whose newest paper for this level and subject is older than the latest found anywhere is stale.
      const siteNewest = Math.max(...targets.filter((t) => t.site === p.site && `${t.level}|${t.subject}` === g.key).map((t) => t.year ?? 0));
      const d = decide(p, { pageRobots: robots.page, fileRobots: robots.file, termsBlock: site.terms ?? null, stale: siteNewest < g.year }, site.manualNote);
      const pk = packFor(p.level, p.subject, o.packs);
      return { ...p, ...d, latestYear: g.year, pack: pk?.pack ?? null, isNew: pk?.isNew ?? false };
    }),
  );
  // Sites with only older papers for a level and subject: say so once.
  for (const g of latest) {
    for (const site of sites) {
      const mine = targets.filter((t) => t.site === site.id && `${t.level}|${t.subject}` === g.key);
      if (mine.length && !mine.some((t) => (t.year ?? 0) >= g.year)) {
        problems.push(`${site.id}: no latest ${g.key.replace("|", " ")} (newest free is ${Math.max(...mine.map((t) => t.year ?? 0))}; latest anywhere is ${g.year}). Skipped.`);
      }
    }
  }
  for (const site of sites) if (site.terms) problems.push(`${site.id}: its terms say ${site.terms} Listed only; nothing fetched until the site gives written permission.`);
  for (const pack of o.packs) {
    const [lvl, subject] = [pack.split("-")[0], pack.split("-").slice(1).join("-")];
    const level = lvl.startsWith("s") ? `Sec ${lvl.slice(1)}` : lvl.toUpperCase();
    if (!latest.some((g) => g.key === `${level}|${subject}`)) problems.push(`No allowlisted site has ${level} ${subject} papers (pack ${pack}). Add a source or upload papers you have.`);
  }
  return { rows, problems };
}

/** Downloads one "auto" paper for the knowledge agent: PDF only, ≤ 20 MB, and only from a host on the allowlist whose
 *  robots.txt allows it (checked again here, because the link came from a stored find). */
export async function fetchPaper(fileUrl: string, o: { get?: (url: string) => Promise<Response> } = {}): Promise<Uint8Array> {
  const url = new URL(fileUrl);
  const site = SITES.find((s) => [s.origin, ...(s.fileHosts ?? [])].some((h) => new URL(h).host === url.host));
  if (!site || url.protocol !== "https:") throw new Error("that host isn't on the approved list");
  const get = o.get ?? ((u: string) => fetch(u, { headers: { "user-agent": SCOUT_UA }, redirect: "follow", signal: AbortSignal.timeout(60_000) }));
  const robots = await get(`${url.origin}/robots.txt`).then(async (r) => (r.ok ? r.text() : null)).catch(() => null);
  if (!robotsAllows(parseRobots(robots && !/<html/i.test(robots) ? robots : null), fileUrl)) throw new Error("robots.txt disallows downloading it");
  const res = await get(fileUrl);
  if (res.status !== 200) throw new Error(`the site answered ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > MAX_PAPER_BYTES) throw new Error(`${(buf.length / 1e6).toFixed(1)} MB is over the 20 MB limit`);
  if (new TextDecoder().decode(buf.subarray(0, 4)) !== "%PDF") throw new Error("it isn't a PDF");
  return buf;
}
