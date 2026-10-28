// Home watch (docs/prd/GUARDIAN.md §2.2): Home Link devices, their cameras, room statuses and alerts, and the
// family's Guardian preferences. Pairing codes and device tokens are made here and only their SHA-256 hashes are
// stored (a long random token needs no slow hash). Frames are never stored here: only words (AGENTS.md rule 15).
import { createHash, randomBytes } from "node:crypto";

export type DeviceKind = "home-link" | "simulator";
export type RoomKind = "living" | "kitchen" | "study" | "entrance" | "dining" | "other";
export type Concern = "none" | "watch" | "urgent";

export interface HomeDevice {
  id: string;
  householdId: string;
  name: string;
  kind: DeviceKind;
  createdAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  /** Paired once a client has swapped the code for a token. */
  paired: boolean;
  pairExpiresAt: string | null;
}

export interface HomeCamera {
  id: string;
  deviceId: string;
  key: string;
  room: string;
  roomKind: RoomKind;
  enabled: boolean;
  lastFrameAt: string | null;
  lastStatusAt: string | null;
}

/** One person the Home Reader saw, left to right. Adults never get a name or a cue (rule 15). */
export interface SeenPerson {
  who: "child" | "adult" | "unknown";
  /** A household kid's nickname, only from the parent's own descriptions; null otherwise. */
  likely: string | null;
  confidence: number;
  /** A child's visible behaviour ("crying", "smiling or laughing"…), never an inner feeling. */
  cue: string | null;
}

/** What the Home Reader saw in one camera's frame (lib/home-watch/reader.ts). Words only, never the picture. */
export interface RoomReading {
  people: SeenPerson[];
  activity: string;
  note: string;
  /** The room's most notable child cue, worked out by code from `people`. */
  cue: string | null;
  hazard: string;
  concern: Concern;
  reason: string;
  confidence: number;
  /** "live" from Muse Spark, or "cached" from an earlier live read of the same synthetic frame (rule 7). */
  source: "live" | "cached";
}

export interface HomeAlert {
  id: string;
  cameraId: string;
  at: string;
  level: "watch" | "urgent";
  kind: string;
  reason: string;
  confidence: number;
  framePaths: string[];
  framesExpireAt: string | null;
  verdict: "right" | "not-right" | null;
  seenAt: string | null;
}

/** Flagged frames live 24 h (rule 15). */
export const KEEP_FRAMES_MS = 24 * 3_600_000;

export interface HomeStatus {
  id: string;
  cameraId: string;
  at: string;
  reading: RoomReading;
}

export interface GuardianPrefs {
  homeArea: string;
  radiusKm: 1 | 3 | 5;
  interests: string[];
  /** ISO weekdays (1 = Monday) the cameras run, and the hours, Singapore time. */
  camDays: number[];
  camFrom: string;
  camTo: string;
  camsPausedUntil: string | null;
  /** The parent's own words for each kid, so the Home Reader can say "likely Ari" (no face templates). */
  descriptions: Record<string, string>;
}

export const DEFAULT_PREFS: GuardianPrefs = {
  homeArea: "Sengkang",
  radiusKm: 3,
  interests: ["badminton", "swimming", "cycling", "eating out"],
  camDays: [1, 2, 3, 4, 5],
  camFrom: "14:00",
  camTo: "19:00",
  camsPausedUntil: null,
  descriptions: {},
};

export const MAX_CAMERAS = 10;
/** A simulator device's daily frame budget: about $1 of Muse at worst (GUARDIAN §2.3). Home Link gets more. */
export const DAILY_FRAMES: Record<DeviceKind, number> = { simulator: 300, "home-link": 3000 };
export const PAIR_CODE_MINUTES = 15;
export const KEEP_STATUS_DAYS = 14;

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** An 8-character code the parent reads off the screen and types into Home Link: "K7Q4-MZ2P". */
export function newPairCode(): string {
  const bytes = randomBytes(8);
  const chars = [...bytes].map((b) => CROCKFORD[b % 32]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Codes are case-insensitive and forgiving: O reads as 0, I and L as 1, spaces and dashes are ignored. */
export function normalizePairCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

export function newDeviceToken(): string {
  return `hl_${randomBytes(32).toString("base64url")}`;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** The device token from `Authorization: Bearer hl_…`, or null. */
export function bearerToken(request: Request): string | null {
  const m = /^Bearer\s+(hl_[A-Za-z0-9_-]{40,60})$/.exec(request.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

const ROOM_WORDS: [RoomKind, RegExp][] = [
  ["living", /living|lounge|hall|family/i],
  ["kitchen", /kitchen/i],
  ["study", /study|desk|homework/i],
  ["entrance", /entrance|door|foyer|gate/i],
  ["dining", /dining/i],
];

export function roomKindOf(room: string): RoomKind {
  return ROOM_WORDS.find(([, re]) => re.test(room))?.[0] ?? "other";
}

/** No camera may look at a bathroom or any bedroom (founder, 28 Oct; rule 15). Home Link asks; the server refuses too. */
export function forbiddenRoom(room: string): boolean {
  return /bed\s?room|bath|toilet|washroom|shower|wc\b|changing/i.test(room);
}

/** Whether the cameras should run now (the parent's days and hours, Singapore time, unless paused). */
export function camerasOn(prefs: GuardianPrefs, now: Date): boolean {
  if (prefs.camsPausedUntil && Date.parse(prefs.camsPausedUntil) > now.getTime()) return false;
  const sg = new Date(now.getTime() + 8 * 3_600_000);
  const iso = sg.getUTCDay() === 0 ? 7 : sg.getUTCDay();
  const hhmm = `${String(sg.getUTCHours()).padStart(2, "0")}:${String(sg.getUTCMinutes()).padStart(2, "0")}`;
  return prefs.camDays.includes(iso) && hhmm >= prefs.camFrom && hhmm < prefs.camTo;
}

/** Singapore's calendar day, for the daily frame budget. */
export function sgDay(now: Date): string {
  return new Date(now.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
}

/** What an uploaded frame is, from its first bytes (JPEG, PNG or WebP), or null. */
export function imageKind(b: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}

/** Each kid's ring colour on the map and floor plan: their pack's accent (design system §2). */
export const PACK_COLOUR: Record<string, string> = { dreamlight: "#9B87F5", "anime-sky": "#1F66C1", "toon-pop": "#6A47F0", "idol-stage": "#FF3DCB", terrarium: "#2C7A47" };
export const packColour = (pack: string | null | undefined) => PACK_COLOUR[pack ?? ""] ?? "#1F66C1";

/** Dark or white text for a label on `hex`, whichever reads better (WCAG relative luminance). */
export function readableOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.3 ? "#1B2350" : "#FFFFFF";
}
