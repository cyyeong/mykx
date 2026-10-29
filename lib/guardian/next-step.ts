// What Kix suggests next (the guardian's recommendation). It keeps learning, play and making in the balance the
// parent set, watches the clock and the child's energy, and always says why. Deterministic rules in a fixed
// order; a model may later voice the line, never pick the step. Nothing here changes mastery or rewards (rule 5),
// and play is never a prize for a score: it opens on learning time, not on right answers.
import type { Iso } from "../domain/time.ts";
import type { Spark } from "../kix/interests.ts";
import type { Tender } from "../kix/today.ts";
import { inQuietHours, type DayTime, type GuardianSettings } from "./screen-time.ts";
import type { Mood } from "./words.ts";

export type StepKind = "rest" | "break" | "spark" | "review" | "learn" | "play" | "create";

export interface NextStepInput {
  nickname: string;
  now: Iso;
  settings: GuardianSettings;
  today: DayTime;
  /** Screen minutes since the last real break. */
  sinceBreakMin: number;
  /** The camera (on device) or the session's interaction says focus dipped, or the child seems sleepy. */
  focusDip: boolean;
  sleepy: boolean;
  /** Today's mood from the child's words to Kix, if any. */
  mood: Mood | null;
  /** The last session, on an earlier day, was hard going (lib/kix/today.ts): today starts gently. */
  tender?: Tender | null;
  /** Something the child loves, for when focus dips (lib/kix/interests.ts). */
  spark?: Spark | null;
  /** Reviews due now (spaced practice), and the open quest. */
  reviewsDue: number;
  quest: { title: string; href: string; minutes: number } | null;
  /** Whether the Arcade and Vibe Zone exist yet. */
  arcade: boolean;
  vibe: boolean;
}

export interface NextStep {
  kind: StepKind;
  /** Kix's line to the child: short, warm, concrete (design skill §3). */
  line: string;
  /** Why Kix suggests it, in plain words (shown under the card, and to the parent). */
  why: string;
  href: string | null;
  cta: string | null;
  minutes: number | null;
}

/** The order matters: rest and safety of the body first, then balance, then fun. */
export function nextStep(x: NextStepInput): NextStep {
  const left = Math.max(0, Math.round(x.settings.dailyLimitMin - x.today.total));
  const learned = Math.round(x.today.minutes.learn);
  const played = Math.round(x.today.minutes.play);

  if (inQuietHours(x.now, x.settings)) {
    return { kind: "rest", line: `It's late, ${x.nickname}. Kix is getting sleepy too. Let's stop here and rest.`, why: "It's past quiet hours, so Kix winds down. Sleep helps today's learning stick.", href: null, cta: null, minutes: null };
  }
  if (left <= 0) {
    return { kind: "rest", line: "That's today's screen time done. Great work! Time for a stretch, a book or some play outside.", why: `Today's ${x.settings.dailyLimitMin} minutes are used up. Your grown-up can change the limit.`, href: null, cta: null, minutes: null };
  }
  if (x.sleepy || x.sinceBreakMin >= x.settings.breakEveryMin || (x.focusDip && x.sinceBreakMin >= 8)) {
    const why = x.sleepy
      ? "You seem a little sleepy, so a short break first."
      : x.focusDip
        ? "Your focus dipped a little: a short break helps it come back."
        : `${Math.round(x.sinceBreakMin)} minutes on screen without a break.`;
    const dancer = x.spark?.interest === "Dance" || x.spark?.interest === "K-pop";
    const line = dancer
      ? "Dance break! Stand up, do eight counts of your favourite moves, then have some water. Back in two minutes?"
      : "Break time! Look out of the window, stretch up high and drink some water. Back in two minutes?";
    return { kind: "break", line, why, href: null, cta: "Start a 2-minute break", minutes: 2 };
  }
  // Focus dipped, but it's too soon for a break: Kix tries something the child loves instead.
  if (x.focusDip && x.spark) {
    return { kind: "spark", line: `Psst, ${x.nickname}! ${x.spark.line} Want a quick look, then back to it?`, why: "Your focus dipped a little, so Kix tried something you love.", href: x.spark.place.href, cta: x.spark.place.cta, minutes: 3 };
  }
  if (x.mood === "frustrated" || x.mood === "worried") {
    if (x.vibe) return { kind: "create", line: "That was tricky earlier. Let's make something fun together, then try again later.", why: "You found today's questions hard. A change of task helps, and the quest will wait.", href: "/vibe", cta: "Make something", minutes: 10 };
    if (x.quest) return { kind: "review", line: "That was tricky earlier. Let's warm up with one you already know.", why: "You found today's questions hard, so Kix starts with something familiar.", href: x.quest.href, cta: "Warm up", minutes: 3 };
  }
  if (x.tender) {
    const why = `Yesterday was hard work, so Kix starts with a warm-up.${x.tender.sample ? " (Sample day.)" : ""}`;
    if (x.quest) return { kind: "review", line: `Welcome back, ${x.nickname}! Let's start gently today, with one you already know.`, why, href: x.quest.href, cta: "Warm up", minutes: 3 };
    if (x.vibe) return { kind: "create", line: `Welcome back, ${x.nickname}! Let's ease in today and make something together.`, why, href: "/vibe", cta: "Make something", minutes: 10 };
  }
  if (x.reviewsDue > 0 && x.quest) {
    return { kind: "review", line: `${x.reviewsDue} ${x.reviewsDue === 1 ? "stop wants" : "stops want"} a quick revisit before they fade.`, why: "Practising just before you'd forget makes it stick (spaced review).", href: x.quest.href, cta: "Quick review", minutes: Math.min(left, 3 * x.reviewsDue) };
  }
  if (learned < x.settings.learnMinMin && x.quest) {
    const need = Math.max(1, x.settings.learnMinMin - learned);
    return { kind: "learn", line: `Ready for ${x.quest.title}? About ${Math.min(x.quest.minutes, left)} minutes.`, why: `${learned} of today's ${x.settings.learnMinMin} learning minutes done; about ${need} to go.`, href: x.quest.href, cta: "Start today's quest", minutes: Math.min(x.quest.minutes, left) };
  }
  if (x.arcade && played < x.settings.playMaxMin) {
    const mins = Math.min(left, x.settings.playMaxMin - played);
    return { kind: "play", line: `Lovely learning today! The Arcade is open for ${mins} minutes.`, why: `Learning time is done (${learned} min), so there's room to play.`, href: "/arcade", cta: "Open the Arcade", minutes: mins };
  }
  if (x.vibe) {
    return { kind: "create", line: "Want to make flashcards or a planner with Kix?", why: "Learning and play are balanced for today, so it's a good time to make something.", href: "/vibe", cta: "Make something", minutes: Math.min(left, 15) };
  }
  if (x.quest) {
    return { kind: "learn", line: `One more stop on ${x.quest.title}?`, why: `${left} minutes of screen time left today.`, href: x.quest.href, cta: "Keep going", minutes: Math.min(x.quest.minutes, left) };
  }
  return { kind: "rest", line: "You've done lots today. Time for something off-screen!", why: "Nothing is waiting for you right now.", href: null, cta: null, minutes: null };
}
