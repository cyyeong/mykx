// In-memory demo store for `npm run dev` before Supabase keys exist. Seeded with the synthetic demo
// family (lib/auth/demo-family.ts). Any email and password opens the demo parent (the design preview);
// other@demo.mykx opens a second, non-admin family. Refuses to exist in a production build.
import { randomUUID } from "node:crypto";
import {
  DEMO_HOUSEHOLD_ID,
  DEMO_KIDS,
  DEMO_PARENT_EMAIL,
  DEMO_PARENT_ID,
  DEMO_PARENT_USER_ID,
  KAI_ID,
  KAI_SECRET_HASH,
  OTHER_HOUSEHOLD_ID,
  OTHER_PARENT_EMAIL,
  OTHER_PARENT_ID,
  OTHER_PARENT_USER_ID,
} from "./demo-family.ts";
import type { CookieJar } from "./http.ts";
import type { AuditEntry, AuthStore, AuthUser, Household, NewKid, Profile, ProfilePatch } from "./store.ts";
import { NicknameTakenError } from "./store.ts";
import { sessionSecret, signToken, verifyToken } from "./tokens.ts";

export const DEMO_PARENT_COOKIE = "mykx_demo_parent";
const DEMO_TTL_SEC = 7 * 24 * 60 * 60;
const LABEL = "demo-parent";

export class DemoModeInProductionError extends Error {
  constructor() {
    super("The in-memory demo accounts store can't run in production.");
    this.name = "DemoModeInProductionError";
  }
}

function assertNotProduction() {
  // Literal process.env.NODE_ENV: Next inlines it at build time, so a production bundle always throws.
  if (process.env.NODE_ENV === "production") throw new DemoModeInProductionError();
}

const nowIso = () => new Date().toISOString();

function profile(p: Partial<Profile> & Pick<Profile, "id" | "householdId" | "role" | "nickname">): Profile {
  return {
    userId: null,
    isAdmin: false,
    band: null,
    level: null,
    pack: null,
    voiceEnabled: false,
    dailyLimitMin: null,
    synthetic: true,
    secretKind: null,
    secretHash: null,
    secretSetAt: null,
    secretEvent: null,
    failedAttempts: 0,
    lockedUntil: null,
    disabledAt: null,
    lastSignInAt: null,
    createdAt: nowIso(),
    ...p,
  };
}

interface DemoPayload {
  u: string;
  g: number; // generation: "sign out everywhere" bumps it
  exp: number;
}

export class DemoStore implements AuthStore {
  readonly mode = "demo" as const;
  readonly households = new Map<string, Household>();
  readonly profiles = new Map<string, Profile>();
  readonly auditLog: (AuditEntry & { createdAt: string })[] = [];
  private readonly emails = new Map<string, string>(); // auth user id → email
  private readonly banned = new Set<string>();
  private readonly generation = new Map<string, number>();

  constructor() {
    assertNotProduction();
    const created = nowIso();
    this.households.set(DEMO_HOUSEHOLD_ID, { id: DEMO_HOUSEHOLD_ID, name: "Demo family" });
    this.households.set(OTHER_HOUSEHOLD_ID, { id: OTHER_HOUSEHOLD_ID, name: "Other demo family" });
    this.emails.set(DEMO_PARENT_USER_ID, DEMO_PARENT_EMAIL);
    this.emails.set(OTHER_PARENT_USER_ID, OTHER_PARENT_EMAIL);
    const rows: Profile[] = [
      profile({ id: DEMO_PARENT_ID, householdId: DEMO_HOUSEHOLD_ID, userId: DEMO_PARENT_USER_ID, role: "parent", isAdmin: true, nickname: "Demo Parent" }),
      ...DEMO_KIDS.map((k) =>
        profile({
          id: k.id,
          householdId: DEMO_HOUSEHOLD_ID,
          role: "child",
          nickname: k.nickname,
          band: k.band,
          level: k.level,
          pack: k.pack,
          voiceEnabled: k.voiceEnabled,
          dailyLimitMin: k.dailyLimitMin,
          secretKind: k.secretKind,
          secretHash: k.secretHash,
          secretSetAt: created,
          secretEvent: "set",
        }),
      ),
      profile({ id: OTHER_PARENT_ID, householdId: OTHER_HOUSEHOLD_ID, userId: OTHER_PARENT_USER_ID, role: "parent", nickname: "Other Parent" }),
      profile({
        id: KAI_ID,
        householdId: OTHER_HOUSEHOLD_ID,
        role: "child",
        nickname: "Kai",
        band: "junior",
        level: "P3",
        pack: "toon-pop",
        secretKind: "pictures",
        secretHash: KAI_SECRET_HASH,
        secretSetAt: created,
        secretEvent: "set",
      }),
    ];
    for (const r of rows) this.profiles.set(r.id, r);
  }

  private secret(): Buffer {
    const s = sessionSecret();
    if (!s) throw new DemoModeInProductionError();
    return s;
  }

  // Sessions

  async signInParent(jar: CookieJar, email: string, password: string): Promise<AuthUser | null> {
    assertNotProduction();
    if (!email.trim() || !password) return null;
    const wanted = email.trim().toLowerCase();
    const userId = [...this.emails].find(([, e]) => e === wanted)?.[0] ?? DEMO_PARENT_USER_ID;
    if (this.banned.has(userId)) return null;
    const payload: DemoPayload = { u: userId, g: this.generation.get(userId) ?? 0, exp: Math.floor(Date.now() / 1000) + DEMO_TTL_SEC };
    jar.set(DEMO_PARENT_COOKIE, signToken(LABEL, payload, this.secret()), { httpOnly: true, sameSite: "lax", secure: false, path: "/", maxAge: DEMO_TTL_SEC });
    return { userId, email: this.emails.get(userId) ?? null };
  }

  async currentUser(jar: CookieJar): Promise<AuthUser | null> {
    assertNotProduction();
    const checked = verifyToken<DemoPayload>(LABEL, jar.get(DEMO_PARENT_COOKIE), this.secret());
    if (!checked.ok) return null;
    const { u, g, exp } = checked.payload;
    if (typeof u !== "string" || typeof exp !== "number" || exp <= Date.now() / 1000) return null;
    if ((this.generation.get(u) ?? 0) !== g || this.banned.has(u)) return null;
    return { userId: u, email: this.emails.get(u) ?? null };
  }

  async signOutParent(jar: CookieJar, everywhere: boolean): Promise<void> {
    if (everywhere) {
      const user = await this.currentUser(jar);
      if (user) this.generation.set(user.userId, (this.generation.get(user.userId) ?? 0) + 1);
    }
    jar.delete(DEMO_PARENT_COOKIE);
  }

  async sendPasswordReset(): Promise<void> {
    // Demo mode sends no email.
  }

  // Household-scoped

  async profileByUserId(userId: string) {
    return [...this.profiles.values()].find((p) => p.userId === userId) ?? null;
  }

  async household(householdId: string) {
    return this.households.get(householdId) ?? null;
  }

  async kids(householdId: string) {
    return [...this.profiles.values()]
      .filter((p) => p.householdId === householdId && p.role === "child")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  async kid(householdId: string, kidId: string) {
    const p = this.profiles.get(kidId);
    return p && p.householdId === householdId && p.role === "child" ? p : null;
  }

  private checkNickname(householdId: string, nickname: string, exceptId?: string) {
    const lower = nickname.toLowerCase();
    for (const p of this.profiles.values()) {
      if (p.householdId === householdId && p.id !== exceptId && p.nickname.toLowerCase() === lower) throw new NicknameTakenError();
    }
  }

  private apply(p: Profile, patch: ProfilePatch): Profile {
    if (patch.nickname !== undefined) this.checkNickname(p.householdId, patch.nickname, p.id);
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const next = { ...p, ...defined };
    this.profiles.set(p.id, next);
    return next;
  }

  async update(householdId: string, profileId: string, patch: ProfilePatch) {
    const p = this.profiles.get(profileId);
    if (!p || p.householdId !== householdId) return null;
    return this.apply(p, patch);
  }

  async addKid(householdId: string, kid: NewKid) {
    this.checkNickname(householdId, kid.nickname);
    const row = profile({ id: randomUUID(), householdId, role: "child", synthetic: false, ...kid });
    this.profiles.set(row.id, row);
    return row;
  }

  async removeKid(householdId: string, kidId: string) {
    const p = await this.kid(householdId, kidId);
    return p ? this.profiles.delete(kidId) : false;
  }

  async audit(entry: AuditEntry) {
    this.auditLog.push({ ...entry, createdAt: nowIso() });
  }

  // Admin

  readonly admin = {
    search: async (q: string, limit: number) => {
      const needle = q.trim().toLowerCase();
      const all = [...this.profiles.values()];
      const hit = new Set<string>();
      for (const h of this.households.values()) if (!needle || h.name.toLowerCase().includes(needle) || h.id === needle) hit.add(h.id);
      for (const p of all) {
        const email = p.userId ? this.emails.get(p.userId) : undefined;
        if (needle && (p.nickname.toLowerCase().includes(needle) || p.id === needle || (email && email.includes(needle)))) hit.add(p.householdId);
      }
      return [...hit].slice(0, limit).map((id) => ({
        household: this.households.get(id)!,
        people: all.filter((p) => p.householdId === id).sort((a, b) => (a.role === b.role ? a.nickname.localeCompare(b.nickname) : a.role === "parent" ? -1 : 1)),
      }));
    },
    profile: async (profileId: string) => this.profiles.get(profileId) ?? null,
    update: async (profileId: string, patch: ProfilePatch) => {
      const p = this.profiles.get(profileId);
      return p ? this.apply(p, patch) : null;
    },
    emails: async (userIds: string[]) => new Map(userIds.flatMap((id) => (this.emails.has(id) ? [[id, this.emails.get(id)!] as const] : []))),
    setBanned: async (userId: string, banned: boolean) => {
      if (banned) this.banned.add(userId);
      else this.banned.delete(userId);
    },
  };
}

const g = globalThis as typeof globalThis & { __mykxDemoStore?: DemoStore };

/** One demo store per server process (shared across route bundles and hot reloads). */
export function demoStore(): DemoStore {
  assertNotProduction();
  return (g.__mykxDemoStore ??= new DemoStore());
}

/** Tests only: a fresh demo family. */
export function resetDemoStore(): DemoStore {
  g.__mykxDemoStore = new DemoStore();
  return g.__mykxDemoStore;
}
