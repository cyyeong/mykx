// Where a pet is kept: one game_progress row per kid and species (game "pet:<species>"), so pets need no table of
// their own. stage holds the life stage + 1 (the column counts from 1); keys holds the care record (bars and when
// they were set, this stage's jobs done, the generation). Pure: both stores use it.
import type { GameProgress } from "../games/progress.ts";
import type { PetRecord } from "./care.ts";
import { isPetId } from "./species.ts";

export const PET_GAME = "pet:";

type Saved = Pick<PetRecord, "generation" | "bars" | "at" | "done" | "adoptedAt">;

export function petToGame(p: PetRecord): GameProgress {
  const saved: Saved = { generation: p.generation, bars: p.bars, at: p.at, done: p.done, adoptedAt: p.adoptedAt };
  return { game: `${PET_GAME}${p.species}`, stage: p.stage + 1, level: 1, stars: {}, bestAccuracy: 0, bestWpm: 0, keys: { pet: saved } as unknown as GameProgress["keys"], updatedAt: p.at };
}

export function petFromGame(g: GameProgress): PetRecord | null {
  const species = g.game.startsWith(PET_GAME) ? g.game.slice(PET_GAME.length) : null;
  const saved = (g.keys as unknown as { pet?: Saved }).pet;
  if (!isPetId(species) || !saved?.bars) return null;
  return { species, stage: Math.min(3, Math.max(0, g.stage - 1)), generation: saved.generation ?? 1, bars: saved.bars, at: saved.at ?? g.updatedAt, done: saved.done ?? {}, adoptedAt: saved.adoptedAt ?? g.updatedAt };
}
