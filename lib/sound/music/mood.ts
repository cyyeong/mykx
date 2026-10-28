// Which musical mood each place gets (Music brief): calm for learning,
// dreamy for Treasure, bright for Home, driving for the Arcade. Pure, tested.
import type { ThemeMood } from "./schema";

export function moodForPath(pathname: string): ThemeMood {
  if (pathname.startsWith("/treasure")) return "dreamy";
  if (pathname.startsWith("/arcade")) return "driving";
  if (pathname === "/home" || pathname === "/" || pathname.startsWith("/home/")) return "bright";
  return "calm";
}
