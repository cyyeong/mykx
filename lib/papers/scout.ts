// The past-paper scout (skill: .agents/skills/past-paper-scout). Pure parts only: robots.txt rules, the
// allowlisted sites' listing pages turned into paper references, the "latest" choice and each paper's download
// decision. The network script (scripts/papers/scout.ts) feeds it HTML.
//
// Rights (AGENTS.md rule 10, SKILL_ENGINE §6.5): school papers are private reference only. They are never
// committed, never served to children and never shown to other households; the knowledge agent derives
// archetypes and statistics from them. Downloads happen only where the site's robots.txt and terms allow it;
// everything else becomes a click-list for the admin, who downloads by hand and uploads.

export type Level = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "Sec 1" | "Sec 2" | "Sec 3" | "Sec 4";
export type SiteId = "sgexam" | "testpapersfree" | "sgtestpaper" | "tutorly" | "mathtutor";

export interface PaperRef {
  site: SiteId;
  title: string;
  level: Level | null;
  subject: string | null;
  year: number | null;
  /** WA1, SA2, EOY, Prelim, CA1… as the site writes it. */
  type: string | null;
  school: string | null;
  /** The page a person opens to see the paper. */
  pageUrl: string;
  /** A direct file link when the listing has one. */
  fileUrl: string | null;
}

export type Fetch = "auto" | "manual" | "skip";

export interface Decision {
  fetch: Fetch;
  /** Plain words for the admin: why auto, why manual, why skipped. */
  reason: string;
}

// --- robots.txt -------------------------------------------------------------------------------------------------

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

/** The rules for `User-agent: *` (prefix rules; `*` and `$` patterns are honoured). No robots.txt means allow all. */
export function parseRobots(text: string | null): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [] };
  if (!text) return rules;
  let applies = false;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      applies = lastWasAgent ? applies || value === "*" : value === "*";
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!applies) continue;
    if (key === "allow" && value) rules.allow.push(value);
    if (key === "disallow" && value) rules.disallow.push(value);
  }
  return rules;
}

const ruleMatches = (rule: string, path: string) => {
  const re = new RegExp(`^${rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")}`);
  return re.test(path);
};

/** Longest matching rule wins; ties go to Allow (Google's reading). */
export function robotsAllows(rules: RobotsRules, url: string): boolean {
  const u = new URL(url);
  const path = u.pathname + u.search;
  const best = (list: string[]) => Math.max(-1, ...list.filter((r) => ruleMatches(r, path)).map((r) => r.length));
  const allow = best(rules.allow);
  const disallow = best(rules.disallow);
  return disallow < 0 || allow >= disallow;
}

// --- listing pages ----------------------------------------------------------------------------------------------

const SUBJECTS: [RegExp, string][] = [
  [/higher chinese|hcl/i, "higher-chinese"],
  [/chinese/i, "chinese"],
  [/science|sci\b/i, "science"],
  [/math/i, "maths"],
  [/english|eng\b/i, "english"],
  [/tamil/i, "tamil"],
  [/malay/i, "malay"],
];
export function subjectOf(text: string): string | null {
  return SUBJECTS.find(([re]) => re.test(text))?.[1] ?? null;
}

export function levelOf(text: string): Level | null {
  const p = /\b(?:P|Primary[\s-]?)([1-6])\b/i.exec(text);
  if (p) return `P${p[1]}` as Level;
  const s = /\b(?:Sec(?:ondary)?)[\s-]?([1-4])\b/i.exec(text);
  return s ? (`Sec ${s[1]}` as Level) : null;
}

const yearOf = (text: string) => {
  const y = /\b(20[12]\d)\b/.exec(text);
  return y ? Number(y[1]) : null;
};
const TYPE = /\b(WA ?[1-3]|CA ?[12]|SA ?[12]|EOY|End Of Year Exam|Prelims?|Mid[- ]Year|MYE|Term ?[1-4]|Quiz ?\d?|Test ?\d)\b/i;
const typeOf = (text: string) => {
  const t = TYPE.exec(text)?.[1] ?? null;
  return t ? (/end of year/i.test(t) ? "EOY" : t.replace(/\s+/g, "").toUpperCase().replace("PRELIMS", "PRELIM")) : null;
};

function anchors(html: string): { href: string; text: string }[] {
  const out: { href: string; text: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    out.push({ href: m[1].replace(/&amp;|&#038;/g, "&"), text: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() });
  }
  return out;
}

const abs = (href: string, base: string) => new URL(href, base).toString();

/** Parses one listing page of an allowlisted site into paper references (duplicates removed). */
export function parseListing(site: SiteId, html: string, baseUrl: string): PaperRef[] {
  const seen = new Set<string>();
  const out: PaperRef[] = [];
  const push = (p: PaperRef) => {
    const key = p.fileUrl ?? p.pageUrl;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };
  for (const a of anchors(html)) {
    if (site === "sgexam" && /\/subject\/[a-z-]+\/20\d\d-/.test(a.href)) {
      // "2025-P3-Science-End Of Year Exam-ACS Junior.pdf"
      const title = a.text.replace(/\.pdf$/i, "") || decodeURIComponent(a.href.split("/").filter(Boolean).pop() ?? "");
      const parts = title.split("-");
      push({ site, title, level: levelOf(title), subject: subjectOf(title), year: yearOf(title), type: typeOf(title), school: parts.length >= 5 ? parts.slice(4).join("-").trim() : null, pageUrl: abs(a.href, baseUrl), fileUrl: null });
    } else if (site === "testpapersfree" && /show\.php\?testpaperid=\d+/.test(a.href) && !/^view paper/i.test(a.text)) {
      // "P3 English 2025 WA1 - ACS Junior"
      const [head, school] = a.text.split(/\s+-\s+/);
      push({ site, title: a.text, level: levelOf(head), subject: subjectOf(head), year: yearOf(head), type: typeOf(head), school: school?.trim() || null, pageUrl: abs(a.href, baseUrl), fileUrl: null });
    } else if (site === "sgtestpaper" && /pluginfile\.php.*\.pdf$/i.test(a.href)) {
      // "P3 Science CA1 2015 ACS Junior Exam Papers File"
      const title = a.text.replace(/\s*Exam Papers?\s*(File)?$/i, "").trim();
      const school = title.replace(/^.*?\b20[12]\d\b\s*/, "").trim() || null;
      push({ site, title, level: levelOf(title), subject: subjectOf(title), year: yearOf(title), type: typeOf(title), school, pageUrl: baseUrl, fileUrl: abs(a.href, baseUrl) });
    } else if (site === "tutorly" && /\/api\/exam-papers\/file\?/.test(a.href)) {
      const u = new URL(abs(a.href, baseUrl));
      const file = u.searchParams.get("paperPath") ?? "";
      const title = file.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
      const topic = u.searchParams.get("topicKey") ?? "";
      push({ site, title, level: levelOf(title) ?? levelOf(topic.replace(/-/g, " ")), subject: subjectOf(topic) ?? subjectOf(title), year: yearOf(title), type: typeOf(title), school: null, pageUrl: baseUrl, fileUrl: u.toString() });
    } else if (site === "mathtutor" && /wp-content\/uploads\/.*\.pdf$/i.test(a.href)) {
      const file = decodeURIComponent(a.href.split("/").pop() ?? "").replace(/\.pdf$/i, "");
      const title = file.replace(/[-_]+/g, " ");
      push({ site, title, level: levelOf(title), subject: "maths", year: yearOf(title) ?? yearOf(a.href), type: typeOf(title), school: /mock/i.test(title) ? "mathtutor.com.sg mock paper" : null, pageUrl: baseUrl, fileUrl: abs(a.href, baseUrl) });
    }
  }
  return out;
}

// --- latest and download decisions -----------------------------------------------------------------------------

const FULL_EXAM = /^(EOY|SA2|PRELIM)$/;

/** The latest exam year for each level and subject across all sites: the newest year with an end-of-year exam,
 *  plus anything newer (this year's WA papers). Papers older than that are left out. */
export function latestPapers(papers: readonly PaperRef[]): { key: string; year: number; papers: PaperRef[] }[] {
  const groups = new Map<string, PaperRef[]>();
  for (const p of papers) {
    if (!p.level || !p.subject || !p.year) continue;
    const key = `${p.level}|${p.subject}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const full = list.filter((p) => p.type && FULL_EXAM.test(p.type)).map((p) => p.year!);
      const year = full.length ? Math.max(...full) : Math.max(...list.map((p) => p.year!));
      return { key, year, papers: list.filter((p) => p.year! >= year).sort((a, b) => b.year! - a.year! || (a.school ?? "").localeCompare(b.school ?? "")) };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** Where a level and subject lands in the skill catalogue: an existing pack, or a proposal for a new one. */
export function packFor(level: Level | null, subject: string | null, existing: readonly string[]): { pack: string; isNew: boolean } | null {
  if (!level || !subject) return null;
  const id = `${level.startsWith("Sec") ? `s${level.slice(4)}` : level.toLowerCase()}-${subject}`;
  return { pack: id, isNew: !existing.includes(id) };
}

export interface SiteFacts {
  /** robots.txt for the page's host and for the file's host (they differ for Drive-hosted files). */
  pageRobots: RobotsRules;
  fileRobots: RobotsRules | null;
  /** The site's terms forbid reuse without written permission. */
  termsBlock: string | null;
  /** The newest free paper on this site is older than the latest found anywhere. */
  stale?: boolean;
}

/** Whether the agent may fetch a paper itself, or the admin downloads it by hand, or it's skipped. */
export function decide(p: PaperRef, facts: SiteFacts, fileHostNote?: string): Decision {
  if (facts.termsBlock) return { fetch: "skip", reason: `Site terms: ${facts.termsBlock} Ask the site for written permission first.` };
  if (facts.stale) return { fetch: "skip", reason: "No latest paper here (only older free papers; newer ones are paid)." };
  if (!robotsAllows(facts.pageRobots, p.pageUrl)) return { fetch: "skip", reason: "robots.txt disallows the paper page." };
  if (!p.fileUrl) return { fetch: "manual", reason: fileHostNote ?? "The download sits behind a page the agent may not automate; open it and download by hand." };
  if (facts.fileRobots && !robotsAllows(facts.fileRobots, p.fileUrl)) return { fetch: "manual", reason: fileHostNote ?? "robots.txt disallows automated downloads of the file; download by hand." };
  return { fetch: "auto", reason: "robots.txt allows it; the agent downloads it (private reference only)." };
}
