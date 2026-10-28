// Home Link's settings file and the rules a camera must pass before it is saved (docs/prd/GUARDIAN.md §2.2).
// Camera addresses may hold a password, so they live only in this file (mode 600) and are masked everywhere else.
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const MAX_CAMERAS = 10;
export const INTERVAL_MIN_SEC = 10;
export const INTERVAL_MAX_SEC = 600;
export const INTERVAL_DEFAULT_SEC = 60;
export const DEFAULT_SERVER = "https://mykx.vercel.app";

export interface CameraConfig {
  key: string;
  room: string;
  /** A snapshot address (http or https) or an RTSP address. May hold a user name and password: never log or send it. */
  url: string;
  intervalSec: number;
  enabled: boolean;
  /** "This camera doesn't see a bathroom or any bedroom…": without it the camera is not saved. */
  privacyConfirmed: boolean;
}

export interface Config {
  server: string;
  /** The device token from pairing, shown once by myKx. */
  token: string | null;
  deviceName: string | null;
  cameras: CameraConfig[];
}

export const emptyConfig = (server = DEFAULT_SERVER): Config => ({ server, token: null, deviceName: null, cameras: [] });

/**
 * No camera may look at a bathroom or any bedroom (founder, 28 Oct; rule 15). The same words myKx refuses on its
 * side (lib/home-watch/home-watch.ts `forbiddenRoom`); config.test.ts pins the two together.
 */
export function forbiddenRoom(room: string): boolean {
  return /bed\s?room|bath|toilet|washroom|shower|wc\b|changing/i.test(room);
}

export const configDir = (): string => process.env.MYKX_HOME_LINK_DIR || join(homedir(), ".mykx-home-link");
export const configPath = (dir = configDir()): string => join(dir, "config.json");

export type Source = "snapshot" | "rtsp";

export function sourceOf(url: string): Source {
  return /^rtsps?:\/\//i.test(url) ? "rtsp" : "snapshot";
}

/** `rtsp://admin:secret@host/path` shown as `rtsp://••••@host/path`; secret-looking query values are masked too. */
export function maskUrl(url: string): string {
  const noUser = url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/?#]*@/i, "$1••••@");
  return noUser.replace(/([?&;])(pass(?:word)?|pwd|pw|token|key|secret|auth|sig|signature|user(?:name)?|usr|login)=[^&#;]*/gi, "$1$2=••••");
}

/** Every secret in an address, to scrub text that might echo it (an ffmpeg error, say). */
export function secretsOf(url: string): string[] {
  const out = new Set<string>();
  try {
    const u = new URL(url);
    for (const v of [u.username, u.password]) if (v) out.add(v);
    for (const v of [u.username, u.password]) if (v) out.add(safeDecode(v));
    for (const [k, v] of u.searchParams) if (v && /pass|pwd|token|key|secret|auth|sig|user|login/i.test(k)) out.add(v);
  } catch {
    // Not a parseable address: nothing more to scrub than the whole thing.
  }
  out.add(url);
  return [...out].filter((s) => s.length >= 3 || s === url);
}

/** Replaces every secret from `url` in `text` (and the whole address) with the masked address. */
export function redact(text: string, url: string): string {
  let out = text;
  for (const s of secretsOf(url).sort((a, b) => b.length - a.length)) out = out.split(s).join(s === url ? maskUrl(url) : "••••");
  return out;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The address without its user name and password, and the Basic header to send instead. Never put the password in the fetched URL. */
export function splitCredentials(url: string): { url: string; authorization: string | null } {
  const u = new URL(url);
  const user = safeDecode(u.username);
  const pass = safeDecode(u.password);
  u.username = "";
  u.password = "";
  return { url: u.toString(), authorization: user || pass ? `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` : null };
}

export type CameraField = "room" | "url" | "intervalSec" | "privacyConfirmed" | "cameras";
export type Checked = { ok: true; camera: CameraConfig } | { ok: false; field: CameraField; message: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** A short, unique, URL-safe key from the room name; it stays the same if the room is renamed later. */
export function newKey(room: string, cameras: readonly Pick<CameraConfig, "key">[]): string {
  const base = room.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "camera";
  const taken = new Set(cameras.map((c) => c.key));
  for (let n = 1; ; n++) {
    const key = n === 1 ? base : `${base}-${n}`;
    if (!taken.has(key)) return key;
  }
}

export function checkUrl(raw: unknown): { ok: true; url: string } | { ok: false; message: string } {
  const url = typeof raw === "string" ? raw.trim() : "";
  if (!url) return { ok: false, message: "Paste the camera's address." };
  if (url.length > 600 || /[\u0000-\u001f\s]/.test(url)) return { ok: false, message: "That address doesn't look right. It can't contain spaces." };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, message: "That address doesn't look right. It should start with http://, https:// or rtsp://." };
  }
  if (!/^(https?|rtsps?):$/.test(parsed.protocol) || !parsed.hostname) return { ok: false, message: "Use a snapshot address (http:// or https://) or an RTSP address (rtsp://)." };
  return { ok: true, url };
}

/**
 * Checks a camera from the settings page (or an edited config). `input.key` names an existing camera to change; without
 * it a new one is made. A change may leave `url` out to keep the saved address (and its password).
 */
export function validateCamera(input: unknown, cameras: readonly CameraConfig[]): Checked {
  if (!isObject(input)) return { ok: false, field: "room", message: "Something went wrong with that form. Reload the page and try again." };
  const existing = typeof input.key === "string" ? cameras.find((c) => c.key === input.key) : undefined;
  if (typeof input.key === "string" && !existing) return { ok: false, field: "cameras", message: "That camera isn't saved any more. Reload the page." };
  if (!existing && cameras.length >= MAX_CAMERAS) return { ok: false, field: "cameras", message: `Home Link takes up to ${MAX_CAMERAS} cameras. Remove one first.` };

  const room = typeof input.room === "string" ? input.room.trim().replace(/\s+/g, " ") : "";
  if (!room) return { ok: false, field: "room", message: "Choose which room this camera is in." };
  if (room.length > 40) return { ok: false, field: "room", message: "Keep the room name to 40 letters or fewer." };
  if (forbiddenRoom(room)) return { ok: false, field: "room", message: "No camera may look at a bathroom or any bedroom. Pick another room." };

  let url = existing?.url ?? "";
  if (input.url !== undefined && input.url !== null && input.url !== "") {
    const checked = checkUrl(input.url);
    if (!checked.ok) return { ok: false, field: "url", message: checked.message };
    url = checked.url;
  } else if (!existing) {
    return { ok: false, field: "url", message: "Paste the camera's address." };
  }

  const interval = input.intervalSec === undefined ? existing?.intervalSec ?? INTERVAL_DEFAULT_SEC : input.intervalSec;
  if (typeof interval !== "number" || !Number.isFinite(interval) || interval < INTERVAL_MIN_SEC || interval > INTERVAL_MAX_SEC) {
    return { ok: false, field: "intervalSec", message: "Check every 10 seconds to 10 minutes." };
  }

  if (input.privacyConfirmed !== true) {
    return { ok: false, field: "privacyConfirmed", message: "Tick the box to confirm where this camera looks. Home Link doesn't save a camera without it." };
  }

  return {
    ok: true,
    camera: {
      key: existing?.key ?? newKey(room, cameras),
      room,
      url,
      intervalSec: Math.round(interval),
      enabled: input.enabled === undefined ? existing?.enabled ?? true : input.enabled === true,
      privacyConfirmed: true,
    },
  };
}

export interface Loaded {
  config: Config;
  /** Plain-words notes about anything skipped while reading the file. */
  warnings: string[];
}

/** Reads the settings file. A missing file is a fresh start; a camera that fails today's rules is skipped, with a note. */
export function loadConfig(dir = configDir(), defaultServer = DEFAULT_SERVER): Loaded {
  const file = configPath(dir);
  const config = emptyConfig(defaultServer);
  const warnings: string[] = [];
  if (!existsSync(file)) return { config, warnings };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { config, warnings: [`The settings file ${file} couldn't be read, so Home Link started fresh. Fix or delete it.`] };
  }
  if (!isObject(raw)) return { config, warnings: [`The settings file ${file} isn't what Home Link expects, so it started fresh.`] };
  if (typeof raw.server === "string" && /^https?:\/\//.test(raw.server)) config.server = raw.server;
  if (typeof raw.token === "string" && raw.token) config.token = raw.token;
  if (typeof raw.deviceName === "string") config.deviceName = raw.deviceName.slice(0, 60);
  for (const item of Array.isArray(raw.cameras) ? raw.cameras : []) {
    const name = isObject(item) && typeof item.room === "string" ? item.room.slice(0, 40) : "A camera";
    const checked = validateCamera(isObject(item) ? { ...item, key: undefined } : item, []);
    const key = isObject(item) ? item.key : undefined;
    if (!checked.ok || typeof key !== "string" || !/^[\w-]{1,40}$/.test(key) || config.cameras.some((c) => c.key === key)) {
      warnings.push(`Skipped “${name}”: ${checked.ok ? "its key is missing or repeated" : checked.message} Add it again from the settings page.`);
      continue;
    }
    if (config.cameras.length >= MAX_CAMERAS) {
      warnings.push(`Skipped “${name}”: Home Link takes up to ${MAX_CAMERAS} cameras.`);
      continue;
    }
    config.cameras.push({ ...checked.camera, key });
  }
  return { config, warnings };
}

/** Writes the settings file atomically, readable only by this user. */
export function saveConfig(config: Config, dir = configDir()): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = configPath(dir);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, file);
}

/** What the settings page may see of a camera: never the address with its password. */
export interface PublicCamera {
  key: string;
  room: string;
  source: Source;
  address: string;
  intervalSec: number;
  enabled: boolean;
  privacyConfirmed: boolean;
}

export function publicCamera(c: CameraConfig): PublicCamera {
  return { key: c.key, room: c.room, source: sourceOf(c.url), address: maskUrl(c.url), intervalSec: c.intervalSec, enabled: c.enabled, privacyConfirmed: c.privacyConfirmed };
}

/** myKx's address for the "Sending to …" line: the host only. */
export function hostOf(server: string): string {
  try {
    return new URL(server).host;
  } catch {
    return server;
  }
}

/** HTTPS everywhere except this computer, so the device token never crosses a network in the clear. */
export function checkServer(raw: unknown): { ok: true; server: string } | { ok: false; message: string } {
  const text = typeof raw === "string" ? raw.trim().replace(/\/+$/, "") : "";
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, message: "That server address doesn't look right. It should look like https://mykx.vercel.app." };
  }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return { ok: false, message: "Use an https:// address. Plain http:// is only allowed for this computer (localhost)." };
  if (u.username || u.password || u.search || u.hash || (u.pathname !== "/" && u.pathname !== "")) return { ok: false, message: "Use just the site address, like https://mykx.vercel.app." };
  return { ok: true, server: u.origin };
}
