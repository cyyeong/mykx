// Server only: what the Arcade and its games load for the signed-in kid. The cabinets that fit their band and
// level, their saved progress, and the words for a typing level. Deterministic code only.
import type { Profile } from "../auth/store.ts";
import { loadKidStatus } from "../guardian/load.ts";
import { settingsFor } from "../guardian/view.ts";
import type { LearnContext } from "../learn/server.ts";
import { emptyProgress, isOpen, starTotals, type GameProgress } from "./progress.ts";
import { gamesFor, type GameBand, type GameLevel } from "./registry.ts";
import { LEVELS_PER_STAGE, STAGES } from "./typing/curriculum.ts";
import { blastLevel } from "./typing/answers.ts";
import { gardenLevel } from "./typing/garden.ts";
import { TYPING_MODES } from "./typing/modes.ts";
import { levelWords, PLAYABLE_STAGES, schoolLevelOf } from "./typing/levels.ts";

export interface Cabinet {
  id: string;
  name: string;
  tag: string;
  pitch: string;
  art: string;
  href: string | null;
  soon: boolean;
  kind: "typing" | "subject";
  stage: string;
  stars: string;
}

const bandOf = (kid: Profile): GameBand => (kid.band === "teen" ? "teen" : "junior");

export async function arcadeData(ctx: LearnContext) {
  const kid = await ctx.store.kid(ctx.householdId, ctx.kidId);
  const band = kid ? bandOf(kid) : "junior";
  const level = schoolLevelOf(kid?.level ?? null) as GameLevel;
  const saved = await ctx.store.games.progress(ctx.householdId, ctx.kidId).catch(() => [] as GameProgress[]);
  const now = new Date().toISOString();
  const cabinets: Cabinet[] = gamesFor(band, level).map((g) => {
    const mode = TYPING_MODES[g.id];
    const p = saved.find((x) => x.game === g.id) ?? emptyProgress(g.id, mode?.start(band) ?? 1, now);
    const t = starTotals(p);
    return {
      id: g.id,
      name: g.name,
      tag: g.tagText,
      pitch: g.pitch,
      art: g.art,
      href: g.status === "ready" ? g.route : null,
      soon: g.status !== "ready",
      kind: g.subject === "typing" ? "typing" : "subject",
      stage: g.status === "ready" && mode ? (mode.maxStage > 1 ? `Stage ${p.stage} · ${mode.stageName(p.stage)}` : `${mode.stageName(p.stage)} · level ${p.level} of ${LEVELS_PER_STAGE}`) : "Coming soon",
      stars: g.status === "ready" ? `★ ${t.earned} of ${t.possible}` : "",
    };
  });
  // Games count toward screen time (GAMES.md §2): today's play minutes against the band's play allowance.
  const status = kid ? await loadKidStatus(ctx.store, ctx.householdId, kid).catch(() => null) : null;
  const saved2 = kid ? await ctx.store.guardian.settings(ctx.householdId, kid.id).catch(() => null) : null;
  const allowance = settingsFor(kid?.band ?? null, kid?.dailyLimitMin ?? null, saved2).playMaxMin;
  const playMin = Math.round(status?.today.minutes.play ?? 0);
  return { nickname: ctx.nickname, band, level, cabinets, playMin, allowance };
}

export async function typingRound(ctx: LearnContext, game: string, want: { stage?: number; level?: number }) {
  const kid = await ctx.store.kid(ctx.householdId, ctx.kidId);
  const band = kid ? bandOf(kid) : "junior";
  const school = schoolLevelOf(kid?.level ?? null);
  const saved = (await ctx.store.games.progress(ctx.householdId, ctx.kidId).catch(() => [] as GameProgress[])).find((x) => x.game === game);
  const progress = saved ?? emptyProgress(game, TYPING_MODES[game].start(band), new Date().toISOString());
  let stage = want.stage ?? progress.stage;
  let level = want.level ?? progress.level;
  if (!isOpen(progress, stage, level) || stage > PLAYABLE_STAGES || level < 1 || level > LEVELS_PER_STAGE) {
    stage = Math.min(progress.stage, PLAYABLE_STAGES);
    level = progress.level;
  }
  const words = levelWords(stage, level, school) ?? levelWords(4, 1, school)!;
  const s = STAGES.find((x) => x.n === stage)!;
  return { nickname: ctx.nickname, band, school, stage, level, stageName: s.name, words, progress };
}

/** Neon Strike's round: five questions for the furthest open "Answer blast" level (or the one asked for). */
export async function blastRound(ctx: LearnContext, want: { level?: number }) {
  const kid = await ctx.store.kid(ctx.householdId, ctx.kidId);
  const band = kid ? bandOf(kid) : "teen";
  const school = schoolLevelOf(kid?.level ?? null);
  const saved = (await ctx.store.games.progress(ctx.householdId, ctx.kidId).catch(() => [] as GameProgress[])).find((x) => x.game === "neon-strike");
  const progress = saved ?? emptyProgress("neon-strike", 1, new Date().toISOString());
  const level = want.level && isOpen(progress, 1, want.level) && want.level <= LEVELS_PER_STAGE ? want.level : progress.level;
  return { nickname: ctx.nickname, band, school, stage: 1, level, questions: blastLevel(level, school) };
}

/** Word Garden's round: six pictures for the furthest open "Match it" level (or the one asked for). */
export async function gardenRound(ctx: LearnContext, want: { level?: number }) {
  const kid = await ctx.store.kid(ctx.householdId, ctx.kidId);
  const band = kid ? bandOf(kid) : "junior";
  const saved = (await ctx.store.games.progress(ctx.householdId, ctx.kidId).catch(() => [] as GameProgress[])).find((x) => x.game === "word-garden");
  const progress = saved ?? emptyProgress("word-garden", 1, new Date().toISOString());
  const level = want.level && isOpen(progress, 1, want.level) && want.level <= LEVELS_PER_STAGE ? want.level : progress.level;
  return { nickname: ctx.nickname, band, level, prompts: gardenLevel(level) };
}
