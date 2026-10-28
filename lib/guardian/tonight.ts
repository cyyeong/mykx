// Tonight (docs/prd/GUARDIAN.md §2.5, F12): the evening summary for the grown-up. Facts come from code: each kid's screen
// time and learning today against their limit, the flags nobody has marked seen, and, from Guardian, who arrived where,
// what happened at home and which notes the grown-up checked. Muse Spark (Standard) writes three or four warm sentences
// from those facts and never adds one; if it can't, `fallbackTonight` says the same facts without a model, labelled.
import { z } from "zod";
import { sha256Hex } from "../home-watch/home-watch.ts";

export interface TonightKid {
  nickname: string;
  screenMin: number;
  limitMin: number | null;
  over: boolean;
  lateMin: number;
  learnMin: number;
  sessions: number;
  /** Titles of flags not marked seen, most serious first: "Possibly tired in the evening". */
  flags: string[];
}
export interface TonightInput {
  kids: TonightKid[];
  /** Guardian's afternoon; null when there's nothing from location or cameras today. */
  home: { arrivals: string[]; stretches: string[]; notes: string[] } | null;
  /** The weekend ideas the family added to their plan. */
  plans: string[];
}

export function tonightFacts(i: TonightInput): string {
  const lines: string[] = [];
  for (const k of i.kids) {
    if (!k.screenMin && !k.sessions && !k.flags.length) continue; // nothing to say about them today
    const bits = [`${k.screenMin} min on myKx today${k.limitMin ? ` (limit ${k.limitMin})` : ""}${k.over ? ", over the limit" : ""}`];
    if (k.sessions) bits.push(`${k.sessions} learning session${k.sessions === 1 ? "" : "s"}, ${k.learnMin} min`);
    if (k.lateMin > 0) bits.push(`${k.lateMin} min in quiet hours`);
    lines.push(`${k.nickname}: ${bits.join("; ")}.${k.flags.length ? ` Not yet seen: ${k.flags.join("; ")}.` : ""}`);
  }
  if (i.home) {
    if (i.home.arrivals.length) lines.push(`Arrivals: ${i.home.arrivals.join("; ")}.`);
    if (i.home.stretches.length) lines.push(`At home: ${i.home.stretches.join("; ")}.`);
    for (const n of i.home.notes) lines.push(`Note: ${n}.`);
  }
  if (i.plans.length) lines.push(`Planned for the weekend: ${i.plans.join("; ")}.`);
  return lines.join("\n");
}

export const tonightDigest = (i: TonightInput) => sha256Hex(tonightFacts(i));
export const hasTonight = (i: TonightInput) => i.kids.some((k) => k.screenMin > 0 || k.sessions > 0 || k.flags.length > 0) || Boolean(i.home?.arrivals.length || i.home?.stretches.length || i.home?.notes.length);

export const tonightSchema = z.strictObject({ text: z.string().min(20).max(620) });

// Tonight's prompt (its editable instructions and fixed guardrails) is in lib/agents/instructions.ts ("tonight");
// the route reads the published version with instructionsFor.

/** The same facts in words without a model (rule 7). */
export function fallbackTonight(i: TonightInput): string {
  const parts: string[] = [];
  const attention = [...i.kids.flatMap((k) => k.flags.map((f) => (f.startsWith(k.nickname) ? f : `${k.nickname}: ${f}`))), ...(i.home?.notes ?? [])];
  parts.push(attention.length ? `${attention.length === 1 ? "One thing" : `${attention.length} things`} to look at: ${attention.join("; ")}.` : "Nothing needs a look tonight.");
  if (i.home?.arrivals.length) parts.push(`${i.home.arrivals.join("; ")}.`);
  const screen = i.kids.filter((k) => k.screenMin > 0).map((k) => `${k.nickname} ${k.screenMin} min${k.over ? " (over the limit)" : ""}`);
  if (screen.length) parts.push(`On myKx today: ${screen.join(", ")}.`);
  if (i.plans.length) parts.push(`This weekend: ${i.plans.join("; ")}.`);
  return parts.join(" ");
}
