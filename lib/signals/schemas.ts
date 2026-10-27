// The focus camera's wire shapes, shared by the browser and /api/signals/focus. Safe to import from client
// components. Every object is strict: a body carrying anything besides the counts (a frame, an image, landmarks,
// a name) fails validation and is refused before it reaches the store (AGENTS.md rule 12).
import { z } from "zod";
import { MINUTE_MS, type Confidence, type FocusBaseline } from "./focus.ts";

const iso = z.iso.datetime({ offset: true });
const wholeMinute = iso.refine((s) => Date.parse(s) % MINUTE_MS === 0, "Start of a minute");

export const CONFIDENCES = ["low", "medium", "high"] as const satisfies readonly Confidence[];
/** At most this many minutes per call (the browser sends one a minute and keeps a few if the network drops). */
export const MAX_MINUTES_PER_POST = 10;

export const focusMinuteSchema = z.strictObject({
  minute: wholeMinute,
  awaySeconds: z.number().int().min(0).max(60),
  eyesClosedEvents: z.number().int().min(0).max(30),
  yawns: z.number().int().min(0).max(20),
  facePresentRatio: z.number().min(0).max(1),
});

/** The browser's own reading of a dip. The server checks it against the counts it holds and writes its own words. */
export const focusSignalSchema = z.strictObject({
  level: z.literal("watch"),
  evidence: z.string().max(400),
  confidence: z.enum(CONFIDENCES),
  from: wholeMinute,
  to: wholeMinute,
});

export const focusPostBody = z.strictObject({
  minutes: z.array(focusMinuteSchema).min(1).max(MAX_MINUTES_PER_POST),
  signal: focusSignalSchema.optional(),
});
export const focusDeleteBody = z.strictObject({ id: z.guid() });

/** A "possibly losing focus" note, as the grown-up sees it in Your family. */
export interface FocusNote {
  id: string;
  kidId: string;
  from: string;
  to: string;
  evidence: string;
  confidence: Confidence;
  /** Sample data for the demo family (labelled "Sample" in the UI, AGENTS.md rule 8). */
  synthetic: boolean;
}

/** POST /api/signals/focus. `baseline`: the child's usual, for the browser's next check. */
export interface FocusPostResult {
  saved: number;
  noted: boolean;
  baseline: FocusBaseline;
}

/** GET /api/signals/focus: the household's notes from the last 7 days, newest first. */
export interface FocusNotesResult {
  notes: FocusNote[];
}
