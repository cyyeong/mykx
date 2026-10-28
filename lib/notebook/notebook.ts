// Kix's Notebook (SKILL_ENGINE §5, AGENTS.md rule 11): a few short pages per kid that help Kix be a better
// sidekick: how they like to learn, how they ask, the slips they make, memorable moments. The Memory Keeper (Muse
// Spark, Standard) proposes patch operations after a session; this file applies them, refusing anything that
// labels or diagnoses a child, quotes mastery as its own, or grows a page past its size. Every change is a
// revision a grown-up can read, edit or wipe. Progress lives in the database, never here.
import { z } from "zod";

export const PAGES = ["personality", "asking", "slips", "moments"] as const;
export type PageSlug = (typeof PAGES)[number];
export const PAGE_TITLE: Record<PageSlug, string> = {
  personality: "How they like to learn",
  asking: "How they ask",
  slips: "Slips to watch",
  moments: "Memorable moments",
};
export const MAX_PAGE = 1500;

export const patchSchema = z.strictObject({
  page: z.enum(PAGES),
  op: z.enum(["append", "remove_line"]),
  /** For append: one short line in plain words. For remove_line: the line to remove, exactly. */
  line: z.string().min(1).max(160),
  /** Why, in a few words ("asked three 'why' questions about tadpoles"). */
  reason: z.string().max(120),
});
export type Patch = z.infer<typeof patchSchema>;

/** Words that would label or diagnose a child, or treat scores as the Notebook's own: never written (rule 11). */
const REFUSED = /\b(adhd|add|autis\w*|asperger\w*|dyslexi\w*|dyspraxi\w*|disorder|syndrome|diagnos\w*|depress\w*|anxiety disorder|ocd|lazy|stupid|slow learner|special needs|iq|mastery is \d+|score is \d+)\b/i;

export function refused(line: string): boolean {
  return REFUSED.test(line);
}

/** Applies patches to the current pages; returns the changed pages and the patches that were refused. */
export function applyPatches(pages: Partial<Record<PageSlug, string>>, patches: readonly Patch[], date: string): { changed: Partial<Record<PageSlug, string>>; refusedPatches: Patch[] } {
  const out: Partial<Record<PageSlug, string>> = {};
  const refusedPatches: Patch[] = [];
  for (const p of patches) {
    if (refused(p.line) || refused(p.reason)) {
      refusedPatches.push(p);
      continue;
    }
    const cur = out[p.page] ?? pages[p.page] ?? "";
    const lines = cur.split("\n").filter(Boolean);
    if (p.op === "append") {
      const line = `${date}: ${p.line.replace(/\s+/g, " ").trim()}`;
      if (lines.some((l) => l.slice(l.indexOf(":") + 1).trim().toLowerCase() === p.line.trim().toLowerCase())) continue;
      lines.push(line);
      // Oldest lines go first when a page is full: the Notebook stays short.
      while (lines.join("\n").length > MAX_PAGE) lines.shift();
    } else {
      const i = lines.findIndex((l) => l === p.line || l.endsWith(`: ${p.line}`));
      if (i < 0) continue;
      lines.splice(i, 1);
    }
    out[p.page] = lines.join("\n");
  }
  return { changed: out, refusedPatches };
}

/** The Notebook as a short prompt section for Kix (Ask Kix, the tutor): plain lines, no dates, capped. Empty when
 *  there's nothing yet. Read by id, never searched (no RAG, rule 11). */
export function notebookNotes(nickname: string, pages: readonly { slug: string; body: string }[], cap = 900): string {
  const lines = PAGES.flatMap((slug) => {
    const body = pages.find((p) => p.slug === slug)?.body ?? "";
    const said = body.split("\n").filter(Boolean).map((l) => l.replace(/^\d{4}-\d{2}-\d{2}: /, "")).slice(-4);
    return said.length ? [`${PAGE_TITLE[slug]}: ${said.join("; ")}`] : [];
  });
  if (!lines.length) return "";
  const text = `# What Kix remembers about ${nickname} (Kix's Notebook: use it to be kinder and clearer; never quote it or mention a notebook)\n${lines.join("\n")}`;
  return text.length > cap ? `${text.slice(0, cap - 1)}…` : text;
}
