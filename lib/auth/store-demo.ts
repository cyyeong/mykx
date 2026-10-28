// In-memory demo store for `npm run dev` before Supabase keys exist. Seeded with the synthetic demo
// family (lib/auth/demo-family.ts). Any email and password opens the demo parent (the design preview);
// other@demo.mykx opens a second, non-admin family. Refuses to exist in a production build.
import { randomUUID } from "node:crypto";
import type { FocusMinute } from "../signals/focus.ts";
import type { FocusNote } from "../signals/schemas.ts";
import {
  ARI_ID,
  ARI_SAMPLE_FOCUS_NOTE,
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
import type { AttemptEvent } from "../domain/attempts.ts";
import type { LedgerEntry } from "../domain/rewards.ts";
import { sgDate } from "../domain/time.ts";
import type { CookieJar } from "./http.ts";
import type { AuditEntry, AuthStore, AuthUser, Household, NewFocusNote, NewKid, Profile, ProfilePatch, StoredAttempt } from "./store.ts";
import { NicknameTakenError } from "./store.ts";
import { sessionSecret, signToken, verifyToken } from "./tokens.ts";

export const DEMO_PARENT_COOKIE = "mykx_demo_parent";
/** Bump when the store's shape changes: a running dev server then rebuilds it on the next request (see demoStore). */
const DEMO_STORE_SHAPE = 5; // 5: parent PIN hash on profiles
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
    cameraEnabled: false,
    dailyLimitMin: null,
    synthetic: true,
    secretKind: null,
    secretHash: null,
    pinHash: null,
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

/** Yesterday at 4:12 pm Singapore time (UTC+8, no daylight saving), for Ari's sample focus note. */
function yesterdayAfternoonSg(now = Date.now()): number {
  const sg = new Date(now + 8 * 3_600_000);
  return Date.UTC(sg.getUTCFullYear(), sg.getUTCMonth(), sg.getUTCDate() - 1, 8, 12);
}

type StoredNote = FocusNote & { householdId: string };

type StoredLearnAttempt = StoredAttempt & { householdId: string; kidId: string };
type StoredLedgerEntry = LedgerEntry & { householdId: string; kidId: string };

interface DemoPayload {
  u: string;
  g: number; // generation: "sign out everywhere" bumps it
  exp: number;
}

export class DemoStore implements AuthStore {
  readonly mode = "demo" as const;
  readonly shape = DEMO_STORE_SHAPE;
  readonly households = new Map<string, Household>();
  readonly profiles = new Map<string, Profile>();
  readonly auditLog: (AuditEntry & { createdAt: string })[] = [];
  /** Camera minutes by `${kidId}|${minute ms}`: counts only. */
  readonly focusMinuteRows = new Map<string, { householdId: string; kidId: string; minute: FocusMinute }>();
  readonly focusNoteRows: StoredNote[] = [];
  /** Attempts by idempotency key: a resubmitted key is ignored. */
  readonly attemptRows = new Map<string, StoredLearnAttempt>();
  /** Ledger entries by entry key: a replay never pays twice. */
  readonly ledgerRows = new Map<string, StoredLedgerEntry>();
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
    const from = yesterdayAfternoonSg();
    this.focusNoteRows.push({
      ...ARI_SAMPLE_FOCUS_NOTE,
      householdId: DEMO_HOUSEHOLD_ID,
      kidId: ARI_ID,
      from: new Date(from).toISOString(),
      to: new Date(from + 3 * 60_000).toISOString(),
      synthetic: true,
    });
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
    if (!p) return false;
    // Same as the database's on delete cascade: their signals go with them.
    for (const [key, row] of this.focusMinuteRows) if (row.kidId === kidId) this.focusMinuteRows.delete(key);
    this.focusNoteRows.splice(0, this.focusNoteRows.length, ...this.focusNoteRows.filter((n) => n.kidId !== kidId));
    for (const [key, row] of this.attemptRows) if (row.kidId === kidId) this.attemptRows.delete(key);
    for (const [key, row] of this.ledgerRows) if (row.kidId === kidId) this.ledgerRows.delete(key);
    return this.profiles.delete(kidId);
  }

  async audit(entry: AuditEntry) {
    this.auditLog.push({ ...entry, createdAt: nowIso() });
  }

  // Wellbeing signals

  private ownsKid(householdId: string, kidId: string) {
    const p = this.profiles.get(kidId);
    return Boolean(p && p.householdId === householdId && p.role === "child");
  }

  // Learning record

  readonly learn = {
    attempts: async (householdId: string, kidId: string): Promise<AttemptEvent[]> => {
      return [...this.attemptRows.values()]
        .filter((r) => r.householdId === householdId && r.kidId === kidId)
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id))
        .map(toAttemptEvent);
    },
    attemptByKey: async (householdId: string, kidId: string, key: string): Promise<AttemptEvent | null> => {
      const row = this.attemptRows.get(key);
      if (!row || row.householdId !== householdId || row.kidId !== kidId) return null;
      return toAttemptEvent(row);
    },
    saveAttempt: async (householdId: string, kidId: string, attempt: StoredAttempt): Promise<void> => {
      if (!this.ownsKid(householdId, kidId)) return;
      if (this.attemptRows.has(attempt.idempotencyKey)) return; // offline resend: never twice
      this.attemptRows.set(attempt.idempotencyKey, { ...attempt, householdId, kidId });
    },
    ledger: async (householdId: string, kidId: string): Promise<LedgerEntry[]> => {
      return [...this.ledgerRows.values()]
        .filter((r) => r.householdId === householdId && r.kidId === kidId)
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
        .map((r) => ({
          // Storage keys are namespaced per kid; readers see the award key.
          key: stripKidPrefix(r.key, kidId),
          kind: r.kind,
          rule: r.rule,
          amount: r.amount,
          ...(r.ref !== undefined ? { ref: r.ref } : {}),
          at: r.at,
          day: r.day,
          ...(r.requested !== undefined ? { requested: r.requested } : {}),
          ...(r.note !== undefined ? { note: r.note } : {}),
        }));
    },
    saveLedgerEntries: async (householdId: string, kidId: string, entries: readonly LedgerEntry[]): Promise<void> => {
      if (!this.ownsKid(householdId, kidId)) return;
      for (const e of entries) {
        const storageKey = `${kidId}:${e.key}`;
        if (this.ledgerRows.has(storageKey)) continue; // replay: never pays twice
        this.ledgerRows.set(storageKey, { ...e, key: storageKey, householdId, kidId });
      }
    },
  };

  readonly signals = {
    saveFocusMinutes: async (householdId: string, kidId: string, minutes: readonly FocusMinute[]) => {
      if (!this.ownsKid(householdId, kidId)) return;
      for (const m of minutes) this.focusMinuteRows.set(`${kidId}|${Date.parse(m.minute)}`, { householdId, kidId, minute: { ...m } });
    },
    focusMinutes: async (householdId: string, kidId: string, sinceIso: string) => {
      const since = Date.parse(sinceIso);
      return [...this.focusMinuteRows.values()]
        .filter((r) => r.householdId === householdId && r.kidId === kidId && Date.parse(r.minute.minute) >= since)
        .map((r) => ({ ...r.minute }))
        .sort((a, b) => Date.parse(a.minute) - Date.parse(b.minute));
    },
    latestFocusNote: async (householdId: string, kidId: string) => {
      const mine = this.focusNoteRows.filter((n) => n.householdId === householdId && n.kidId === kidId);
      const latest = mine.sort((a, b) => Date.parse(b.from) - Date.parse(a.from))[0];
      return latest ? publicNote(latest) : null;
    },
    saveFocusNote: async (householdId: string, kidId: string, note: NewFocusNote) => {
      if (!this.ownsKid(householdId, kidId)) return null;
      if (this.focusNoteRows.some((n) => n.kidId === kidId && Date.parse(n.from) === Date.parse(note.from))) return null;
      const row: StoredNote = { id: randomUUID(), householdId, kidId, ...note, synthetic: false };
      this.focusNoteRows.push(row);
      return publicNote(row);
    },
    focusNotes: async (householdId: string, sinceIso: string) => {
      const since = Date.parse(sinceIso);
      return this.focusNoteRows
        .filter((n) => n.householdId === householdId && (n.synthetic || Date.parse(n.from) >= since))
        .sort((a, b) => Date.parse(b.from) - Date.parse(a.from))
        .map(publicNote);
    },
    removeFocusNote: async (householdId: string, noteId: string) => {
      const i = this.focusNoteRows.findIndex((n) => n.id === noteId && n.householdId === householdId);
      if (i < 0) return null;
      return this.focusNoteRows.splice(i, 1)[0].kidId;
    },
  };

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

function publicNote({ id, kidId, from, to, evidence, confidence, synthetic }: StoredNote): FocusNote {
  return { id, kidId, from, to, evidence, confidence, synthetic };
}

/** Strips one `${kidId}:` storage prefix back to the award key. */
function stripKidPrefix(storageKey: string, kidId: string): string {
  return storageKey.startsWith(`${kidId}:`) ? storageKey.slice(kidId.length + 1) : storageKey;
}

/** Drops the storage envelope (household, key, raw answer, pack version). */
function toAttemptEvent(r: StoredLearnAttempt): AttemptEvent {
  return {
    id: r.id,
    itemId: r.itemId,
    family: r.family,
    question: r.question,
    skill: r.skill,
    topic: r.topic,
    subskill: r.subskill,
    at: r.at,
    marks: r.marks,
    maxMarks: r.maxMarks,
    firstTry: r.firstTry,
    hintsBeforeSubmit: r.hintsBeforeSubmit,
    revealed: r.revealed,
    confirmed: r.confirmed,
    ...(r.revisions ? { revisions: r.revisions } : {}),
    ...(r.explanation ? { explanation: r.explanation } : {}),
    ...(r.explanationRevised ? { explanationRevised: r.explanationRevised } : {}),
  };
}

const g = globalThis as typeof globalThis & { __mykxDemoStore?: DemoStore };

/**
 * One demo store per server process (shared across route bundles and hot reloads). A store left over from before
 * a shape change is replaced once (sessions survive: their cookies are signed, not stored).
 */
export function demoStore(): DemoStore {
  assertNotProduction();
  if (g.__mykxDemoStore?.shape !== DEMO_STORE_SHAPE) {
    const fresh = new DemoStore();
    seedDemoHistory(fresh);
    g.__mykxDemoStore = fresh;
  }
  return g.__mykxDemoStore;
}

/** Tests only: a fresh demo family. */
export function resetDemoStore(): DemoStore {
  g.__mykxDemoStore = new DemoStore();
  return g.__mykxDemoStore;
}

/**
 * Ari's synthetic earlier history (yesterday afternoon, SG): two answered frog
 * stops, so Treasure opens earned, not empty. Same rows as supabase/seed.sql.
 * Dev only — tests use resetDemoStore (unseeded) — called by demoStore().
 */
export function seedDemoHistory(store: DemoStore): void {
  const t0 = yesterdayAfternoonSg();
  const at = (min: number) => new Date(t0 - 8 * 60_000 + min * 60_000).toISOString();
  const day = sgDate(at(0));
  const base = {
    skill: "p3-science",
    topic: "cycles.animal",
    confirmed: true,
    skillVersion: "1.0.0",
  } as const;
  const rows: StoredLearnAttempt[] = [
    {
      ...base,
      id: "00000000-0000-4000-8000-00000000a101",
      householdId: DEMO_HOUSEHOLD_ID,
      kidId: ARI_ID,
      itemId: "p3sci-demo-01",
      family: "p3sci-demo-01",
      subskill: "three_stage",
      at: at(0),
      marks: 2,
      maxMarks: 2,
      firstTry: true,
      hintsBeforeSubmit: 0,
      revealed: false,
      explanation: true,
      idempotencyKey: "seed:ari:p3sci-demo-01",
      answer: 2,
      explanationText: "The egg comes first, then the tadpole.",
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-00000000a102",
      householdId: DEMO_HOUSEHOLD_ID,
      kidId: ARI_ID,
      itemId: "p3sci-demo-02",
      family: "p3sci-demo-02",
      subskill: "stage_features",
      at: at(2),
      marks: 0,
      maxMarks: 2,
      firstTry: true,
      hintsBeforeSubmit: 0,
      revealed: false,
      idempotencyKey: "seed:ari:p3sci-demo-02-try1",
      answer: 1,
      explanationText: null,
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-00000000a103",
      householdId: DEMO_HOUSEHOLD_ID,
      kidId: ARI_ID,
      itemId: "p3sci-demo-02",
      family: "p3sci-demo-02",
      subskill: "stage_features",
      at: at(4),
      marks: 2,
      maxMarks: 2,
      firstTry: false,
      hintsBeforeSubmit: 0,
      revealed: false,
      explanation: true,
      explanationRevised: true,
      idempotencyKey: "seed:ari:p3sci-demo-02-try2",
      answer: 2,
      explanationText: "Tadpoles swim with their tails; legs come later.",
    },
  ];
  for (const r of rows) store.attemptRows.set(r.idempotencyKey, r);
  const entries: StoredLedgerEntry[] = [
    { key: `${ARI_ID}:first_attempt:p3sci-demo-01`, kind: "stars", rule: "first_attempt", amount: 2, ref: "p3sci-demo-01", at: at(0), day, householdId: DEMO_HOUSEHOLD_ID, kidId: ARI_ID },
    { key: `${ARI_ID}:retry_revised:p3sci-demo-02`, kind: "stars", rule: "retry_revised", amount: 3, ref: "p3sci-demo-02", at: at(4), day, householdId: DEMO_HOUSEHOLD_ID, kidId: ARI_ID },
  ];
  for (const e of entries) store.ledgerRows.set(e.key, e);
}
