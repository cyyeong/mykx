// Each typing game's own path (GAMES.md §3): where it starts, its last stage today, the stage whose speed target
// a teen needs for three stars, and the stage names. Star Typer walks stages 1–6; Neon Strike is "Answer blast"
// (the curriculum's stage 7) in five levels; Word Garden is "Match it" (stage 8) in five levels.
import { STAGES, startingStage } from "./curriculum.ts";
import { PLAYABLE_STAGES } from "./levels.ts";

export interface TypingMode {
  maxStage: number;
  start: (band: "junior" | "teen") => number;
  /** The curriculum stage whose speed target applies (score.ts speedTarget). */
  speedStage: (stage: number) => number;
  stageName: (stage: number) => string;
}

export const TYPING_MODES: Readonly<Record<string, TypingMode>> = {
  "star-typer": { maxStage: PLAYABLE_STAGES, start: startingStage, speedStage: (s) => s, stageName: (s) => STAGES.find((x) => x.n === s)?.name ?? "" },
  "neon-strike": { maxStage: 1, start: () => 1, speedStage: () => 7, stageName: () => "Answer blast" },
  "word-garden": { maxStage: 1, start: () => 1, speedStage: () => 8, stageName: () => "Match it" },
};
