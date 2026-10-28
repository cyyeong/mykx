// Server only: loads one kid's rows from the store and builds the guardian's picture (lib/guardian/view.ts).
import type { AuthStore, Profile } from "../auth/store.ts";
import { toMs } from "../domain/time.ts";
import { FROG_QUEST, questSummary } from "../learn/frog-quest.ts";
import { nextStep, type NextStep } from "./next-step.ts";
import { lastDays, minutesSinceBreak, screenTimeByDay, type DayTime } from "./screen-time.ts";
import { guardianView, settingsFor, type GuardianView, type ViewInput } from "./view.ts";
import { moodFromWords } from "./words.ts";

const DAY_MS = 86_400_000;

/** What the app can offer next: the frog quest while it has open stops, the Arcade and Vibe Zone. */
async function offerFor(store: AuthStore, householdId: string, kidId: string): Promise<ViewInput["offer"]> {
  const attempts = await store.learn.attempts(householdId, kidId);
  const ids = FROG_QUEST.stops.map((s) => s.itemId);
  const summary = questSummary(ids, attempts);
  const open = summary.correct < summary.total;
  return {
    quest: open ? { title: FROG_QUEST.title, href: `/learn/${FROG_QUEST.slug}`, minutes: 9 } : null,
    reviewsDue: 0,
    arcade: true,
    vibe: true,
  };
}

/** The full picture for the parent dashboard: two weeks of rows, so the usual focus has a baseline. */
export async function loadGuardianView(store: AuthStore, householdId: string, kid: Profile, now = new Date().toISOString()): Promise<GuardianView> {
  const since = new Date(toMs(now) - 14 * DAY_MS).toISOString();
  const [beats, attempts, messages, notes, saved, seen, offer, reads] = await Promise.all([
    store.guardian.beats(householdId, kid.id, since),
    store.learn.attempts(householdId, kid.id),
    store.guardian.messages(householdId, kid.id, since),
    store.signals.focusNotes(householdId, since),
    store.guardian.settings(householdId, kid.id),
    store.guardian.seenFlags(householdId),
    offerFor(store, householdId, kid.id),
    store.notebook.reads(householdId, kid.id, since).catch(() => []),
  ]);
  return guardianView({
    nickname: kid.nickname,
    band: kid.band,
    dailyLimitMin: kid.dailyLimitMin,
    now,
    saved,
    beats,
    attempts,
    messages,
    notes: notes.filter((n) => n.kidId === kid.id),
    reads,
    seen,
    offer,
  });
}

export interface KidStatus {
  next: NextStep;
  today: DayTime;
  /** Minutes left of today's limit. */
  left: number;
  sinceBreakMin: number;
}

/** The light version for the kid's heartbeat: today's rows only. */
export async function loadKidStatus(store: AuthStore, householdId: string, kid: Profile, now = new Date().toISOString()): Promise<KidStatus> {
  const [today] = lastDays(now, 1);
  const since = new Date(Date.parse(`${today}T00:00:00+08:00`)).toISOString();
  const [beats, messages, notes, saved, offer] = await Promise.all([
    store.guardian.beats(householdId, kid.id, since),
    store.guardian.messages(householdId, kid.id, since),
    store.signals.focusNotes(householdId, new Date(toMs(now) - 15 * 60_000).toISOString()),
    store.guardian.settings(householdId, kid.id),
    offerFor(store, householdId, kid.id),
  ]);
  const settings = settingsFor(kid.band, kid.dailyLimitMin, saved);
  const day = screenTimeByDay(beats, [today], settings)[0];
  const note = notes.find((n) => n.kidId === kid.id && !n.synthetic);
  const mood = moodFromWords(messages.map((m) => m.text))?.mood ?? null;
  const sinceBreakMin = minutesSinceBreak(beats, now);
  const next = nextStep({
    nickname: kid.nickname,
    now,
    settings,
    today: day,
    sinceBreakMin,
    focusDip: Boolean(note),
    sleepy: Boolean(note && /yawn|eyes closed/.test(note.evidence)) || mood === "tired",
    mood: mood === "calm" ? null : mood,
    ...offer,
  });
  return { next, today: day, left: Math.max(0, Math.round(settings.dailyLimitMin - day.total)), sinceBreakMin };
}
