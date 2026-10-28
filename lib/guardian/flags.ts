// The parent's flags (docs/prd/PARENT_INSIGHTS.md §2): urgent, watch and info, each with what we saw, what it may
// mean and what may help. Deterministic rules over the guardian's inputs; the wording stays "possibly …" and is
// compared only with the child's own usual (rule 12). Flags never change mastery or rewards (rule 5).
import { sgDate, toMs, type Iso } from "../domain/time.ts";
import { inQuietHours, sgHour, type DayTime, type GuardianSettings } from "./screen-time.ts";
import { focusBaseline, focusReasons, sessionFocus, type GuardianSession } from "./session.ts";
import { checkWords } from "./words.ts";

export type FlagLevel = "urgent" | "watch" | "info";
export type FlagKind = "distress" | "self-talk" | "low-mood" | "tired-evenings" | "focus-low" | "over-limit" | "late-night";

export interface GuardianFlag {
  /** Stable key, so "Mark as seen" sticks across reloads. */
  id: string;
  level: FlagLevel;
  kind: FlagKind;
  title: string;
  /** What we saw: plain facts, newest first. */
  saw: string[];
  mayMean: string | null;
  mayHelp: string | null;
  /** The child's own words, for distress and self-talk only (parent-only, rule 12). */
  quote: string | null;
  /** Show Tinkle Friend and SOS. */
  helplines: boolean;
  /** Newest evidence. */
  at: Iso;
  /** Oldest evidence, for "since Wednesday". */
  since: Iso;
}

/** Something the child typed or said to Kix (never a family message, rule 12). */
export interface KixMessage {
  at: Iso;
  text: string;
}

export interface FlagInput {
  nickname: string;
  now: Iso;
  settings: GuardianSettings;
  messages: readonly KixMessage[];
  sessions: readonly GuardianSession[];
  /** The last 7 days of screen time, oldest first. */
  days: readonly DayTime[];
}

const LEVEL_ORDER: Record<FlagLevel, number> = { urgent: 0, watch: 1, info: 2 };
const DAY = 86_400_000;

const when = (at: Iso) => {
  const d = new Date(toMs(at) + 8 * 3_600_000);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.toLocaleDateString("en-SG", { weekday: "short", timeZone: "UTC" })} ${h % 12 || 12}:${m} ${h < 12 ? "am" : "pm"}`;
};
const weekday = (at: Iso) => new Date(toMs(at) + 8 * 3_600_000).toLocaleDateString("en-SG", { weekday: "short", timeZone: "UTC" });

/** An evening session: it started at 8 pm or later, or inside quiet hours. */
export function isEvening(at: Iso, s: GuardianSettings): boolean {
  return sgHour(at) >= 20 || inQuietHours(at, s);
}

export function guardianFlags(input: FlagInput): GuardianFlag[] {
  const { nickname: kid, now, settings, messages, sessions, days } = input;
  const nowMs = toMs(now);
  const recent = <T extends { at?: Iso; start?: Iso }>(xs: readonly T[], days: number) =>
    xs.filter((x) => {
      const t = toMs((x.at ?? x.start)!);
      return t <= nowMs && nowMs - t <= days * DAY;
    });
  const flags: GuardianFlag[] = [];

  // Urgent: distress or safety words, every time, even in quiet hours.
  for (const m of recent(messages, 7)) {
    if (!checkWords(m.text).distress) continue;
    flags.push({
      id: `urgent:distress:${m.at}`,
      level: "urgent",
      kind: "distress",
      title: `${kid} wrote something worrying to Kix`,
      saw: [`${when(m.at)}. Kix answered kindly and suggested talking to you.`],
      mayMean: null,
      mayHelp: `Talk with ${kid} soon, somewhere calm. If you're worried about their safety, call a helpline.`,
      quote: m.text.slice(0, 200),
      helplines: true,
      at: m.at,
      since: m.at,
    });
  }

  // Watch: negative self-talk.
  const selfTalk = recent(messages, 7).filter((m) => checkWords(m.text).selfTalk && !checkWords(m.text).distress);
  if (selfTalk.length) {
    const last = selfTalk[selfTalk.length - 1];
    flags.push({
      id: `watch:self-talk:${sgDate(last.at)}`,
      level: "watch",
      kind: "self-talk",
      title: `${kid} was hard on themself`,
      saw: selfTalk.slice(-3).reverse().map((m) => `Told Kix “${m.text.slice(0, 80)}” (${weekday(m.at)})`),
      mayMean: "possibly feeling discouraged by something tricky.",
      mayHelp: `praise the effort, not the score. A message from you may help.`,
      quote: last.text.slice(0, 200),
      helplines: false,
      at: last.at,
      since: selfTalk[0].at,
    });
  }

  const week = recent(sessions, 7);

  // Watch: frustrated or worried in two or more sessions within three days.
  const low = recent(sessions, 3).filter((s) => s.mood && (s.mood.mood === "frustrated" || s.mood.mood === "worried"));
  if (low.length >= 2) {
    const last = low[low.length - 1];
    flags.push({
      id: `watch:low-mood:${sgDate(low[0].start)}`,
      level: "watch",
      kind: "low-mood",
      title: `${kid} seemed ${last.mood!.mood} in ${low.length} sessions`,
      saw: low.slice(-3).reverse().map((s) => `${weekday(s.start)}: possibly ${s.mood!.mood}${s.mood!.evidence[0] ? ` (“${s.mood!.evidence[0]}”)` : ""}`),
      mayMean: "possibly a topic that feels too hard right now.",
      mayHelp: "Kix will ease the next session; a short chat about it may help too.",
      quote: null,
      helplines: false,
      at: last.end,
      since: low[0].start,
    });
  }

  // Watch: tired signals in three evening sessions this week.
  const tiredEvenings = week.filter((s) => isEvening(s.start, settings) && (s.cameraTired || s.mood?.mood === "tired" || sessionFocus(s) < 60));
  if (tiredEvenings.length >= 3) {
    flags.push({
      id: `watch:tired-evenings:${sgDate(tiredEvenings[0].start)}`,
      level: "watch",
      kind: "tired-evenings",
      title: `${kid} seemed tired in ${tiredEvenings.length} evening sessions`,
      saw: tiredEvenings
        .slice(-3)
        .reverse()
        .map((s) => {
          const why = [s.mood?.mood === "tired" && s.mood.evidence[0] ? `told Kix “${s.mood.evidence[0]}”` : null, s.cameraTired ? "camera: possibly sleepy (this device only)" : null, ...focusReasons(s).slice(0, 1)]
            .filter(Boolean)
            .join("; ");
          return `${weekday(s.start)} after ${sgHour(s.start) % 12 || 12} pm: ${why || "slower answers than usual"}`;
        }),
      mayMean: "possibly too close to bedtime for learning.",
      mayHelp: "try an earlier slot this week.",
      quote: null,
      helplines: false,
      at: tiredEvenings[tiredEvenings.length - 1].end,
      since: tiredEvenings[0].start,
    });
  }

  // Watch: focus well below the child's own usual for three sessions this week.
  const usual = focusBaseline(sessions, now);
  // Sessions already behind the tired-evenings flag aren't counted twice.
  const tiredIds = tiredEvenings.length >= 3 ? new Set(tiredEvenings.map((s) => s.id)) : new Set<string>();
  const lowFocus = week.filter((s) => !tiredIds.has(s.id) && sessionFocus(s) <= usual - 20);
  if (lowFocus.length >= 3) {
    flags.push({
      id: `watch:focus-low:${sgDate(lowFocus[0].start)}`,
      level: "watch",
      kind: "focus-low",
      title: `${kid}'s focus was lower than usual in ${lowFocus.length} sessions`,
      saw: lowFocus.slice(-3).reverse().map((s) => `${weekday(s.start)}: ${sessionFocus(s)} against a usual ${usual}${focusReasons(s)[0] ? ` (${focusReasons(s)[0]})` : ""}`),
      mayMean: "possibly distracted, or the sessions run long.",
      mayHelp: "shorter sessions with a break; Kix already suggests one.",
      quote: null,
      helplines: false,
      at: lowFocus[lowFocus.length - 1].end,
      since: lowFocus[0].start,
    });
  }

  // Info: over the daily limit, and late-night use.
  for (const d of days) {
    if (d.overLimit) {
      flags.push({
        id: `info:over-limit:${d.day}`,
        level: "info",
        kind: "over-limit",
        title: `Over the daily limit on ${weekday(`${d.day}T04:00:00Z`)} · ${Math.round(d.total)} min`,
        saw: [`${Math.round(d.total)} min against a ${settings.dailyLimitMin} min limit`],
        mayMean: null,
        mayHelp: null,
        quote: null,
        helplines: false,
        at: `${d.day}T15:59:00Z`,
        since: `${d.day}T15:59:00Z`,
      });
    }
  }
  const late = days.filter((d) => d.lateMinutes >= 5);
  if (late.length) {
    const total = Math.round(late.reduce((n, d) => n + d.lateMinutes, 0));
    flags.push({
      id: `info:late-night:${late[late.length - 1].day}`,
      level: "info",
      kind: "late-night",
      title: `Used myKx in quiet hours on ${late.length} ${late.length === 1 ? "day" : "days"} · ${total} min`,
      saw: late.map((d) => `${weekday(`${d.day}T04:00:00Z`)}: ${Math.round(d.lateMinutes)} min after ${settings.quietFromHour % 12 || 12} pm`),
      mayMean: null,
      mayHelp: "Kix winds down in quiet hours; you can change them in Your family.",
      quote: null,
      helplines: false,
      at: `${late[late.length - 1].day}T15:59:00Z`,
      since: `${late[0].day}T00:00:00Z`,
    });
  }

  return flags.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || toMs(b.at) - toMs(a.at));
}
