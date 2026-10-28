// The words for any typing level a child can play today. Stages 1–4 are built in (curriculum.ts); stage 5 ("My
// spelling words") and stage 6 ("Subject words") use word banks written for myKx from each level's MOE syllabus
// (English vocabulary; Science terms from the skill packs' topics), easiest first. Stages 7–9 (answer blast, match
// it, sentence sprint) come next. Deterministic: the same level always has the same words.
import { builtInLevel, LEVELS_PER_STAGE, WORDS_PER_LEVEL } from "./curriculum.ts";

export type SchoolLevel = "P3" | "P6" | "Sec 2";

const SPELLING: Record<SchoolLevel, readonly string[]> = {
  P3: ["kind", "brave", "happy", "friend", "school", "garden", "kitchen", "pencil", "rainbow", "because", "thought", "between", "favourite", "different", "beautiful", "breakfast", "neighbour", "carefully", "surprise", "important", "together", "excited"],
  P6: ["anxious", "grateful", "reluctant", "persevere", "volunteer", "community", "determined", "curious", "independent", "responsible", "magnificent", "embarrassed", "conscience", "accommodate", "environment", "opportunity", "achievement", "occasionally", "recommend", "disappointed"],
  "Sec 2": ["ambiguous", "articulate", "compelling", "consequence", "contemplate", "diligent", "empathy", "inevitable", "meticulous", "perspective", "resilient", "scrutinise", "substantial", "sustainable", "tentative", "unprecedented", "versatile", "vulnerable", "advocate", "coherent"],
};

const SUBJECT: Record<SchoolLevel, readonly string[]> = {
  P3: ["egg", "larva", "pupa", "adult", "tadpole", "froglet", "seed", "root", "shoot", "fungi", "magnet", "pole", "attract", "repel", "steel", "iron", "plastic", "insect", "mammal", "seedling", "chrysalis", "germinate"],
  P6: ["energy", "force", "friction", "gravity", "habitat", "organism", "adaptation", "pollution", "conductor", "insulator", "circuit", "kinetic", "potential", "producer", "consumer", "decomposer", "photosynthesis", "evaporation", "condensation", "respiration"],
  "Sec 2": ["current", "voltage", "resistance", "series", "parallel", "element", "compound", "mixture", "reactant", "product", "ecosystem", "population", "community", "acid", "alkali", "neutral", "indicator", "conductor", "resultant", "electrolysis"],
};

/** The last stage a child can play today. */
export const PLAYABLE_STAGES = 6;

function slide(bank: readonly string[], level: number): string[] {
  const span = Math.min(WORDS_PER_LEVEL, bank.length);
  const start = Math.round(((bank.length - span) * (Math.min(Math.max(level, 1), LEVELS_PER_STAGE) - 1)) / (LEVELS_PER_STAGE - 1));
  return bank.slice(start, start + span);
}

/** The words for a level, or null when the stage isn't playable yet. */
export function levelWords(stage: number, level: number, school: SchoolLevel): string[] | null {
  if (stage >= 1 && stage <= 4) return builtInLevel(stage, level);
  if (stage === 5) return slide(SPELLING[school], level);
  if (stage === 6) return slide(SUBJECT[school], level);
  return null;
}

export function schoolLevelOf(level: string | null): SchoolLevel {
  return level === "P6" ? "P6" : level === "Sec 2" ? "Sec 2" : "P3";
}
