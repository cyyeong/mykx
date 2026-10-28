// Talking to myKx (app/api/home/pair|cameras|frames). The device token goes in an Authorization header and nowhere
// else; camera addresses and passwords never come in here at all.
import { checkServer } from "./config.ts";

export interface Device {
  id: string;
  name: string;
  kind: string;
}

type Failure = { ok: false; kind: "wrong" | "slow-down" | "invalid" | "revoked" | "network" | "error"; status: number; message: string; retryAfterSec?: number };
export type PairResult = { ok: true; token: string; device: Device } | Failure;
export type SyncResult = { ok: true } | (Failure & { refusedRoom?: boolean });

export interface Frame {
  camera: string;
  /** ISO time the picture was taken. */
  at: string;
  /** 0 for a single picture; 0, 1, 2 within a burst of three. */
  burst: number;
  bytes: Uint8Array;
}

export interface ReadStatus {
  camera: string;
  activity: string;
  cue: string | null;
  concern: string;
  reason: string;
  source: string;
}

export type SendResult =
  | { kind: "accepted"; accepted: number; read: string | null; statuses: ReadStatus[]; alerts: { camera: string; level: string; kind: string }[] }
  | { kind: "off" }
  | { kind: "revoked" }
  | { kind: "slow-down"; retryAfterSec: number | null }
  | { kind: "skipped"; status: number; reason: string }
  | { kind: "network"; message: string };

export interface Net {
  fetch?: typeof fetch;
  timeoutMs?: number;
}

interface Reply {
  status: number;
  body: Record<string, unknown> | null;
}

async function call(server: string, path: string, init: RequestInit, net: Net): Promise<Reply | { network: string }> {
  try {
    const res = await (net.fetch ?? fetch)(`${server}${path}`, { ...init, redirect: "error", signal: AbortSignal.timeout(net.timeoutMs ?? 30_000) });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { status: res.status, body: body && typeof body === "object" ? body : null };
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return { network: timedOut ? "myKx didn't answer in time." : "Can't reach myKx." };
  }
}

const isNetwork = (r: Reply | { network: string }): r is { network: string } => "network" in r;
const reasonOf = (r: Reply): string => (typeof r.body?.reason === "string" ? r.body.reason : "");
const retryOf = (r: Reply): number | null => (typeof r.body?.retryAfterSec === "number" && r.body.retryAfterSec > 0 ? r.body.retryAfterSec : null);

/** The parent's code looks like K7Q4-MZ2P. Spaces and dashes don't matter. */
export function cleanCode(input: string): string | null {
  const squashed = input.toUpperCase().replace(/[\s-]/g, "");
  if (!/^[0-9A-Z]{8}$/.test(squashed)) return null;
  return `${squashed.slice(0, 4)}-${squashed.slice(4)}`;
}

export async function pair(server: string, code: string, name: string, net: Net = {}): Promise<PairResult> {
  const checked = checkServer(server);
  if (!checked.ok) return { ok: false, kind: "invalid", status: 0, message: checked.message };
  const clean = cleanCode(code);
  if (!clean) return { ok: false, kind: "wrong", status: 0, message: "That code didn't work. It has 8 letters and numbers, like K7Q4-MZ2P." };
  const r = await call(checked.server, "/api/home/pair", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: clean, name: name.slice(0, 60) || "This computer" }) }, net);
  if (isNetwork(r)) return { ok: false, kind: "network", status: 0, message: `${r.network} Check the server address and your internet connection.` };
  if (r.status === 200 && r.body?.ok === true && typeof r.body.token === "string" && r.body.token.startsWith("hl_")) {
    const d = (r.body.device ?? {}) as Partial<Device>;
    return { ok: true, token: r.body.token, device: { id: String(d.id ?? ""), name: String(d.name ?? name), kind: String(d.kind ?? "home-link") } };
  }
  if (r.status === 401) return { ok: false, kind: "wrong", status: 401, message: "That code didn't work. It works once and runs out after 15 minutes." };
  if (r.status === 429) return { ok: false, kind: "slow-down", status: 429, retryAfterSec: retryOf(r) ?? 60, message: "Too many tries. Wait a minute, then try again." };
  return { ok: false, kind: "error", status: r.status, message: `myKx answered with an error (${r.status}). Check the server address.` };
}

/** Tells myKx which cameras this computer has (room names only). Cameras left out are switched off there. */
export async function syncCameras(server: string, token: string, cameras: { key: string; room: string; enabled: boolean }[], net: Net = {}): Promise<SyncResult> {
  const r = await call(server, "/api/home/cameras", { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ cameras }) }, net);
  if (isNetwork(r)) return { ok: false, kind: "network", status: 0, message: r.network };
  if (r.status === 200 && r.body?.ok === true) return { ok: true };
  if (r.status === 401) return { ok: false, kind: "revoked", status: 401, message: "This computer was removed in myKx; pair it again." };
  if (r.status === 429) return { ok: false, kind: "slow-down", status: 429, retryAfterSec: retryOf(r) ?? 60, message: "myKx asked Home Link to slow down." };
  if (r.status === 400 && reasonOf(r) === "not-allowed") return { ok: false, kind: "invalid", status: 400, refusedRoom: true, message: typeof r.body?.note === "string" ? r.body.note : "myKx doesn't allow that room." };
  return { ok: false, kind: "error", status: r.status, message: `myKx didn't take the camera list (${r.status} ${reasonOf(r)}).`.trim() };
}

/** The multipart body for one POST: a `meta` JSON part, then `frame0`, `frame1`… in the same order. */
export function buildFramesForm(frames: readonly Frame[]): FormData {
  const form = new FormData();
  form.set("meta", JSON.stringify({ frames: frames.map((f) => ({ camera: f.camera, at: f.at, burst: f.burst })) }));
  frames.forEach((f, i) => form.set(`frame${i}`, new File([f.bytes as Uint8Array<ArrayBuffer>], `frame${i}.jpg`, { type: "image/jpeg" })));
  return form;
}

export async function sendFrames(server: string, token: string, frames: readonly Frame[], net: Net = {}): Promise<SendResult> {
  const r = await call(server, "/api/home/frames", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: buildFramesForm(frames) }, { timeoutMs: 90_000, ...net });
  if (isNetwork(r)) return { kind: "network", message: r.network };
  if (r.status === 401) return { kind: "revoked" };
  if (r.status === 429) return { kind: "slow-down", retryAfterSec: retryOf(r) };
  if ((r.status === 200 || r.status === 202) && r.body?.ok === true) {
    if (r.body.camerasOn === false) return { kind: "off" };
    const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    return { kind: "accepted", accepted: Number(r.body.accepted ?? 0), read: typeof r.body.read === "string" ? r.body.read : null, statuses: list<ReadStatus>(r.body.statuses), alerts: list(r.body.alerts) };
  }
  return { kind: "skipped", status: r.status, reason: reasonOf(r) };
}
