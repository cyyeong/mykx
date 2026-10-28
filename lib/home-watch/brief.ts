// The Guardian Brief (docs/prd/GUARDIAN.md §2.5): "Right now", one or two plain sentences for the parent, written by
// Muse Spark (Standard) from facts that code collects: each kid's place and motion, each room's latest reading, and
// the alerts nobody has checked. The model sees place names, nicknames and times, never coordinates (rule 15), and
// narrates only: flags and states come from the rules. If Muse is unavailable, `fallbackBrief` says the same facts
// without a model, and the page labels it.
import { z } from "zod";
import { MOTION_LABEL, type Motion } from "../location/location.ts";
import { sha256Hex, type Concern } from "./home-watch.ts";

export interface BriefKid {
  nickname: string;
  /** "on", "paused" (a teen paused it), or "off" (the parent turned it off). */
  sharing: "on" | "paused" | "off";
  /** The place their latest point is in, or null when they're out and about. */
  place: string | null;
  motion: Motion | null;
  minutesAgo: number | null;
  /** The newest arrived/left event today, in words: "arrived at Home 15:41". */
  lastEvent: string | null;
}
export interface BriefRoom {
  room: string;
  who: string[];
  activity: string;
  cue: string | null;
  concern: Concern;
  minutesAgo: number;
}
export interface BriefAlert {
  level: "watch" | "urgent";
  kind: string;
  room: string;
  minutesAgo: number;
}
export interface BriefInput {
  kids: BriefKid[];
  rooms: BriefRoom[];
  /** Alerts the parent hasn't checked, from the last two hours. */
  alerts: BriefAlert[];
  camerasOn: boolean;
}

/** "just now", "a few minutes ago"… coarse on purpose, so the brief only changes when something has. */
export function ago(min: number | null): string {
  if (min === null) return "no update yet";
  if (min < 2) return "just now";
  if (min < 10) return "a few minutes ago";
  if (min < 30) return `about ${Math.round(min / 5) * 5} minutes ago`;
  if (min < 90) return "about an hour ago";
  return "a while ago";
}

export function briefFacts(i: BriefInput): string {
  const lines: string[] = [];
  for (const k of i.kids) {
    if (k.sharing === "off") continue;
    if (k.sharing === "paused") lines.push(`${k.nickname}: paused location sharing (teens may pause for 30 minutes).`);
    else if (k.minutesAgo === null) lines.push(`${k.nickname}: no location yet.`);
    else lines.push(`${k.nickname}: ${k.place ? `at ${k.place}` : "out and about"}${k.motion && k.motion !== "unknown" ? `, ${MOTION_LABEL[k.motion].toLowerCase()}` : ""} (${ago(k.minutesAgo)}).${k.lastEvent ? ` Latest: ${k.lastEvent}.` : ""}`);
  }
  if (i.camerasOn) {
    for (const r of i.rooms) {
      const who = r.who.length ? r.who.join(", ") : "nobody";
      lines.push(`${r.room}: ${who} — ${r.activity}${r.cue ? `, ${r.cue}` : ""}${r.concern !== "none" ? ` (the camera reading flagged it: ${r.concern})` : ""} (${ago(r.minutesAgo)}).`);
    }
  } else lines.push("Home cameras are off right now.");
  for (const a of i.alerts) lines.push(`Unchecked ${a.level} note: ${a.kind} in the ${a.room} (${ago(a.minutesAgo)}).`);
  return lines.join("\n");
}

/** Changes only when the facts do, so the page doesn't pay for a new brief every minute. */
export const briefDigest = (i: BriefInput) => sha256Hex(briefFacts(i));

export const hasAnything = (i: BriefInput) => briefFacts(i).split("\n").some((l) => !l.endsWith("no location yet.") && l !== "Home cameras are off right now.");

export const briefSchema = z.strictObject({ text: z.string().min(10).max(360) });

// The Brief's prompt (its editable instructions and fixed guardrails) is in lib/agents/instructions.ts
// ("guardian-brief"); the route reads the published version with instructionsFor.

/** The same facts in words, without a model: used when Muse Spark is unavailable (rule 7). */
export function fallbackBrief(i: BriefInput): string {
  const parts: string[] = [];
  const urgent = i.alerts.filter((a) => a.level === "urgent");
  if (urgent.length) parts.push(`${urgent.length === 1 ? "An urgent note needs" : "Urgent notes need"} a look: ${urgent.map((a) => `${a.kind} in the ${a.room}`).join(", ")}.`);
  else if (i.alerts.length) parts.push(`${i.alerts.length === 1 ? "One note needs" : `${i.alerts.length} notes need`} a look: ${i.alerts.map((a) => `${a.kind} in the ${a.room}`).join(", ")}.`);
  const kids = i.kids.filter((k) => k.sharing === "on" && k.minutesAgo !== null).map((k) => `${k.nickname} is ${k.place ? `at ${k.place}` : (k.motion && k.motion !== "unknown" ? MOTION_LABEL[k.motion].toLowerCase() : "out")}`);
  if (kids.length) parts.push(`${kids.join(", ")}.`);
  if (i.camerasOn && i.rooms.length) {
    const busy = i.rooms.filter((r) => r.who.length);
    if (busy.length) parts.push(`${busy.map((r) => `${r.room}: ${r.who.join(" and ")} (${r.activity})`).join("; ")}.`);
  }
  return parts.join(" ") || "Nothing to report yet.";
}
