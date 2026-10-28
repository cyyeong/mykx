// What the weekly past-paper scout keeps (supabase/migrations/20261030_paper_scout.sql): each paper's link and
// download decision, and a line per run. Never the paper itself (rule 10). Pure.
import type { Fetch, Level, SiteId } from "./scout.ts";
import type { ScoutRow } from "./scan.ts";

export type FindStatus = "new" | "seen" | "dismissed" | "read";

export interface PaperFind {
  id: string;
  site: SiteId;
  title: string;
  level: Level | null;
  subject: string | null;
  year: number | null;
  type: string | null;
  school: string | null;
  pageUrl: string;
  fileUrl: string | null;
  fetch: Fetch;
  reason: string;
  pack: string | null;
  packIsNew: boolean;
  status: FindStatus;
  /** The knowledge upload made when an admin had the agent read it. */
  uploadId: string | null;
  firstSeen: string;
  lastSeen: string;
}

export interface ScoutRun {
  id: string;
  at: string;
  trigger: "weekly" | "admin";
  found: number;
  /** Papers not seen in any earlier run. */
  fresh: number;
  auto: number;
  manual: number;
  skip: number;
  problems: string[];
}

/** One page can list several papers (mathtutor), so a find is keyed by its file link when it has one. */
export const findKey = (f: { site: string; pageUrl: string; fileUrl: string | null }) => `${f.site} ${f.fileUrl ?? f.pageUrl}`.slice(0, 650);

/** A scan row as stored: the fields the scout owns (status, first seen and the upload stay the admin's). */
export function findFields(r: ScoutRow) {
  return {
    site: r.site,
    title: r.title.slice(0, 300),
    level: r.level,
    subject: r.subject,
    year: r.year,
    type: r.type,
    school: r.school?.slice(0, 120) ?? null,
    pageUrl: r.pageUrl.slice(0, 600),
    fileUrl: r.fileUrl?.slice(0, 600) ?? null,
    fetch: r.fetch,
    reason: r.reason.slice(0, 400),
    pack: r.pack,
    packIsNew: r.isNew,
  };
}

export function runCounts(rows: readonly ScoutRow[]) {
  const n = (f: Fetch) => rows.filter((r) => r.fetch === f).length;
  return { found: rows.length, auto: n("auto"), manual: n("manual"), skip: n("skip") };
}
