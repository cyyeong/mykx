// Signed turns (docs/prd/SYNAPSE.md §4.3). Every AI reply a kid can flag carries a token: an HMAC over the kid, the
// agent and versions, and a hash of the exact text shown. When the kid flags it, the browser sends the text back
// with the token; the server checks both, so the case is exactly what the kid saw and nothing was stored before the
// kid chose to report it. Server only (node:crypto).
import { createHash } from "node:crypto";
import { sessionSecret, signToken, verifyToken } from "../auth/tokens.ts";
import type { Surface } from "./types.ts";

const LABEL = "synapse-turn";
/** A turn can be reported for a day after it was shown. */
export const TURN_TTL_MS = 24 * 60 * 60 * 1000;

export interface Turn {
  v: 1;
  surface: Surface;
  kid: string;
  agent: string | null;
  agentVersion: number | null;
  packId: string | null;
  packVersion: string | null;
  itemId: string | null;
  level: string | null;
  subject: string | null;
  stage: string | null;
  species: string | null;
  petStage: number | null;
  sections: string[];
  /** sha256 of the text shown, and of what the kid asked (null when there was nothing typed). */
  hash: string;
  askHash: string | null;
  at: string;
}

/** Whitespace-normalised sha256, so a reflowed copy of the same words still matches. */
export function textHash(text: string): string {
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("base64url");
}

export type TurnFields = Omit<Turn, "v" | "hash" | "askHash" | "at"> & { shown: string; ask?: string | null; at?: string };

/** The token for a reply, or null when the server has no signing key (production without KID_SESSION_SECRET). */
export function signTurn(f: TurnFields): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const { shown, ask, at, ...rest } = f;
  const turn: Turn = { v: 1, ...rest, hash: textHash(shown), askHash: ask ? textHash(ask) : null, at: at ?? new Date().toISOString() };
  return signToken(LABEL, turn, secret);
}

export type TurnCheck = { ok: true; turn: Turn } | { ok: false; reason: "signature" | "other-kid" | "text" | "expired" | "no-secret" };

/** Checks a reported turn: our signature, this kid, the same words, and not older than a day. */
export function checkTurn(token: string, o: { kidId: string; shown: string; ask?: string | null; now?: number }): TurnCheck {
  const secret = sessionSecret();
  if (!secret) return { ok: false, reason: "no-secret" };
  const v = verifyToken<Turn>(LABEL, token, secret);
  if (!v.ok || v.payload.v !== 1) return { ok: false, reason: "signature" };
  const turn = v.payload;
  if (turn.kid !== o.kidId) return { ok: false, reason: "other-kid" };
  if (textHash(o.shown) !== turn.hash) return { ok: false, reason: "text" };
  if (turn.askHash && (!o.ask || textHash(o.ask) !== turn.askHash)) return { ok: false, reason: "text" };
  if ((o.now ?? Date.now()) - Date.parse(turn.at) > TURN_TTL_MS) return { ok: false, reason: "expired" };
  return { ok: true, turn };
}

/** What a route sends with a reply so the kid can flag it: the token and the exact words it covers. */
export interface Flag {
  token: string;
  shown: string;
  ask: string | null;
}

export function flagFor(f: TurnFields): Flag | null {
  const token = signTurn(f);
  return token ? { token, shown: f.shown, ask: f.ask ?? null } : null;
}
