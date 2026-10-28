// What GET /api/home returns (app/api/home/route.ts), for Home now.
import type { HomeAlert, HomeCamera, HomeStatus } from "@/lib/home-watch/home-watch";

export interface HomeData {
  kids: { id: string; nickname: string; pack: string | null }[];
  camerasOn: boolean;
  pausedUntil: string | null;
  schedule: { days: number[]; from: string; to: string };
  devices: { id: string; name: string; kind: "home-link" | "simulator"; paired: boolean; lastSeenAt: string | null }[];
  rooms: { camera: HomeCamera; latest: HomeStatus | null; offline: boolean }[];
  today: { cameraId: string; at: string; activity: string; people: string[]; cue: string | null }[];
  alerts: (HomeAlert & { frames: string[] })[];
}

export const KIND_WHY: Record<string, string> = {
  hazard: "A hazard like this needs only one check.",
  conflict: "Possible conflict. Play-fighting can look like this.",
  arguing: "Arguing seen three times in ten minutes.",
  crying: "A child looked upset in two checks, five minutes apart.",
  muse: "Muse Spark wasn’t sure and thought you’d want a look.",
};
export const KIND_TITLE: Record<string, string> = { hazard: "a hazard", conflict: "a possible conflict", arguing: "arguing", crying: "a child who may be upset", muse: "something to check" };

export interface Stretch {
  cameraId: string;
  from: string;
  to: string;
  activity: string;
  people: string[];
}

/** Rolls the day's readings into stretches: the same room, activity and people in a row become one line. */
export function stretches(today: HomeData["today"]): Stretch[] {
  const out: Stretch[] = [];
  for (const s of [...today].sort((a, b) => a.at.localeCompare(b.at))) {
    const last = out[out.length - 1];
    const same = last && last.cameraId === s.cameraId && last.activity === s.activity && last.people.join() === s.people.join();
    if (same) last.to = s.at;
    else out.push({ cameraId: s.cameraId, from: s.at, to: s.at, activity: s.activity, people: s.people });
  }
  return out.filter((s) => s.activity !== "nobody here");
}
