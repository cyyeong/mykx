// Jordan's synthetic week for the guardian (sample data, labelled in the UI, AGENTS.md rule 8). It tells the parent
// dashboard's story from the design board: three tired evening sessions, one day over the limit, a curious
// question. Times are relative to `now`, so the demo always shows "this week". The demo store seeds it, and
// scripts/guardian-sample-sql.ts prints the same rows for Supabase.
import type { StoredBeat, StoredKixMessage } from "../auth/store.ts";
import { BEAT_MS, type ActivityKind } from "./screen-time.ts";

const DAY_MS = 86_400_000;

/** Singapore wall time `hh:mm`, `daysAgo` days before `now`'s Singapore date, as epoch ms. */
function sgAt(now: number, daysAgo: number, hh: number, mm: number): number {
  const sg = new Date(now + 8 * 3_600_000);
  return Date.UTC(sg.getUTCFullYear(), sg.getUTCMonth(), sg.getUTCDate() - daysAgo, hh - 8, mm);
}

function run(start: number, minutes: number, kind: ActivityKind, opts: { idleEvery?: number; gapAt?: number[] } = {}): StoredBeat[] {
  const out: StoredBeat[] = [];
  let t = start;
  for (let i = 0; i < minutes * 2; i++) {
    if (opts.gapAt?.includes(i)) t += 2 * 60_000; // left the app for two minutes
    out.push({ at: new Date(Math.floor(t / BEAT_MS) * BEAT_MS).toISOString(), kind, idle: Boolean(opts.idleEvery && i % opts.idleEvery === opts.idleEvery - 1), synthetic: true });
    t += BEAT_MS;
  }
  return out;
}

export function sampleGuardianWeek(now = Date.now()): { beats: StoredBeat[]; messages: StoredKixMessage[] } {
  const beats: StoredBeat[] = [];
  const messages: StoredKixMessage[] = [];
  const say = (at: number, text: string) => messages.push({ at: new Date(at).toISOString(), text, source: "talk", distress: false, selfTalk: false, synthetic: true });

  // Afternoons: a focused 12–15 minute quest after school, plus a little Home and Treasure.
  for (const d of [6, 5, 4, 3, 2, 1]) {
    const t = sgAt(now, d, 16, 30);
    beats.push(...run(t, 12 + (d % 3), "learn"), ...run(t + 20 * 60_000, 4, "other"));
  }
  // Three evenings after 8 pm: slower, with idle spells and time away, and tired words to Kix.
  const ev1 = sgAt(now, 6, 20, 35);
  beats.push(...run(ev1, 10, "learn", { idleEvery: 6, gapAt: [8] }));
  say(ev1 + 6 * 60_000, "I'm so sleepy");
  const ev2 = sgAt(now, 4, 20, 50);
  beats.push(...run(ev2, 9, "learn", { idleEvery: 5, gapAt: [6, 12] }));
  const ev3 = sgAt(now, 1, 20, 40);
  beats.push(...run(ev3, 11, "learn", { idleEvery: 6, gapAt: [10] }));
  say(ev3 + 7 * 60_000, "so tired, can we stop soon");
  // One long Saturday-style day: over the 30-minute limit.
  beats.push(...run(sgAt(now, 3, 10, 0), 20, "learn"), ...run(sgAt(now, 3, 10, 25), 10, "other"));
  // A curious question on Talk to Kix.
  say(sgAt(now, 2, 16, 40), "why do tadpoles lose their tails?");

  const seen = new Set<string>();
  return {
    beats: beats.filter((b) => (seen.has(b.at) ? false : (seen.add(b.at), true))).filter((b) => Date.parse(b.at) < now - DAY_MS / 48),
    messages,
  };
}
