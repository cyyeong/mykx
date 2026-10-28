// The Home Reader (docs/prd/GUARDIAN.md §2.2, §2.5): Muse Spark (Standard) reads one tick's changed frames, each
// with its room, into structured room readings. One call per tick for all cameras. Code then enforces rule 15 on
// whatever came back: adults are never named and get no cue, a child is named only as one of this household's
// kids, cues are visible behaviour from a fixed list. Frames go to the model and are then dropped; only the words
// are kept. Flags come from lib/home-watch/flags.ts (deterministic), never from the model's say-so alone.
import { z } from "zod";
import type { RoomReading, SeenPerson } from "./home-watch.ts";

export const ACTIVITIES = ["watching a screen", "eating or drinking", "reading or homework", "playing", "talking", "resting or sleeping", "moving around", "arguing", "physical conflict", "nobody here", "other"] as const;
export const CUES = ["smiling or laughing", "calm", "frowning", "crying", "shouting posture", "unclear"] as const;
export const HAZARDS = ["none", "child near a lit stove", "child near an open window or ledge", "fire or smoke", "child lying still on the floor"] as const;

export const readerSchema = z.strictObject({
  cameras: z
    .array(
      z.strictObject({
        camera: z.string().max(40),
        people: z
          .array(
            z.strictObject({
              who: z.enum(["child", "adult", "unknown"]),
              likely: z.string().max(30).nullable(),
              confidence: z.number().min(0).max(1),
              cue: z.enum(CUES).nullable(),
            }),
          )
          .max(8),
        activity: z.enum(ACTIVITIES),
        note: z.string().max(120),
        hazard: z.enum(HAZARDS),
        concern: z.enum(["none", "watch", "urgent"]),
        reason: z.string().max(240),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(12),
});
export type ReaderOutput = z.infer<typeof readerSchema>;

export interface ReaderKid {
  nickname: string;
  band: "junior" | "teen";
  /** The parent's own words, or null. */
  description: string | null;
}

export function readerPrompt(kids: readonly ReaderKid[]): string {
  const family = kids.length
    ? kids.map((k) => `- ${k.nickname} (${k.band === "junior" ? "primary school, about 7–10" : "about 11–16"}): ${k.description ?? "no description given"}`).join("\n")
    : "- (no descriptions given)";
  return [
    "You read still frames from a family's own home cameras in Singapore and say what is visible, for the parent, as a short safety status. You are not watching anyone over time; you see one moment per room.",
    "For each camera in the input, return one entry with its camera key.",
    "",
    "people: everyone visible, from left to right in the frame. who is child, adult or unknown.",
    "- Never name an adult. Adults get likely: null and cue: null.",
    "- Name a child only when they clearly match one of the parent's descriptions below (age, hair, clothes); put the nickname in likely with your confidence. Otherwise likely is null. Never identify anyone from their face alone.",
    "- cue is for children only: a visible behaviour from the list (smiling or laughing, calm, frowning, crying, shouting posture, unclear). Never guess inner feelings, never diagnose, never judge.",
    "activity: the main thing happening, from the list. note: what you see in at most 12 plain words.",
    "hazard: only when clearly visible in the frame; otherwise none.",
    "concern: urgent only for a hazard or someone clearly being hurt; watch for possible conflict, a child crying, or anything else a parent would want to check; otherwise none.",
    "reason: one short sentence a parent can read. Say 'possibly' when unsure. Play-fighting and games can look like conflict: say so when it might be play.",
    "confidence: 0 to 1, how sure you are of the activity and concern.",
    "",
    "The kids in this family, in the parent's words:",
    family,
  ].join("\n");
}

const NOTABLE = ["crying", "shouting posture", "frowning", "smiling or laughing"];

/** Applies rule 15 to the model's output and fills in what code owns (the room cue, the source). */
export function settleReading(out: ReaderOutput["cameras"][number], kids: readonly ReaderKid[], source: RoomReading["source"]): RoomReading {
  const names = new Map(kids.map((k) => [k.nickname.toLowerCase(), k.nickname]));
  const people: SeenPerson[] = out.people.map((p) => {
    if (p.who !== "child") return { who: p.who, likely: null, confidence: p.confidence, cue: null };
    const likely = p.likely ? (names.get(p.likely.trim().toLowerCase()) ?? null) : null;
    return { who: "child", likely: likely && p.confidence >= 0.5 ? likely : null, confidence: p.confidence, cue: p.cue };
  });
  const childCues = people.filter((p) => p.who === "child" && p.cue).map((p) => p.cue!);
  const cue = NOTABLE.find((c) => childCues.includes(c)) ?? (childCues.includes("calm") ? "calm" : null);
  return {
    people,
    activity: people.length ? out.activity : "nobody here",
    note: out.note.slice(0, 120),
    cue,
    hazard: out.hazard,
    concern: out.concern,
    reason: out.reason.slice(0, 240),
    confidence: out.confidence,
    source,
  };
}
