// Which musical mood each place gets (Music brief and founder feedback):
// learning is calm (no kick, at most a soft bass pulse), Home is bright and
// Treasure dreamy (both light), and the games are driving (energetic). Pure, tested.
import type { ThemeMood } from "./schema";

const GAMES = ["/arcade", "/play", "/games"];

export function moodForPath(pathname: string): ThemeMood {
  if (pathname.startsWith("/treasure")) return "dreamy";
  if (GAMES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "driving";
  if (pathname === "/home" || pathname === "/" || pathname.startsWith("/home/")) return "bright";
  // Learn, the quest map, questions, done pages, Me, Talk, papers and the Studio.
  return "calm";
}
