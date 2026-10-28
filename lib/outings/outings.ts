// Do something together (docs/prd/GUARDIAN.md §2.6): ideas for the family to do this weekend near their home area, from
// two steps so child data never reaches the web. The Scout (Muse Spark with web search) is told only the home area, the
// radius, the interests and the dates. The Planner (Muse Spark, no web) then fits the Scout's sourced results to the
// family's week and the weather. Code drops any idea whose source the Scout didn't actually cite (rule: no invented
// places). Pure: no network here. Both prompts' instructions are editable in Under the hood; their guardrails are
// fixed (lib/agents/instructions.ts).
import { z } from "zod";
import { compose, type Vars } from "../agents/instructions.ts";

export interface OutingIdea {
  id: string;
  /** The date it's for, "2026-10-31". */
  day: string;
  when: string;
  /** One of the family's interests, or "Other". */
  tag: string;
  title: string;
  where: string;
  facts: string;
  why: string;
  sourceUrl: string;
  sourceHost: string;
}

export interface OutingRun {
  at: string;
  area: string;
  radiusKm: number;
  interests: string[];
  dates: string[];
  weather: string[];
  summary: string;
  ideas: OutingIdea[];
  searches: number;
  /** "live" from a search just now, "cached" from an earlier search, "sample" for the demo's stand-in (rule 7). */
  source: "live" | "cached" | "sample";
  /** Idea ids the parent added to the family's plan. */
  planned: string[];
  /** When each live refresh ran (the last two days), for the daily limit. */
  refreshes: string[];
}

export const MAX_REFRESHES_PER_DAY = 3;

const DAY = 86_400_000;
const sgDate = (ms: number) => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);

/** The coming Saturday and Sunday in Singapore (today and tomorrow if it's already the weekend). */
export function outingDates(now: Date): string[] {
  const sgNow = now.getTime() + 8 * 3_600_000;
  const dow = new Date(sgNow).getUTCDay();
  if (dow === 6) return [sgDate(now.getTime()), sgDate(now.getTime() + DAY)];
  if (dow === 0) return [sgDate(now.getTime())];
  const toSat = 6 - dow;
  return [sgDate(now.getTime() + toSat * DAY), sgDate(now.getTime() + (toSat + 1) * DAY)];
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Saturday" for "2026-10-31": by hand, so it reads the same on every machine. */
export const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
/** "Saturday 31 Oct". */
export const dayName = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

type ScoutAsk = { area: string; radiusKm: number; interests: readonly string[]; dates: readonly string[] };

/** What the Scout may be told: the area, how far, what the family likes and the dates. Never a name, an age or a place a kid is. */
export const scoutVars = (o: ScoutAsk): Vars => ({ area: o.area, radiusKm: o.radiusKm, interests: o.interests.join(", "), dates: o.dates.map(dayName).join(" and ") });

/** The Scout's whole prompt: its instructions (`head`: the published version, run.ts passes it) and guardrails. */
export function scoutPrompt(o: ScoutAsk, head = compose("outing-scout", scoutVars(o))): string {
  return head;
}

export const plannerSchema = z.strictObject({
  summary: z.string().min(10).max(340),
  ideas: z
    .array(
      z.strictObject({
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        when: z.string().min(2).max(24),
        tag: z.string().min(2).max(24),
        title: z.string().min(4).max(70),
        where: z.string().min(4).max(110),
        facts: z.string().min(4).max(170),
        why: z.string().min(4).max(180),
        source: z.string().url().max(300),
      }),
    )
    .min(1)
    .max(7),
});
export type PlannerOutput = z.infer<typeof plannerSchema>;

// The Planner's prompt (its editable instructions and fixed guardrails) is in lib/agents/instructions.ts
// ("outing-planner"); run.ts reads the published version with instructionsFor.

const norm = (u: string) => {
  try {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, "")}${x.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return "";
  }
};

/** Keeps only ideas for a date asked about whose source the Scout really cited; ids are stable for the same idea. */
export function settleIdeas(out: PlannerOutput, citations: readonly string[], dates: readonly string[], interests: readonly string[]): OutingIdea[] {
  const cited = new Set(citations.map(norm).filter(Boolean));
  const known = new Map(interests.map((i) => [i.toLowerCase(), i]));
  const seen = new Set<string>();
  const ideas: OutingIdea[] = [];
  for (const i of out.ideas) {
    const key = norm(i.source);
    if (!dates.includes(i.day) || !key || !cited.has(key)) continue;
    const id = `${i.day}-${key}`.replace(/[^a-z0-9]+/g, "-").slice(0, 80);
    if (seen.has(id)) continue;
    seen.add(id);
    const tag = known.get(i.tag.toLowerCase()) ?? "Other";
    ideas.push({ id, day: i.day, when: i.when, tag: tag.charAt(0).toUpperCase() + tag.slice(1), title: i.title, where: i.where, facts: i.facts, why: i.why, sourceUrl: i.source, sourceHost: new URL(i.source).hostname.replace(/^www\./, "") });
  }
  return sortIdeas(ideas);
}

/** Refreshes left today (Singapore time), counting runs since midnight. */
export function refreshesLeft(refreshes: readonly string[], now: Date): number {
  const today = sgDate(now.getTime());
  return Math.max(0, MAX_REFRESHES_PER_DAY - refreshes.filter((r) => sgDate(Date.parse(r)) === today).length);
}

/** The text a parent sends the kids for one idea: short, warm, and an invitation. */
export function inviteText(i: Pick<OutingIdea, "day" | "when" | "title" | "where">): string {
  return `${weekdayOf(i.day)} ${i.when}: ${i.title} at ${i.where}. Want to come?`.slice(0, 300);
}

/** The start of a time range as minutes after midnight: "9:00–11:00", "15:30", "8am", "Sat 3-5pm" (3 inherits the pm), "12-1:30pm". 0 if there's none. */
export function startMinutes(when: string): number {
  const tokens = [...when.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi)];
  if (!tokens.length) return 0;
  const [first, second] = tokens;
  let h = Number(first[1]);
  const m = Number(first[2] ?? 0);
  const suffix = (first[3] ?? (second && Number(second[1]) !== 0 ? second[3] : undefined))?.toLowerCase();
  if (suffix === "pm" && h < 12 && !(second && !first[3] && h > Number(second[1]) && second[3]?.toLowerCase() === "pm")) h += 12;
  if (suffix === "am" && h === 12) h = 0;
  return h * 60 + m;
}

/** Earliest first within each day. */
export const sortIdeas = (ideas: readonly OutingIdea[]): OutingIdea[] => [...ideas].sort((a, b) => a.day.localeCompare(b.day) || startMinutes(a.when) - startMinutes(b.when));
