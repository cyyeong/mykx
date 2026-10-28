// What GET /api/location returns (app/api/location/route.ts), for the parent's map.
import type { KidLocationSettings, Motion, Place, PlaceEvent } from "@/lib/location/location";

export interface MapKid {
  id: string;
  nickname: string;
  band: "junior" | "teen" | null;
  pack: string | null;
  setting: KidLocationSettings;
  latest: { at: string; lat: number; lng: number; accuracyM: number; motion: Motion; battery: number | null; source: "web" | "android" | "sim" } | null;
  today: { at: string; lat: number; lng: number; accuracyM: number; motion: Motion }[];
  events: PlaceEvent[];
}
export interface WhereData {
  places: Place[];
  kids: MapKid[];
}
export interface Brief {
  text: string;
  source: "live" | "fallback";
  at: string;
}

/** "just now", "2 min ago", "1 h ago": the parent's own sense of how fresh a point is. */
export function agoLabel(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : "over a day ago";
}

/** How stale a point is: fine, amber after 15 minutes, grey after an hour (GUARDIAN §2.1). */
export function freshness(iso: string, now = Date.now()): "fresh" | "amber" | "grey" {
  const min = (now - Date.parse(iso)) / 60_000;
  return min > 60 ? "grey" : min > 15 ? "amber" : "fresh";
}

export const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false });
