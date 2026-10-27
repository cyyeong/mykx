// Soak test B: synthetic learners practise every pack for 30 days through the real engine
// (lib/domain: selection → marking → mastery → rewards → companion → squadron).
//   node scripts/soak/simulate.ts [seed] [replicates]
// Offline and deterministic: a seeded RNG drives the learners; the engine itself has no randomness.
// Writes scripts/soak/out/simulate.json and scripts/soak/out/simulate.md.
import {
  type AttemptEvent,
  type LedgerEntry,
  type MasteryState,
  type PracticeItem,
  type Tuning,
  DAILY_CAP,
  WINDOW,
  awardsFor,
  clamp,
  companion,
  familyContributions,
  freshSuccesses,
  milestonesFrom,
  pointsOnDay,
  questionOf,
  recompute,
  selectNext,
  sgDate,
  squadron,
  subskillKey,
  totalPoints,
} from "../../lib/domain/index.ts";
import { markItem } from "../../lib/domain/marking.ts";
import { type Pack, loadPacks, table, writeOut } from "./bank.ts";
import { type Rng, rng } from "./rng.ts";

const SEED = Number(process.argv[2] ?? 20261104);
const REPLICATES = Number(process.argv[3] ?? 12);
const DAYS = 30;
const DAY0 = Date.parse("2026-10-05T00:00:00+08:00"); // a Monday, Singapore time
const SESSION_HOURS = [16.5, 19.5];
const H = 3_600_000;
const DAY = 24 * H;

// ─── Learners ───────────────────────────────────────────────────────────────

interface Profile {
  name: string;
  ability: (sub: string, day: number) => number;
  hint: number; // propensity to open hints when struggling
  reveal: number; // propensity to reveal the answer when struggling
  retry: number; // chance of retrying a wrong answer
  explain: number; // chance of giving an explanation
  guesser?: boolean;
  /** Days with practice (default: every day). */
  activeDays?: (day: number) => boolean;
}

function profiles(weakSub: string, strongSub: string): Profile[] {
  return [
    { name: "strong", ability: () => 0.85, hint: 0.2, reveal: 0.02, retry: 0.5, explain: 0.8 },
    { name: "weak", ability: () => 0.3, hint: 0.5, reveal: 0.1, retry: 0.4, explain: 0.5 },
    { name: "uneven", ability: (s) => (s === weakSub ? 0.2 : s === strongSub ? 0.92 : 0.6), hint: 0.4, reveal: 0.05, retry: 0.4, explain: 0.6 },
    { name: "improving", ability: (_, d) => 0.25 + (0.6 * d) / (DAYS - 1), hint: 0.4, reveal: 0.05, retry: 0.5, explain: 0.6 },
    { name: "hint-heavy", ability: () => 0.5, hint: 0.95, reveal: 0.15, retry: 0.3, explain: 0.4 },
    { name: "guesser", ability: () => 0, hint: 0, reveal: 0.02, retry: 0.1, explain: 0.1, guesser: true },
    // Cold start and sparse: three days, a 16-day break, then three more days.
    { name: "cold-start", ability: () => 0.55, hint: 0.4, reveal: 0.05, retry: 0.4, explain: 0.6, activeDays: (d) => d < 3 || (d >= 19 && d < 22) },
  ];
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const itemB = (d: number) => 0.15 + 0.175 * (d - 1);

/** Chance of a correct, unaided answer. */
function pCorrect(p: Profile, item: PracticeItem & { options?: string[] }, sub: string, day: number): number {
  const n = item.type === "mcq" ? (item.options?.length ?? 4) : 0;
  if (p.guesser) return n ? 1 / n : 0.05;
  const indep = sigmoid(8 * (p.ability(sub, day) - itemB(item.difficulty)));
  return n ? 1 / n + (1 - 1 / n) * indep : indep;
}

// ─── One run ────────────────────────────────────────────────────────────────

type SimItem = PracticeItem & { options?: string[]; answer: number | string; accept?: string[]; tolerance?: number; unit?: string };

interface RunConfig {
  pack: Pack;
  profile: Profile;
  rep: number;
  assessment?: { day: number; topics: string[] };
  /** Count picks in these topics before this day (with or without a test). */
  measureScope?: { day: number; topics: string[] };
  maxPerSubskill?: number;
  tuning?: Tuning;
  label?: string;
  weakSub?: string;
}

const ALPHAS = [0.3, 0.4, 0.5] as const;

/** The §6 fold with another learning rate (what-if only; the engine keeps α = 0.3). */
function foldWith(alpha: number, evs: AttemptEvent[]): number | null {
  const window = familyContributions(evs).slice(-WINDOW);
  if (!window.length) return null;
  let m = 0.5;
  for (const c of window) {
    let q = clamp(c.marks / c.maxMarks - 0.2 * Math.min(c.hints, 2), 0, 1);
    if (c.hints > 0) q = Math.min(q, m);
    m = (1 - alpha) * m + alpha * q;
  }
  return m;
}

interface DaySample {
  day: number;
  mae: number | null; // mean |m − τ| over subskills with evidence
  bias: number | null;
  maeAlpha: (number | null)[]; // what-if MAE for each of ALPHAS
  weakErr: number | null; // |m − τ| on the uneven learner's weak subskill
  developing: number; // subskills at "developing"
  withEvidence: number;
}

interface RunResult {
  pack: string;
  profile: string;
  rep: number;
  label: string;
  assessment: boolean;
  sessions: number;
  picks: number;
  freshPicks: number;
  probePicks: number;
  reviewPicks: number;
  shortSessions: number; // fewer than 3 picks
  emptySessions: number;
  exhaustedDay: number | null;
  firstReviewDay: number | null;
  firstDevelopingDay: number | null;
  topicDevelopingDay: number | null; // what-if: mastery per topic instead of per subskill
  samples: DaySample[];
  pickSubskills: Record<string, number>;
  pickSubskillsWeek1: Record<string, number>;
  picksWeek1: number;
  inScopeBeforeTest: number;
  picksBeforeTest: number;
  distinctSubskillsPerSession: number;
  violations: {
    sevenDay: number;
    crossCourse: number;
    dupFamilyInSession: number;
    assistedStep: number;
    nan: number;
    capExceeded: number;
    dupKeys: number;
    refreshAwards: number;
    crashes: string[];
  };
  assistedRises: { windowSlide: number; other: number; max: number };
  ledger: { total: number; maxDay: number; daysAtCap: number; cappedEntries: number; byRule: Record<string, number>; activeDays: number };
  companionDays: (number | null)[]; // day each stage 1–3 was reached
  jets: number;
  freshSuccesses: number;
}

function run(cfg: RunConfig): RunResult {
  const { pack, profile } = cfg;
  const r: Rng = rng(`${SEED}|${pack.id}|${profile.name}|${cfg.rep}|${cfg.assessment ? "test" : "base"}|${cfg.maxPerSubskill ?? 2}`);
  const items: SimItem[] = pack.items.map((i) => ({ ...i }));
  const served = items.filter((i) => i.status === "reviewed" && (i.type === "mcq" || i.type === "short"));
  const bySubItems = new Map<string, SimItem[]>();
  for (const i of served) bySubItems.set(subskillKey(i), [...(bySubItems.get(subskillKey(i)) ?? []), i]);

  const attempts: AttemptEvent[] = [];
  const bySub = new Map<string, AttemptEvent[]>();
  const familyLast = new Map<string, number>();
  let ledger: LedgerEntry[] = [];
  const res: RunResult = {
    pack: pack.id,
    profile: profile.name,
    rep: cfg.rep,
    label: cfg.label ?? "PRD default",
    assessment: !!cfg.assessment,
    sessions: 0,
    picks: 0,
    freshPicks: 0,
    probePicks: 0,
    reviewPicks: 0,
    shortSessions: 0,
    emptySessions: 0,
    exhaustedDay: null,
    firstReviewDay: null,
    firstDevelopingDay: null,
    topicDevelopingDay: null,
    samples: [],
    pickSubskills: {},
    pickSubskillsWeek1: {},
    picksWeek1: 0,
    inScopeBeforeTest: 0,
    picksBeforeTest: 0,
    distinctSubskillsPerSession: 0,
    violations: { sevenDay: 0, crossCourse: 0, dupFamilyInSession: 0, assistedStep: 0, nan: 0, capExceeded: 0, dupKeys: 0, refreshAwards: 0, crashes: [] },
    assistedRises: { windowSlide: 0, other: 0, max: 0 },
    ledger: { total: 0, maxDay: 0, daysAtCap: 0, cappedEntries: 0, byRule: {}, activeDays: 0 },
    companionDays: [null, null, null],
    jets: 0,
    freshSuccesses: 0,
  };
  const masteryMap = (now: number): Record<string, MasteryState> => {
    const out: Record<string, MasteryState> = {};
    for (const [k, evs] of bySub) out[k] = recompute(evs, now);
    return out;
  };
  let distinctSum = 0;
  let n = 0;

  try {
    for (let day = 0; day < DAYS; day++) {
      const active = profile.activeDays ? profile.activeDays(day) : true;
      const sessions = active ? (r.chance(0.5) ? 2 : 1) : 0;
      for (let s = 0; s < sessions; s++) {
        const now = DAY0 + day * DAY + SESSION_HOURS[s] * H;
        const nowIso = new Date(now).toISOString();
        const mastery = masteryMap(now);
        const assessment = cfg.assessment && day < cfg.assessment.day ? { date: new Date(DAY0 + cfg.assessment.day * DAY + 9 * H).toISOString(), topics: cfg.assessment.topics } : undefined;
        const sel = selectNext({
          course: pack.id,
          items,
          mastery,
          history: attempts,
          now: nowIso,
          seed: `${profile.name}|${sgDate(now)}|${s}`,
          assessment,
          maxPerSubskill: cfg.maxPerSubskill,
          tuning: cfg.tuning,
        });
        res.sessions++;
        if (sel.exhausted && res.exhaustedDay === null) res.exhaustedDay = day;
        if (sel.picks.length === 0) res.emptySessions++;
        if (sel.picks.length < 3) res.shortSessions++;
        const fams = new Set<string>();
        const subs = new Set<string>();
        sel.picks.forEach((pick, pickIndex) => {
          res.picks++;
          if (pick.kind === "review") {
            res.reviewPicks++;
            if (res.firstReviewDay === null) res.firstReviewDay = day;
          } else res.freshPicks++;
          if (pick.kind === "probe") res.probePicks++;
          if (!Number.isFinite(pick.priority) || Object.values(pick.factors).some((f) => !Number.isFinite(f) || f < 0 || f > 1)) res.violations.nan++;
          if (pick.items.some((i) => i.skill !== pack.id)) res.violations.crossCourse++;
          if (fams.has(pick.family)) res.violations.dupFamilyInSession++;
          fams.add(pick.family);
          subs.add(pick.subskill);
          const last = familyLast.get(pick.family);
          if (last !== undefined && now - last < 7 * DAY) res.violations.sevenDay++;
          res.pickSubskills[pick.subskill] = (res.pickSubskills[pick.subskill] ?? 0) + 1;
          if (day < 7) {
            res.picksWeek1++;
            res.pickSubskillsWeek1[pick.subskill] = (res.pickSubskillsWeek1[pick.subskill] ?? 0) + 1;
          }
          if (cfg.measureScope && day < cfg.measureScope.day) {
            res.picksBeforeTest++;
            if (cfg.measureScope.topics.includes(pick.items[0].topic)) res.inScopeBeforeTest++;
          }
          // Answer every part, then check the question as a unit: an assisted fresh question must
          // not raise its subskill's displayed m (it may only via the 10-family window sliding).
          const keys = [...new Set(pick.items.map((i) => subskillKey(i)))];
          const before = new Map(keys.map((k) => [k, bySub.get(k)?.length ? recompute(bySub.get(k) as AttemptEvent[], now) : null]));
          const firstHints = new Map<string, number>();
          pick.items.forEach((pi, k) => {
            const item = pi as SimItem;
            const t = now + (pickIndex * 6 + k) * 60_000;
            const h = answer(item, t, day);
            firstHints.set(subskillKey(item), Math.max(firstHints.get(subskillKey(item)) ?? 0, h));
          });
          if (pick.kind !== "review") {
            for (const k of keys) {
              const b = before.get(k);
              if (!b || b.m === null || (firstHints.get(k) ?? 0) === 0) continue;
              const after = recompute(bySub.get(k) as AttemptEvent[], now + DAY / 4).m as number;
              if (after > b.m + 1e-12) {
                if (b.families >= WINDOW) res.assistedRises.windowSlide++;
                else res.assistedRises.other++;
                res.assistedRises.max = Math.max(res.assistedRises.max, after - b.m);
              }
            }
          }
        });
        distinctSum += subs.size;
        n++;
      }
      // End of day: creations, companion, squadron, samples.
      if (active && day % 5 === 4) award({ type: "creation_saved", creationId: `c-${day}`, at: new Date(DAY0 + day * DAY + 20.5 * H).toISOString() });
      const endOfDay = DAY0 + day * DAY + 23 * H;
      const endIso = new Date(endOfDay).toISOString();
      const mastery = masteryMap(endOfDay);
      const comp = companion({ species: "frog", ledger, milestones: milestonesFrom(attempts, Object.values(mastery)), now: endIso });
      for (const g of comp.grants) {
        const stage = Number(g.key.split(":")[2]);
        res.companionDays[stage - 1] = day;
      }
      ledger = [...ledger, ...comp.grants];
      const sq = squadron({ successes: freshSuccesses(attempts), ledger, now: endIso });
      ledger = [...ledger, ...sq.grants];
      res.jets = sq.unlocked.length;

      let absSum = 0;
      let biasSum = 0;
      let k = 0;
      let developing = 0;
      let weakErr: number | null = null;
      const alphaSum = ALPHAS.map(() => 0);
      for (const [key, st] of Object.entries(mastery)) {
        if (st.m === null) continue;
        if (st.m < 0 || st.m > 1 || Number.isNaN(st.m)) res.violations.nan++;
        const list = bySubItems.get(key) ?? [];
        if (!list.length) continue;
        const tau = list.reduce((sum, it) => sum + pCorrect(profile, it, key, day), 0) / list.length;
        absSum += Math.abs(st.m - tau);
        biasSum += st.m - tau;
        ALPHAS.forEach((a, j) => (alphaSum[j] += Math.abs((foldWith(a, bySub.get(key) as AttemptEvent[]) as number) - tau)));
        if (key === cfg.weakSub) weakErr = Math.abs(st.m - tau);
        k++;
        if (st.confidence === "developing") developing++;
      }
      if (developing > 0 && res.firstDevelopingDay === null) res.firstDevelopingDay = day;
      // What-if: one mastery index per topic (all its subskills' events together).
      if (res.topicDevelopingDay === null) {
        const byTopic = new Map<string, AttemptEvent[]>();
        for (const a of attempts) byTopic.set(a.topic, [...(byTopic.get(a.topic) ?? []), a]);
        for (const evs of byTopic.values()) if (recompute(evs, endOfDay).confidence === "developing") res.topicDevelopingDay ??= day;
      }
      res.samples.push({ day, mae: k ? absSum / k : null, bias: k ? biasSum / k : null, maeAlpha: alphaSum.map((x) => (k ? x / k : null)), weakErr, developing, withEvidence: k });
    }

    // Final invariants: per-step assisted rule, ledger.
    for (const evs of bySub.values()) {
      for (const st of recompute(evs, DAY0 + DAYS * DAY).steps) if (st.assisted && st.after > st.before + 1e-12) res.violations.assistedStep++;
    }
    const keys = ledger.map((e) => e.key);
    res.violations.dupKeys = keys.length - new Set(keys).size;
    const days = [...new Set(ledger.map((e) => e.day))];
    for (const d of days) {
      const pts = pointsOnDay(ledger, d);
      if (pts > DAILY_CAP) res.violations.capExceeded++;
      if (pts === DAILY_CAP) res.ledger.daysAtCap++;
      res.ledger.maxDay = Math.max(res.ledger.maxDay, pts);
    }
    res.ledger.activeDays = new Set(attempts.map((a) => sgDate(a.at))).size;
    res.ledger.total = totalPoints(ledger);
    res.ledger.cappedEntries = ledger.filter((e) => e.note).length;
    for (const e of ledger) if (e.kind === "stars") res.ledger.byRule[e.rule] = (res.ledger.byRule[e.rule] ?? 0) + e.amount;
    if (ledger.some((e) => !Number.isInteger(e.amount) || e.amount < 0)) res.violations.nan++;
    res.freshSuccesses = freshSuccesses(attempts);
  } catch (err) {
    res.violations.crashes.push(String((err as Error).stack ?? err));
  }
  res.distinctSubskillsPerSession = n ? distinctSum / n : 0;
  return res;

  function award(ev: Parameters<typeof awardsFor>[0]) {
    const got = awardsFor(ev, { ledger, attempts });
    ledger = [...ledger, ...got];
    // A refresh or replay of the same event must earn nothing.
    if (r.chance(0.15) && awardsFor(ev, { ledger, attempts }).length > 0) res.violations.refreshAwards++;
  }

  function answer(item: SimItem, t: number, day: number): number {
    const key = subskillKey(item);
    const family = item.family ?? questionOf(item);
    let p = pCorrect(profile, item, key, day);
    let hints = 0;
    const struggle = 1 - p;
    if (!profile.guesser) {
      if (r.chance(Math.min(1, profile.hint * struggle * 1.4))) {
        hints = 1;
        p += (1 - p) * 0.3;
        if (r.chance(profile.hint * struggle)) {
          hints = 2;
          p += (1 - p) * 0.3;
        }
      }
    }
    const revealed = r.chance(profile.reveal * struggle);
    const correct = revealed || r.chance(p);
    const response = correct ? item.answer : wrongResponse(item);
    const mark = markItem(item, response);
    const base: Omit<AttemptEvent, "id" | "at" | "firstTry" | "marks" | "explanation" | "explanationRevised"> = {
      itemId: item.id,
      family,
      question: questionOf(item),
      skill: item.skill,
      topic: item.topic,
      subskill: item.subskill,
      maxMarks: item.marks,
      hintsBeforeSubmit: hints,
      revealed,
      confirmed: mark.confirmed,
    };
    const explained = r.chance(profile.explain);
    const first: AttemptEvent = { ...base, id: `${item.id}@${t}`, at: new Date(t).toISOString(), firstTry: true, marks: mark.marks ?? 0, explanation: explained };
    if (mark.correct !== correct) res.violations.crashes.push(`marking disagreed with the simulated answer on ${item.id}`);
    commit(first);
    if (!correct && !revealed && r.chance(profile.retry)) {
      const p2 = profile.guesser ? pCorrect(profile, item, key, day) : p + (1 - p) * 0.4;
      const ok = r.chance(p2);
      const m2 = markItem(item, ok ? item.answer : wrongResponse(item));
      commit({ ...base, id: `${item.id}@${t + 30_000}`, at: new Date(t + 30_000).toISOString(), firstTry: false, marks: m2.marks ?? 0, revealed: false, explanation: explained, explanationRevised: explained && r.chance(0.7) });
    }
    return revealed ? 0 : hints;
  }

  function wrongResponse(item: SimItem): number | string {
    if (item.type === "mcq") {
      const n = item.options?.length ?? 4;
      const wrong = Array.from({ length: n }, (_, k) => k + 1).filter((k) => k !== item.answer);
      return r.pick(wrong);
    }
    return "i don't know";
  }

  function commit(a: AttemptEvent) {
    const key = subskillKey(a);
    const list = bySub.get(key) ?? [];
    attempts.push(a);
    list.push(a);
    bySub.set(key, list);
    familyLast.set(a.family, Math.max(familyLast.get(a.family) ?? -Infinity, Date.parse(a.at)));
    award({ type: "attempt", attempt: a });
  }
}

// ─── Experiments ────────────────────────────────────────────────────────────

const packs = loadPacks();
const results: RunResult[] = [];
const started = Date.now();

/** Subskills by question count; with `noTwoOption`, only those without true/false-style items (a 50% guess floor hides weakness). */
function topSubskills(pack: Pack, noTwoOption = false): string[] {
  const counts = new Map<string, Set<string>>();
  const twoOption = new Set<string>();
  for (const i of pack.items) {
    if (i.status !== "reviewed" || (i.type !== "mcq" && i.type !== "short")) continue;
    const k = subskillKey(i);
    counts.set(k, (counts.get(k) ?? new Set()).add(questionOf(i)));
    if (i.type === "mcq" && (i.options?.length ?? 4) < 3) twoOption.add(k);
  }
  return [...counts]
    .filter(([k]) => !noTwoOption || !twoOption.has(k))
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([k]) => k);
}

function topTopics(pack: Pack, n: number): string[] {
  const counts = new Map<string, number>();
  for (const i of pack.items) if (i.status === "reviewed" && (i.type === "mcq" || i.type === "short")) counts.set(i.topic, (counts.get(i.topic) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([t]) => t);
}

const weakStrong = new Map<string, [string, string]>();
for (const pack of packs) {
  const strongSub = topSubskills(pack)[0] ?? "-";
  const weakSub = topSubskills(pack, true).find((k) => k !== strongSub) ?? "-";
  weakStrong.set(pack.id, [weakSub, strongSub]);
  for (const profile of profiles(weakSub, strongSub)) {
    for (let rep = 0; rep < REPLICATES; rep++) results.push(run({ pack, profile, rep, weakSub }));
  }
}

// Assessment scenario: a test in 10 days on the two biggest topics; same learner and seeds without it as control.
const testRuns: RunResult[] = [];
for (const id of ["p3-maths", "p3-english", "p3-science"]) {
  const pack = packs.find((p) => p.id === id) as Pack;
  const topics = topTopics(pack, 2);
  const [w, s] = weakStrong.get(id) as [string, string];
  const mid = profiles(w, s).find((p) => p.name === "uneven") as Profile;
  for (let rep = 0; rep < REPLICATES; rep++) {
    const measureScope = { day: 10, topics };
    testRuns.push(run({ pack, profile: mid, rep, weakSub: w, assessment: { day: 10, topics }, measureScope, label: "test" }));
    testRuns.push(run({ pack, profile: mid, rep, weakSub: w, measureScope, label: "control" }));
  }
}

// Tuning: does selection home in on the uneven learner's weak subskill, and at what cost?
const VARIANTS: { label: string; tuning?: Tuning; maxPerSubskill?: number }[] = [
  { label: "PRD default" },
  { label: "subskill cap 3" , maxPerSubskill: 3 },
  { label: "unseen D 0.25", tuning: { unseenD: 0.25 } },
  { label: "H mismatch 0.6", tuning: { hMismatch: 0.6 } },
  { label: "no probe reserve", tuning: { reserveProbe: false } },
  { label: "unseen D 0.25 + H mismatch 0.6", tuning: { unseenD: 0.25, hMismatch: 0.6 } },
  { label: "W 0.50, D 0.05 (+ unseen D 0.25)", tuning: { weights: { W: 0.5, D: 0.05 }, unseenD: 0.25 } },
];
const tuneRuns: RunResult[] = [];
for (const id of ["p3-maths", "p3-english"]) {
  const pack = packs.find((p) => p.id === id) as Pack;
  const [w, s] = weakStrong.get(id) as [string, string];
  const uneven = profiles(w, s).find((p) => p.name === "uneven") as Profile;
  for (const v of VARIANTS) for (let rep = 0; rep < REPLICATES; rep++) tuneRuns.push(run({ pack, profile: uneven, rep, weakSub: w, ...v }));
}

// ─── Report ─────────────────────────────────────────────────────────────────

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "–");
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : "–");
const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(100 * x)}%` : "–");
const dayOrNever = (xs: (number | null)[]) => {
  const hit = xs.filter((x): x is number => x !== null);
  return hit.length === 0 ? "never" : `${median(hit)}${hit.length < xs.length ? ` (${hit.length}/${xs.length} runs)` : ""}`;
};
const sampleAt = (rs: RunResult[], day: number, f: (s: DaySample) => number | null) => mean(rs.map((x) => f(x.samples[day])).filter((v): v is number => v !== null));
const sum = (rs: RunResult[], f: (x: RunResult) => number) => rs.reduce((a, x) => a + f(x), 0);

const LEARNERS = ["strong", "weak", "uneven", "improving", "hint-heavy", "guesser", "cold-start"];
const BIG = ["p3-maths", "p3-english"];
const all = [...results, ...testRuns, ...tuneRuns];
const md: string[] = [];
md.push(`# Learner simulation (generated by scripts/soak/simulate.ts)\n`);
md.push(`Seed ${SEED}, ${REPLICATES} replicates per learner × pack, ${DAYS} days, 1–2 sessions a day, 3 questions a session. Runs: ${all.length}; questions served: ${sum(all, (x) => x.picks)}. Time: ${((Date.now() - started) / 1000).toFixed(1)} s.\n`);

md.push(`## Mastery accuracy by learner (p3-maths + p3-english)\n`);
md.push("MAE = mean |m − τ| over subskills with evidence, where τ is the learner's true chance of an unaided correct answer on that subskill's items. Bias = mean (m − τ). The α columns re-fold the same evidence with a faster learning rate (what-if; the engine uses α = 0.3).\n");
md.push(
  table(
    ["learner", "MAE d5", "MAE d10", "MAE d30", "bias d30", "MAE d30 α=.4", "MAE d30 α=.5", "subskills with evidence d30", "developing d30", "first developing day (per subskill)", "first developing day (per topic, what-if)"],
    LEARNERS.map((name) => {
      const rs = results.filter((x) => x.profile === name && BIG.includes(x.pack));
      return [
        name,
        f2(sampleAt(rs, 4, (s) => s.mae)),
        f2(sampleAt(rs, 9, (s) => s.mae)),
        f2(sampleAt(rs, 29, (s) => s.mae)),
        f2(sampleAt(rs, 29, (s) => s.bias)),
        f2(sampleAt(rs, 29, (s) => s.maeAlpha[1])),
        f2(sampleAt(rs, 29, (s) => s.maeAlpha[2])),
        f1(sampleAt(rs, 29, (s) => s.withEvidence)),
        f1(sampleAt(rs, 29, (s) => s.developing)),
        dayOrNever(rs.map((x) => x.firstDevelopingDay)),
        dayOrNever(rs.map((x) => x.topicDevelopingDay)),
      ];
    }),
  ),
);

md.push(`\n## Packs: bank exhaustion and session health (all learners but cold-start)\n`);
md.push(
  table(
    ["pack", "reviewed questions", "fresh picks", "review picks (no new evidence)", "probe picks", "sessions short of 3", "empty sessions", "no fresh left (median day)", "first review pick (median day)", "distinct subskills / session"],
    packs.map((p) => {
      const rs = results.filter((x) => x.pack === p.id && x.profile !== "cold-start");
      const qs = new Set(p.items.filter((i) => i.status === "reviewed" && (i.type === "mcq" || i.type === "short")).map((i) => questionOf(i))).size;
      const sessions = sum(rs, (x) => x.sessions);
      const picks = sum(rs, (x) => x.picks);
      return [
        p.id,
        qs,
        pct(sum(rs, (x) => x.freshPicks) / picks),
        pct(sum(rs, (x) => x.reviewPicks) / picks),
        pct(sum(rs, (x) => x.probePicks) / picks),
        pct(sum(rs, (x) => x.shortSessions) / sessions),
        pct(sum(rs, (x) => x.emptySessions) / sessions),
        dayOrNever(rs.map((x) => x.exhaustedDay)),
        dayOrNever(rs.map((x) => x.firstReviewDay)),
        f2(mean(rs.map((x) => x.distinctSubskillsPerSession))),
      ];
    }),
  ),
);

md.push(`\n## Does selection target the weak subskill? (uneven learner: weak 0.2, strong 0.92, others 0.6)\n`);
md.push(
  table(
    ["pack", "variant", "weak subskill's questions (share of bank)", "weak share of picks, week 1", "weak share of picks, 30 days", "strong share, 30 days", "|m − τ| on weak subskill d30", "subskills with evidence d30", "MAE d30"],
    BIG.flatMap((id) =>
      VARIANTS.map((v) => {
        const [w, s] = weakStrong.get(id) as [string, string];
        const rs = tuneRuns.filter((x) => x.pack === id && x.label === v.label);
        const pack = packs.find((p) => p.id === id) as Pack;
        const qs = [...new Set(pack.items.filter((i) => i.status === "reviewed" && (i.type === "mcq" || i.type === "short")).map((i) => `${subskillKey(i)}#${questionOf(i)}`))];
        const bankShare = qs.filter((q) => q.startsWith(`${w}#`)).length / qs.length;
        const picks = sum(rs, (x) => x.picks);
        return [
          id,
          v.label,
          `${qs.filter((q) => q.startsWith(`${w}#`)).length} (${pct(bankShare)})`,
          pct(sum(rs, (x) => x.pickSubskillsWeek1[w] ?? 0) / sum(rs, (x) => x.picksWeek1)),
          pct(sum(rs, (x) => x.pickSubskills[w] ?? 0) / picks),
          pct(sum(rs, (x) => x.pickSubskills[s] ?? 0) / picks),
          f2(sampleAt(rs, 29, (d) => d.weakErr)),
          f1(sampleAt(rs, 29, (d) => d.withEvidence)),
          f2(sampleAt(rs, 29, (d) => d.mae)),
        ];
      }),
    ),
  ),
);
md.push(`\nWeak subskills: ${BIG.map((id) => `${id} → ${(weakStrong.get(id) as [string, string])[0]}; strong → ${(weakStrong.get(id) as [string, string])[1]}`).join("; ")}.\n`);

md.push(`\n## Test in 10 days (uneven learner; scope = the pack's two biggest topics)\n`);
md.push(
  table(
    ["pack", "scope", "in-scope share of picks, days 0–9, test entered", "same learner and seeds, no test"],
    ["p3-maths", "p3-english", "p3-science"].map((id) => {
      const topics = topTopics(packs.find((p) => p.id === id) as Pack, 2);
      const share = (label: string) => {
        const rs = testRuns.filter((x) => x.pack === id && x.label === label);
        return sum(rs, (x) => x.inScopeBeforeTest) / sum(rs, (x) => x.picksBeforeTest);
      };
      return [id, topics.join(", "), pct(share("test")), pct(share("control"))];
    }),
  ),
);

md.push(`\n## Rewards ledger (all packs; runs with at least one question)\n`);
md.push(
  table(
    ["learner", "points in 30 days (mean)", "max in one day", "days at the 15 cap", "capped entries", "first attempt", "retry", "fresh transfer", "creation", "companion stage d30", "jets d30"],
    LEARNERS.map((name) => {
      const rs = results.filter((x) => x.profile === name && x.picks > 0);
      const rule = (k: string) => f1(mean(rs.map((x) => x.ledger.byRule[k] ?? 0)));
      const stage = mean(rs.map((x) => x.companionDays.filter((d) => d !== null).length));
      return [name, f1(mean(rs.map((x) => x.ledger.total))), Math.max(...rs.map((x) => x.ledger.maxDay)), f1(mean(rs.map((x) => x.ledger.daysAtCap))), f1(mean(rs.map((x) => x.ledger.cappedEntries))), rule("first_attempt"), rule("retry_revised"), rule("fresh_transfer"), rule("creation_saved"), f1(stage), f1(mean(rs.map((x) => x.jets)))];
    }),
  ),
);

md.push(`\n## Companion and squadron: median day reached (p3-maths, p3-english, p3-science)\n`);
md.push(
  table(
    ["learner", "tadpole", "froglet", "frog", "jets at d30 (mean)"],
    LEARNERS.map((name) => {
      const rs = results.filter((x) => x.profile === name && ["p3-maths", "p3-english", "p3-science"].includes(x.pack));
      return [name, ...[0, 1, 2].map((k) => dayOrNever(rs.map((x) => x.companionDays[k]))), f1(mean(rs.map((x) => x.jets)))];
    }),
  ),
);

md.push(`\n## Invariants (every run)\n`);
md.push(
  table(
    ["check", "violations"],
    [
      ["7-day family exclusion", sum(all, (x) => x.violations.sevenDay)],
      ["never cross course", sum(all, (x) => x.violations.crossCourse)],
      ["one family once per session", sum(all, (x) => x.violations.dupFamilyInSession)],
      ["assisted step raised m (per §6 step)", sum(all, (x) => x.violations.assistedStep)],
      ["NaN or out-of-range (m, factors, amounts)", sum(all, (x) => x.violations.nan)],
      ["daily cap exceeded", sum(all, (x) => x.violations.capExceeded)],
      ["duplicate ledger keys", sum(all, (x) => x.violations.dupKeys)],
      ["award on refresh or replay", sum(all, (x) => x.violations.refreshAwards)],
      ["crashes or marking disagreements", sum(all, (x) => x.violations.crashes.length)],
      ["displayed m rose after an assisted fresh question: window slide", sum(all, (x) => x.assistedRises.windowSlide)],
      ["displayed m rose after an assisted fresh question: other", sum(all, (x) => x.assistedRises.other)],
      ["largest such rise", `+${Math.max(...all.map((x) => x.assistedRises.max)).toFixed(4)}`],
    ],
  ),
);

const crashes = all.flatMap((x) => x.violations.crashes.map((c) => `${x.pack}/${x.profile}/${x.rep}: ${c}`));
if (crashes.length) md.push(`\n## Crashes\n\n${crashes.slice(0, 20).map((c) => `- ${c}`).join("\n")}`);

const mdPath = writeOut("simulate.md", md.join("\n") + "\n");
const jsonPath = writeOut("simulate.json", { seed: SEED, replicates: REPLICATES, days: DAYS, results: all.map(({ samples, ...rest }) => ({ ...rest, samples: samples.filter((d) => [4, 9, 19, 29].includes(d.day)) })) });
console.log(md.join("\n"));
console.log(`\nWrote ${mdPath} and ${jsonPath}`);
