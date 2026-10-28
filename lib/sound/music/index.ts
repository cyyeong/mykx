// The five pack themes, parsed once and shared by the planner and the engine.
// JSON scores are the source of truth; anything malformed fails fast here,
// never mid-song in a child's session.
import animeSky from "./anime-sky.json";
import dreamlight from "./dreamlight.json";
import idolStage from "./idol-stage.json";
import terrarium from "./terrarium.json";
import toonPop from "./toon-pop.json";
import { ThemeScore, type ThemePack } from "./schema";

const RAW: Record<ThemePack, unknown> = {
  dreamlight,
  "anime-sky": animeSky,
  "toon-pop": toonPop,
  "idol-stage": idolStage,
  terrarium,
};

function load(pack: ThemePack): ThemeScore {
  const parsed = ThemeScore.safeParse(RAW[pack]);
  if (!parsed.success) throw new Error(`Invalid ${pack} theme score: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}

export const THEMES: Record<ThemePack, ThemeScore> = {
  dreamlight: load("dreamlight"),
  "anime-sky": load("anime-sky"),
  "toon-pop": load("toon-pop"),
  "idol-stage": load("idol-stage"),
  terrarium: load("terrarium"),
};
