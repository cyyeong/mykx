// Rolls a day's room readings into stretches: the same room, activity and people in a row become one line. Pure; used by
// Home now's timeline and by the evening summary.
export interface DayReading {
  cameraId: string;
  at: string;
  activity: string;
  people: string[];
  cue: string | null;
}

export interface Stretch {
  cameraId: string;
  from: string;
  to: string;
  activity: string;
  people: string[];
}

export function stretches(today: readonly DayReading[]): Stretch[] {
  const out: Stretch[] = [];
  for (const s of [...today].sort((a, b) => a.at.localeCompare(b.at))) {
    const last = out[out.length - 1];
    const same = last && last.cameraId === s.cameraId && last.activity === s.activity && last.people.join() === s.people.join();
    if (same) last.to = s.at;
    else out.push({ cameraId: s.cameraId, from: s.at, to: s.at, activity: s.activity, people: s.people });
  }
  return out.filter((s) => s.activity !== "nobody here");
}
