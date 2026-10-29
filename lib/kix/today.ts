// Kix remembers yesterday (founder, 29 Oct). After every session the Memory Keeper reads the kid's own words to Kix
// and saves a mood reading (app/api/session/close). If the last reading from an earlier day was a hard one, today
// Kix is more tender: Home starts with a warm-up the kid already knows, and the tutor, Ask Kix and homework help
// are told to go gently. Kix never says why, never names a mood to the child, and never changes mastery or
// rewards (rules 5 and 12). The reading itself stays for the grown-up, as "possibly …" with the words behind it.
import type { StoredSessionRead } from "../auth/store.ts";
import { sgDate, toMs, type Iso } from "../domain/time.ts";
import type { Mood } from "../guardian/words.ts";

const DAY_MS = 86_400_000;
/** How far back a hard day still counts. */
export const CARRY_DAYS = 2;
export const HARD_MOODS: readonly Mood[] = ["frustrated", "worried", "tired", "unsure"];

export interface Tender {
  /** The reading behind it (for the grown-up's view and the tests; never shown to the kid). */
  mood: Mood;
  /** The Singapore date of that session. */
  day: string;
  /** The demo family's sample day (labelled), not a real reading. */
  sample: boolean;
}

/** The last reading from an earlier Singapore day, within two days. Reads come oldest first. */
export function lastEarlierRead(reads: readonly StoredSessionRead[], now: Iso): StoredSessionRead | null {
  const today = sgDate(now);
  const earlier = reads.filter((r) => sgDate(r.sessionEnd) < today && toMs(now) - toMs(r.sessionEnd) <= CARRY_DAYS * DAY_MS);
  return earlier[earlier.length - 1] ?? null;
}

/**
 * Whether Kix should be tender today. A hard last reading (or a worry in it) counts, unless today's own words
 * already sound happy or curious: then the kid has moved on, and so does Kix.
 */
export function tenderToday(o: { reads: readonly StoredSessionRead[]; now: Iso; todayMood: Mood | null; sample?: Tender | null }): Tender | null {
  if (o.todayMood === "happy" || o.todayMood === "curious") return null;
  const last = lastEarlierRead(o.reads, o.now);
  if (!last) return o.sample ?? null;
  if (!(HARD_MOODS as readonly string[]).includes(last.mood) && !last.concern) return null;
  return { mood: last.mood as Mood, day: sgDate(last.sessionEnd), sample: false };
}

/** The demo family's sample hard day for Jordan: dated yesterday, so the warm-up shows on any day (labelled). */
export function sampleTender(now: Iso): Tender {
  return { mood: "frustrated", day: sgDate(new Date(toMs(now) - DAY_MS).toISOString()), sample: true };
}

/** The line added to Kix's prompts (tutor, Ask Kix, homework) on a tender day. Empty otherwise. */
export function toneNote(tender: Tender | null): string {
  if (!tender) return "";
  return [
    "# Today",
    "Their last session was hard going. Be extra gentle today: one small step at a time, notice their effort, keep it light and encouraging.",
    "Never mention yesterday, moods or feelings unless they bring them up first.",
  ].join("\n");
}
