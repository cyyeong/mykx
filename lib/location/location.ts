// Where they are (docs/prd/GUARDIAN.md §2.1): the kid's points, their motion, the parent's places and the
// battery modes. Pure and deterministic: a model never decides any of this (rule 5); the Guardian Brief only
// narrates it, from place names and times, never coordinates (§2.5).

export type Motion = "still" | "walking" | "running" | "cycling" | "vehicle" | "playing" | "unknown";
export type LocationSource = "web" | "android" | "sim";
export type LocationMode = "live" | "balanced" | "saver" | "school";
export type PlaceKind = "home" | "school" | "other";

export interface LocationPoint {
  at: string;
  lat: number;
  lng: number;
  accuracyM: number;
  /** Metres a second, from the phone when it has it. */
  speed: number | null;
  heading: number | null;
  /** Accelerometer variance over the last few seconds (m/s²)², from the phone; only the app or the simulator sends it. */
  activity?: number | null;
  battery: number | null;
}

export interface StoredPoint extends LocationPoint {
  kidId: string;
  motion: Motion;
  source: LocationSource;
}

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  radiusM: number;
}

export interface PlaceEvent {
  id: string;
  kidId: string;
  placeId: string;
  placeName: string;
  kind: "arrived" | "left";
  at: string;
}

export interface KidLocationSettings {
  kidId: string;
  enabled: boolean;
  mode: LocationMode;
  pausedUntil: string | null;
}

/** How often the phone sends (GUARDIAN §2.1). `distanceM` is the native plugin's filter; uploads are throttled to the seconds. */
export const MODES: Record<LocationMode, { label: string; movingSec: number; stillSec: number; distanceM: number }> = {
  live: { label: "Live", movingSec: 30, stillSec: 300, distanceM: 25 },
  balanced: { label: "Balanced", movingSec: 120, stillSec: 900, distanceM: 50 },
  saver: { label: "Saver", movingSec: 600, stillSec: 1800, distanceM: 100 },
  school: { label: "School hours", movingSec: 120, stillSec: 900, distanceM: 50 },
};

/** "School hours": weekdays from 13:00 to 19:00 Singapore time; off otherwise. */
export function sharingNow(mode: LocationMode, now: Date): boolean {
  if (mode !== "school") return true;
  const sg = new Date(now.getTime() + 8 * 3_600_000);
  const day = sg.getUTCDay();
  const minutes = sg.getUTCHours() * 60 + sg.getUTCMinutes();
  return day >= 1 && day <= 5 && minutes >= 13 * 60 && minutes < 19 * 60;
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** High accelerometer variance while staying in one spot reads as "active in one place (maybe playing)". */
export const PLAYING_ACTIVITY = 4;
const PLAYING_SPREAD_M = 40;

/**
 * The motion state at `p`, from its speed (the phone's, or distance over time since the previous point) and, for
 * "playing", the accelerometer and how far the kid moved in the last five minutes. Thresholds are GUARDIAN §2.1's.
 * `recent` is the kid's earlier points, oldest first.
 */
export function motionOf(p: LocationPoint, recent: readonly LocationPoint[]): Motion {
  const prev = recent.length ? recent[recent.length - 1] : null;
  const t = Date.parse(p.at);
  const window = recent.filter((r) => t - Date.parse(r.at) <= 5 * 60_000);
  // Lively but staying put: most of the last three fixes (within ten minutes) are within 40 m of here. "Most", not
  // "all": GPS wobbles, and a kid who has just arrived still has the walk there in the window; on the Balanced mode
  // that reads as walking at first and as playing about four minutes after arriving.
  const lastFew = recent.filter((r) => t - Date.parse(r.at) <= 10 * 60_000).slice(-3);
  const near = lastFew.filter((r) => distanceM(r, p) < PLAYING_SPREAD_M).length;
  if ((p.activity ?? 0) >= PLAYING_ACTIVITY && near >= 1 && near > lastFew.length / 2) return "playing";
  let speed = p.speed;
  if (speed === null && prev) {
    const dt = (t - Date.parse(prev.at)) / 1000;
    if (dt > 0 && dt <= 20 * 60) speed = distanceM(prev, p) / dt;
  }
  if (speed === null) return "unknown";
  if (speed < 0.3) return "still";
  if (speed < 2.2) return "walking";
  if (speed < 4.5) return "running";
  if (speed < 7) {
    // Cycling needs a minute of it: one fast fix between walking ones is more likely a GPS jump.
    const sustained = window.some((r) => t - Date.parse(r.at) >= 60_000 && (r.speed ?? 0) >= 4.5);
    return sustained || (prev && (prev.speed ?? 0) >= 4.5) ? "cycling" : "running";
  }
  return "vehicle";
}

/** The place a point is in (nearest centre when two overlap), allowing for the fix's accuracy up to 50 m. */
export function placeAt(p: { lat: number; lng: number; accuracyM: number }, places: readonly Place[]): Place | null {
  let best: { place: Place; d: number } | null = null;
  for (const place of places) {
    const d = distanceM(p, place);
    if (d <= place.radiusM + Math.min(p.accuracyM, 50) && (!best || d < best.d)) best = { place, d };
  }
  return best?.place ?? null;
}

/** Arrived and left events as a kid moves from `last` (their latest stored point) through `points`, oldest first. */
export function placeEvents(kidId: string, last: { lat: number; lng: number; accuracyM: number } | null, points: readonly LocationPoint[], places: readonly Place[]): Omit<PlaceEvent, "id">[] {
  const out: Omit<PlaceEvent, "id">[] = [];
  let here = last ? placeAt(last, places) : null;
  for (const p of points) {
    // A fix that's too vague to place anyone changes nothing.
    if (p.accuracyM > 150) continue;
    const now = placeAt(p, places);
    if (now?.id === here?.id) continue;
    if (here) out.push({ kidId, placeId: here.id, placeName: here.name, kind: "left", at: p.at });
    if (now) out.push({ kidId, placeId: now.id, placeName: now.name, kind: "arrived", at: p.at });
    here = now;
  }
  return out;
}

/** Plain words for the parent: "Possibly walking". */
export const MOTION_LABEL: Record<Motion, string> = {
  still: "Still",
  walking: "Possibly walking",
  running: "Possibly running",
  cycling: "Possibly cycling",
  vehicle: "Possibly in a vehicle",
  playing: "Possibly playing (lots of movement in one spot)",
  unknown: "Not sure",
};

/** Points are kept 30 days (GUARDIAN §2.1). */
export const KEEP_POINTS_DAYS = 30;
