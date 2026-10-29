// What a pet says when a kid talks to it (founder, 29 Oct): the facts the Critter Keeper agent is given about the pet
// (species, stage, what it eats, how it feels and why, the care its stage still needs), its reply schema, and the
// cached replies used without a model (rule 7), keyed on the same facts so they stay true to the stage. Pure.
import { z } from "zod";
import { barsNow, jobsLeft, type Mood, moodOf, type PetRecord, stageOf } from "./care.ts";
import { FOODS, PETS } from "./species.ts";

export const FEELINGS = ["happy", "okay", "hungry", "sad", "angry", "sleepy", "love"] as const;
export type Feeling = (typeof FEELINGS)[number];

export const petReplySchema = z.strictObject({
  reply: z.string().min(1).max(220),
  /** How the pet feels saying it, for its animation only (its mood comes from the bars, in code). */
  feeling: z.enum(FEELINGS),
});

const MOOD_WHY: Record<Mood, string> = {
  happy: "You feel happy: you're well fed, clean and loved.",
  okay: "You feel fine.",
  hungry: "You feel hungry: your food bar is low.",
  sad: "You feel a bit sad: you'd like more time with the child, or to be warmer.",
  angry: "You feel cross: your home needs cleaning or you've been left too long without care.",
};

/** The pet's facts, as words, for the model. No child data: only the pet. */
export function petFacts(p: PetRecord, now: string): string {
  const sp = PETS[p.species];
  const s = stageOf(p);
  const b = barsNow(p, now);
  const next = p.stage < 3 ? sp.stages[p.stage + 1].label.toLowerCase() : null;
  return [
    `You are ${sp.name}, a ${sp.kind.toLowerCase()}. Right now you are ${s.self}`,
    s.eats.length ? `You eat: ${s.eats.map((f) => FOODS[f].name.toLowerCase()).join(", ")}.` : "You don't eat at this stage.",
    `You live in a ${sp.habitat.toLowerCase()}.`,
    next ? `When you're well looked after, you'll grow into a ${next}.` : "You're all grown up. You can lay eggs, and the life cycle starts again.",
    `Your bars (0 to 100): ${s.bars.map((k) => `${k} ${b[k]}`).join(", ")}.`,
    MOOD_WHY[moodOf(p, now)],
    `Care still needed${p.stage < 3 ? " before you grow" : " before you can lay eggs"}: ${careLeft(p) || "none, you're ready"}.`,
  ].join("\n");
}

const JOB_WORDS = { feed: ["meal", "meals"], clean: ["clean", "cleans"], play: ["play time", "play times"], warm: ["warm-up", "warm-ups"] } as const;

/** The jobs left this stage, in words: "2 meals, a clean, Add a rock". */
export function careLeft(p: PetRecord): string {
  const s = stageOf(p);
  return jobsLeft(p)
    .filter((j) => j.left > 0)
    .map((j) => (j.job === "special" ? (s.special?.label ?? "") : `${j.left === 1 ? "1" : j.left} ${JOB_WORDS[j.job][j.left === 1 ? 0 : 1]}`))
    .join(", ");
}

const MOOD_LINE: Record<Mood, string> = {
  happy: "I'm so happy you're here!",
  okay: "Hello! It's nice to see you.",
  hungry: "My tummy is rumbling… could I have something to eat?",
  sad: "I missed you. Will you stay with me a while?",
  angry: "Hmph! My home really needs some care.",
};

const PLAY: Record<PetRecord["species"], string> = {
  frog: "Let's play! Wiggle your finger in the water and I'll follow it.",
  mealworm: "Tickle me gently. Hee hee!",
  butterfly: "Let's play! I'll flutter after your finger.",
  chicken: "Cheep! Chase me round the coop!",
};

/** A reply without a model: true to the stage and the mood, picked by what the child asked about. */
export function fallbackReply(p: PetRecord, now: string, text: string): { reply: string; feeling: Feeling } {
  const sp = PETS[p.species];
  const s = stageOf(p);
  const mood = moodOf(p, now);
  const t = text.toLowerCase();
  const first = (x: string) => x.split(/(?<=[.!?])\s/)[0];
  const feeling: Feeling = mood === "okay" ? "happy" : mood;
  if (/\b(eat|food|hungry|feed|yum|lunch|dinner|snack)/.test(t)) {
    const eats = s.eats.map((f) => FOODS[f].name.toLowerCase());
    return { reply: eats.length ? `I eat ${eats.join(" and ")}. ${mood === "hungry" ? "And I'm hungry now!" : "Yum!"}` : (sp.notEating[p.stage] ?? "I don't eat just now."), feeling: mood === "hungry" ? "hungry" : "happy" };
  }
  if (/\b(need|help|what do you want|look after|care)/.test(t)) {
    const left = careLeft(p);
    return { reply: left ? `To ${p.stage < 3 ? "grow" : "lay eggs"}, I still need: ${left}.` : `I've had everything I need! Keep my bars up and I'll ${p.stage < 3 ? "grow" : "be ready to lay eggs"}.`, feeling };
  }
  if (/\b(grow|big|next|become|turn into|change)/.test(t)) {
    return { reply: p.stage < 3 ? `When you've looked after me well, I'll turn into a ${sp.stages[p.stage + 1].label.toLowerCase()}!` : "I'm all grown up! Next I can lay eggs, and the life cycle starts again.", feeling: "happy" };
  }
  if (/\b(name|who are you)/.test(t)) return { reply: `I'm ${sp.name}, your ${s.label.toLowerCase()}!`, feeling: "happy" };
  if (/\b(love|like you|friend|cute|best)/.test(t)) return { reply: "I love you too! You take such good care of me.", feeling: "love" };
  if (/\b(play|fun|game)/.test(t)) return { reply: s.eats.length ? PLAY[p.species] : "I'm resting just now, but you can stay and keep me company.", feeling: s.eats.length ? "happy" : "sleepy" };
  if (/\b(breathe|gills|lungs|legs|wings|tail|swim|fly|hop)/.test(t)) return { reply: `I'm ${first(s.self)}`, feeling };
  if (/\b(where|live|home|house)/.test(t)) return { reply: `I live in my ${sp.habitat.toLowerCase()}. ${mood === "angry" ? "It needs a clean!" : "I like it here."}`, feeling };
  return { reply: mood === "happy" || mood === "okay" ? `${MOOD_LINE[mood]} I'm ${first(s.self)}` : MOOD_LINE[mood], feeling };
}
