// Which accounts store runs, who is signed in on this device, and the wrapper every auth route uses.
//   supabase: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY + SUPABASE_SECRET_KEY set.
//   demo:     none of them set, and not a production build (in-memory synthetic family).
//   off:      anything else; routes answer 503 { ok: false, reason: "not-configured" }.
import { KID_COOKIE, verifyKidSession } from "./kid-session.ts";
import { lockRemainingSec } from "./lockout.ts";
import { fail, RequestCookieJar, type CookieJar } from "./http.ts";
import type { AccountStatus, Door, FamilyKid, KidMe } from "./schemas.ts";
import { demoStore } from "./store-demo.ts";
import { SupabaseStore, type SupabaseEnv } from "./store-supabase.ts";
import type { AuthStore, AuthUser, Profile } from "./store.ts";
import { sessionSecret } from "./tokens.ts";

export type AuthMode = "supabase" | "demo" | "off";
type Env = Record<string, string | undefined>;

function supabaseEnv(env: Env): { complete: SupabaseEnv | null; any: boolean } {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  const secretKey = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  return { complete: url && publishableKey && secretKey ? { url, publishableKey, secretKey } : null, any: Boolean(url || publishableKey || secretKey) };
}

export function authMode(env: Env = process.env): AuthMode {
  const supabase = supabaseEnv(env);
  if (supabase.complete) return "supabase";
  // Literal process.env.NODE_ENV is inlined by Next at build time: a production build never gets "demo".
  if (process.env.NODE_ENV === "production" || env.NODE_ENV === "production") return "off";
  return supabase.any ? "off" : "demo"; // half-configured Supabase is an error, not a demo
}

let cached: { key: string; store: SupabaseStore } | null = null;

/** The store for this server, or null when accounts aren't configured. */
export function getStore(env: Env = process.env): AuthStore | null {
  const mode = authMode(env);
  if (mode === "demo") return demoStore();
  if (mode !== "supabase") return null;
  const cfg = supabaseEnv(env).complete!;
  const key = `${cfg.url}|${cfg.publishableKey.length}|${cfg.secretKey.length}`;
  if (cached?.key !== key) cached = { key, store: new SupabaseStore(cfg) };
  return cached.store;
}

/** The signed-in grown-up with their profile. Null when signed out, without a profile, disabled or locked. */
export interface Parent {
  user: AuthUser;
  profile: Profile;
  householdId: string;
  isAdmin: boolean;
}

export async function currentParent(store: AuthStore, jar: CookieJar, now = Date.now()): Promise<Parent | null> {
  const user = await store.currentUser(jar);
  if (!user) return null;
  const profile = await store.profileByUserId(user.userId);
  if (!profile || profile.role !== "parent" || profile.disabledAt || lockRemainingSec(profile.lockedUntil, now) > 0) return null;
  return { user, profile, householdId: profile.householdId, isAdmin: profile.isAdmin };
}

/** The kid signed in on this device: valid cookie, bound to this parent, in the household, enabled. */
export async function currentKid(store: AuthStore, jar: CookieJar, parent: Parent | null, now = Date.now()): Promise<Profile | null> {
  const secret = sessionSecret();
  if (!parent || !secret) return null;
  const checked = verifyKidSession(jar.get(KID_COOKIE), { parentUserId: parent.user.userId, secret, now });
  if (!checked.ok || checked.session.householdId !== parent.householdId) return null;
  const kid = await store.kid(parent.householdId, checked.session.kidId);
  return kid && !kid.disabledAt ? kid : null;
}

export function grownUpLabel(parent: Parent): string {
  return parent.profile.nickname || parent.user.email || "a grown-up";
}

// Public shapes. Built field by field so a hash or lock counter can never ride along.

export function statusOf(p: Profile, now = Date.now()): AccountStatus {
  if (p.disabledAt) return "disabled";
  return lockRemainingSec(p.lockedUntil, now) > 0 ? "locked" : "active";
}

export function toDoor(p: Profile, now = Date.now()): Door {
  return {
    id: p.id,
    nickname: p.nickname,
    band: p.band!,
    pack: p.pack ?? "dreamlight",
    level: p.level!,
    secretKind: p.secretKind,
    needsSetup: !p.secretHash,
    locked: lockRemainingSec(p.lockedUntil, now) > 0,
  };
}

export function toKidMe(p: Profile): KidMe {
  return {
    id: p.id,
    nickname: p.nickname,
    band: p.band!,
    level: p.level!,
    pack: p.pack ?? "dreamlight",
    secretKind: p.secretKind,
    voiceEnabled: p.voiceEnabled,
    dailyLimitMin: p.dailyLimitMin,
    synthetic: p.synthetic,
  };
}

export function toFamilyKid(p: Profile, now = Date.now()): FamilyKid {
  return {
    id: p.id,
    nickname: p.nickname,
    level: p.level!,
    band: p.band!,
    pack: p.pack ?? "dreamlight",
    secretKind: p.secretKind,
    secretSetAt: p.secretSetAt,
    secretEvent: p.secretEvent,
    lastSignInAt: p.lastSignInAt,
    voiceEnabled: p.voiceEnabled,
    dailyLimitMin: p.dailyLimitMin,
    locked: lockRemainingSec(p.lockedUntil, now) > 0,
    needsSetup: !p.secretHash,
    disabled: Boolean(p.disabledAt),
    synthetic: p.synthetic,
  };
}

// Route wrapper

export interface RouteCtx {
  store: AuthStore;
  jar: RequestCookieJar;
  request: Request;
}

/**
 * Runs a route with the store and a cookie jar, writes queued cookies onto the reply, and turns
 * unexpected errors into a bare 500 (logged without bodies, cookies or secrets).
 */
export async function withAuth(request: Request, handler: (ctx: RouteCtx) => Promise<Response>): Promise<Response> {
  const jar = new RequestCookieJar(request);
  let store: AuthStore | null;
  try {
    store = getStore();
  } catch {
    store = null;
  }
  if (!store) return jar.apply(fail(503, "not-configured"));
  try {
    return jar.apply(await handler({ store, jar, request }));
  } catch (err) {
    // Store errors carry a code only (no row data); nothing from the body or cookies is logged.
    console.error(`[auth] ${new URL(request.url).pathname}: ${err instanceof Error ? `${err.name}: ${err.message.slice(0, 120)}` : "error"}`);
    return jar.apply(fail(500, "error"));
  }
}
