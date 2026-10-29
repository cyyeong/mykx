// Looking after a pet (founder, 29 Oct): bars that run down with time, a mood read from them, care actions that fill
// them, and growth to the next life stage once the stage's own jobs are done while the pet is well looked after.
// Pure and deterministic, run by the server (the record of truth) and by the page (to show the bars running down).
// A pet never gets sick, dies or shrinks: low bars only make it hungry, sad or cross until it's cared for, and a stage
// once reached is kept. Growth comes from care, never from chance; nothing here touches mastery or the ledger (rule 5).
import { type Bar, type FoodId, type Job, type PetId, PETS, type StageDef } from "./species.ts";

export type Bars = Record<Bar, number>;
export type Mood = "happy" | "okay" | "hungry" | "sad" | "angry";

export interface PetRecord {
  species: PetId;
  /** 0 to 3: the life stage. */
  stage: number;
  /** 1 for the first pet; each laying of eggs starts the next generation at stage 0. */
  generation: number;
  /** The bars as they were at `at`; barsNow runs them down from there. */
  bars: Bars;
  at: string;
  /** This stage's jobs done so far. */
  done: Partial<Record<Job, number>>;
  adoptedAt: string;
}

export type Action = { kind: "feed"; food: FoodId } | { kind: "clean" } | { kind: "play" } | { kind: "warm" } | { kind: "special" } | { kind: "talk" };

/** How the pet reacts, for the page's animation and sound. */
export type Reaction = "yum" | "no" | "full" | "sparkle" | "love" | "cosy" | "done" | "grew" | "eggs" | "wait";

export interface Outcome {
  pet: PetRecord;
  /** Whether the action was taken (a full pet, a wrong food or a job not open yet change nothing). */
  ok: boolean;
  reaction: Reaction;
  /** What the pet says, in its own words. */
  say: string;
}

/** Points lost per hour: a full bar lasts about half a day (food) to a day (clean). */
export const DECAY: Bars = { food: 10, clean: 6, love: 8, warm: 8 };
/** Points a care action adds. */
const GAIN: Record<Exclude<Job, "special">, number> = { feed: 20, clean: 100, play: 15, warm: 30 };
const TALK_GAIN = 4;
/** A bar at or above this can't take more of the same care ("I'm full!"). */
export const FULL = 90;
/** Bars that must all be at least this for the pet to grow. */
export const GROW_AT = 50;
const START: Bars = { food: 60, clean: 80, love: 60, warm: 60 };

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const hoursBetween = (from: string, to: string) => Math.max(0, (Date.parse(to) - Date.parse(from)) / 3_600_000);

export const stageOf = (p: Pick<PetRecord, "species" | "stage">): StageDef => PETS[p.species].stages[p.stage];
const JOB_BAR: Record<Exclude<Job, "special">, Bar> = { feed: "food", clean: "clean", play: "love", warm: "warm" };

export function adopt(species: PetId, now: string): PetRecord {
  return { species, stage: 0, generation: 1, bars: { ...START }, at: now, done: {}, adoptedAt: now };
}

/** The bars now: each runs down from its last value at its own pace. */
export function barsNow(p: PetRecord, now: string): Bars {
  const h = hoursBetween(p.at, now);
  return { food: clamp(p.bars.food - DECAY.food * h), clean: clamp(p.bars.clean - DECAY.clean * h), love: clamp(p.bars.love - DECAY.love * h), warm: clamp(p.bars.warm - DECAY.warm * h) };
}

/** The mood, from this stage's bars only. A stage that doesn't eat (eggs, a pupa) is never hungry or cross. */
export function moodOf(p: PetRecord, now: string): Mood {
  const s = stageOf(p);
  const b = barsNow(p, now);
  const vals = s.bars.map((k) => b[k]);
  const active = s.eats.length > 0;
  const lowCount = vals.filter((v) => v < 35).length;
  if (active && (lowCount >= 2 || vals.some((v) => v < 15))) return "angry";
  if (active && s.bars.includes("food") && b.food < 35) return "hungry";
  if (active && s.bars.includes("clean") && b.clean < 35) return "angry";
  if (lowCount > 0) return "sad";
  return vals.every((v) => v >= 60) ? "happy" : "okay";
}

/** Jobs this stage still needs, in the order the page lists them. */
export function jobsLeft(p: PetRecord): { job: Job; left: number; of: number }[] {
  const s = stageOf(p);
  return (["feed", "clean", "play", "warm", "special"] as const)
    .filter((j) => (s.jobs[j] ?? 0) > 0)
    .map((j) => ({ job: j, of: s.jobs[j] ?? 0, left: Math.max(0, (s.jobs[j] ?? 0) - (p.done[j] ?? 0)) }));
}

const isAdult = (p: PetRecord) => p.stage === 3;
/** At the adult stage, laying eggs is the last job: it opens once everything else is done. */
const othersDone = (p: PetRecord) => jobsLeft(p).every((j) => j.job === "special" || j.left === 0);
const lowBars = (p: PetRecord, now: string) => {
  const b = barsNow(p, now);
  return stageOf(p).bars.filter((k) => b[k] < GROW_AT);
};

const BAR_NEED: Record<Bar, string> = { food: "a good meal", clean: "a clean home", love: "a bit more time with you", warm: "to be warmer" };

/** One care action, at `now`. Returns the pet after it (unchanged when refused) and what it says. */
export function care(p: PetRecord, action: Action, now: string): Outcome {
  const spec = PETS[p.species];
  const s = stageOf(p);
  const bars = barsNow(p, now);
  const base: PetRecord = { ...p, bars, at: now };
  const refuse = (reaction: Reaction, say: string): Outcome => ({ pet: base, ok: false, reaction, say });

  if (action.kind === "talk") return { pet: { ...base, bars: { ...bars, love: clamp(bars.love + TALK_GAIN) } }, ok: true, reaction: "love", say: "" };

  if (action.kind === "feed") {
    if (!s.eats.length) return refuse("no", spec.notEating[p.stage] ?? "I'm not hungry.");
    if (!s.eats.includes(action.food)) return refuse("no", s.wrong[action.food] ?? `That's not what a ${s.label.toLowerCase()} eats.`);
    if (bars.food >= FULL) return refuse("full", "I'm full! Maybe a bit later.");
  }
  if (action.kind === "clean" && !s.bars.includes("clean")) return refuse("no", "My home is fine for now.");
  if (action.kind === "clean" && bars.clean >= FULL) return refuse("full", "Already sparkling clean!");
  if (action.kind === "warm" && !s.bars.includes("warm") && !s.jobs.warm) return refuse("no", "I'm warm enough, thanks.");
  if (action.kind === "warm" && bars.warm >= FULL) return refuse("full", "Lovely and toasty already.");
  if (action.kind === "play" && bars.love >= 98) return refuse("full", "That was so much fun! Let's play again later.");

  if (action.kind === "special") {
    if (!s.special || (p.done.special ?? 0) >= (s.jobs.special ?? 0)) return refuse("no", "Nothing to do there just now.");
    if (isAdult(p)) {
      if (!othersDone(p)) return refuse("wait", "I'm not ready to lay eggs yet. Look after me a little more first.");
      const low = lowBars(p, now);
      if (low.length) return refuse("wait", `Almost ready! First I need ${BAR_NEED[low[0]]}.`);
      // A new generation hatches from the eggs: back to stage 0, the same name, the bars as they are.
      return { pet: { ...base, stage: 0, generation: p.generation + 1, done: {} }, ok: true, reaction: "eggs", say: s.special.done };
    }
  }

  const job: Job = action.kind;
  const nextBars = job === "special" ? bars : { ...bars, [JOB_BAR[job]]: clamp(job === "clean" ? 100 : bars[JOB_BAR[job]] + GAIN[job]) };
  const done = { ...p.done, [job]: (p.done[job] ?? 0) + 1 };
  let pet: PetRecord = { ...base, bars: nextBars, done };
  const said = job === "special" ? (s.special?.done ?? "") : SAY[job][p.species];
  const reaction: Reaction = job === "feed" ? "yum" : job === "clean" ? "sparkle" : job === "play" ? "love" : job === "warm" ? "cosy" : "done";

  // Grows once every job of this stage is done and the pet is well looked after (adults lay eggs instead).
  if (!isAdult(pet) && jobsLeft(pet).every((j) => j.left === 0)) {
    const low = lowBars(pet, now);
    if (!low.length) {
      pet = { ...pet, stage: pet.stage + 1, done: {} };
      return { pet, ok: true, reaction: "grew", say: `${said} I'm growing… I'm a ${stageOf(pet).label.toLowerCase()} now!`.trim() };
    }
    return { pet, ok: true, reaction, say: `${said} I'm ready to grow, but first I need ${BAR_NEED[low[0]]}.`.trim() };
  }
  return { pet, ok: true, reaction, say: said };
}

/** Whether the pet would grow now (an adult: could lay eggs): its jobs done and every bar well topped up. */
export function readyToGrow(p: PetRecord, now: string): boolean {
  return (isAdult(p) ? othersDone(p) : jobsLeft(p).every((j) => j.left === 0)) && lowBars(p, now).length === 0;
}

const SAY: Record<Exclude<Job, "special">, Record<PetId, string>> = {
  feed: { frog: "Mmm, yummy!", mealworm: "Munch munch munch!", butterfly: "Delicious!", chicken: "Peck peck, yum!" },
  clean: { frog: "Ahh, fresh clean water!", mealworm: "A clean tub. Lovely!", butterfly: "So fresh and clean!", chicken: "Fresh straw. Thank you!" },
  play: { frog: "Wheee! That was fun!", mealworm: "Hee hee, that tickles!", butterfly: "Wheee, let's do loops!", chicken: "Cheep cheep! Again!" },
  warm: { frog: "Ahh, warm sunshine.", mealworm: "Nice and cosy.", butterfly: "Warm sunshine on my wings!", chicken: "So warm and snug." },
};
