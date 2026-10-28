// In-memory demo store for `npm run dev` before Supabase keys exist. Seeded with the synthetic demo
// family (lib/auth/demo-family.ts). Any email and password opens the demo parent (the design preview);
// other@demo.mykx opens a second, non-admin family. Refuses to exist in a production build.
import { randomUUID } from "node:crypto";
import type { FocusMinute } from "../signals/focus.ts";
import type { FocusNote } from "../signals/schemas.ts";
import {
  JORDAN_ID,
  ARI_SAMPLE_FOCUS_NOTE,
  DEMO_HOUSEHOLD_ID,
  DEMO_KIDS,
  DEMO_PARENT_EMAIL,
  DEMO_PARENT_ID,
  DEMO_PARENT_USER_ID,
  KAI_ID,
  KAI_SECRET_HASH,
  LEONARD_ID,
  OTHER_HOUSEHOLD_ID,
  OTHER_PARENT_EMAIL,
  OTHER_PARENT_ID,
  OTHER_PARENT_USER_ID,
  ABBY_ID,
} from "./demo-family.ts";
import type { AttemptEvent } from "../domain/attempts.ts";
import type { LedgerEntry } from "../domain/rewards.ts";
import { sgDate } from "../domain/time.ts";
import { BEAT_MS } from "../guardian/screen-time.ts";
import { sampleGuardianWeek } from "../guardian/sample.ts";
import type { KnowledgeSession, KnowledgeUpload, Review, SkillUpdate, UploadState } from "../knowledge/knowledge.ts";
import { metaOf, type SkillVersion } from "../skills/versions.ts";
import { findFields, findKey, runCounts, type FindStatus, type PaperFind, type ScoutRun } from "../papers/finds.ts";
import type { ScoutRow } from "../papers/scan.ts";
import { DEMO_OUTINGS } from "../outings/sample.ts";
import type { OutingRun } from "../outings/outings.ts";
import { KEEP_POINTS_DAYS, type KidLocationSettings, type Place, type PlaceEvent, type StoredPoint } from "../location/location.ts";
import { DEFAULT_PREFS, KEEP_STATUS_DAYS, type DeviceKind, type GuardianPrefs, type HomeAlert, type HomeCamera, type HomeDevice, type HomeStatus, type RoomKind } from "../home-watch/home-watch.ts";
import type { FlashcardSpec } from "../vibe/flashcards.ts";
import type { FamilyMessage, Sticker } from "../family/messages.ts";
import type { PageSlug } from "../notebook/notebook.ts";
import type { GameProgress } from "../games/progress.ts";
import type { CookieJar } from "./http.ts";
import type { AuditEntry, AuthStore, AuthUser, Household, NewFocusNote, NewKid, Profile, ProfilePatch, StoredAttempt, StoredBeat, StoredGuardianSettings, StoredKixMessage, Creation, NotebookPage, NotebookRevision, StoredSessionRead, StoredRun, StoredSkillEvent } from "./store.ts";
import type { StoredAgentVersion } from "./store.ts";
import { NicknameTakenError, UsernameTakenError } from "./store.ts";
import { sessionSecret, signToken, verifyToken } from "./tokens.ts";

export const DEMO_PARENT_COOKIE = "mykx_demo_parent";
/** Bump when the store's shape changes: a running dev server then rebuilds it on the next request (see demoStore). */
const DEMO_STORE_SHAPE = 14; // 9: game progress; 10: paper scout; 11: Guardian; 12: magic names; 13: agent versions; 14: skill versions and review sessions
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
    username: null,
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

/** Yesterday at 4:12 pm Singapore time (UTC+8, no daylight saving), for Jordan's sample focus note. */
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

/** A stored family message without its household id. */
const toMessage = (m: FamilyMessage): FamilyMessage => ({ id: m.id, from: m.from, to: m.to, body: m.body, sticker: m.sticker, byVoice: m.byVoice, at: m.at, readAt: m.readAt });

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
  /** Guardian heartbeats by `${kidId}|${slot ms}`, the kid's words to Kix, settings by kid, and seen flags. */
  readonly beatRows = new Map<string, StoredBeat & { householdId: string; kidId: string }>();
  readonly kixMessageRows: (StoredKixMessage & { householdId: string; kidId: string })[] = [];
  readonly guardianSettingRows = new Map<string, StoredGuardianSettings & { householdId: string }>();
  readonly seenFlagRows = new Set<string>();
  /** Knowledge uploads by id, and published pack updates (platform content). */
  readonly knowledgeRows = new Map<string, KnowledgeUpload>();
  readonly skillUpdateRows: SkillUpdate[] = [];
  /** Skill versions (admin edits, imports, knowledge) and knowledge review sessions. */
  readonly skillVersionRows = new Map<string, SkillVersion>();
  readonly knowledgeSessionRows = new Map<string, KnowledgeSession>();
  /** The paper scout's finds by key (findKey), and its runs. */
  readonly paperFindRows = new Map<string, PaperFind>();
  readonly scoutRunRows: ScoutRun[] = [];
  /** Guardian: kids' sharing settings, points, places and their events; Home watch devices, cameras, statuses and prefs. */
  readonly locationSettingRows = new Map<string, KidLocationSettings & { householdId: string }>();
  readonly pointRows: (StoredPoint & { householdId: string })[] = [];
  readonly placeRows = new Map<string, Place & { householdId: string }>();
  readonly placeEventRows: (PlaceEvent & { householdId: string })[] = [];
  readonly guardianPrefRows = new Map<string, GuardianPrefs>();
  readonly deviceRows = new Map<string, HomeDevice & { tokenHash: string | null; pairCodeHash: string | null; framesDay: string | null; framesCount: number }>();
  readonly cameraRows = new Map<string, HomeCamera & { householdId: string }>();
  readonly statusRows: (HomeStatus & { householdId: string })[] = [];
  readonly alertRows: (HomeAlert & { householdId: string })[] = [];
  readonly outingRuns = new Map<string, OutingRun>();
  /** Flagged frames as data URLs by path (the demo's stand-in for the private Storage bucket). */
  readonly alertFrameRows = new Map<string, string>();
  /** Vibe Zone creations by id, with the household and the shared recipients. */
  readonly creationRows = new Map<string, Creation & { householdId: string; sharedWith: string[] }>();
  readonly runRows: StoredRun[] = [];
  readonly skillRows: StoredSkillEvent[] = [];
  readonly gameRows = new Map<string, GameProgress & { householdId: string }>();
  /** Family messages, Notebook pages and revisions, and session readings. */
  readonly familyRows: (FamilyMessage & { householdId: string })[] = [];
  readonly notebookRows = new Map<string, NotebookPage & { householdId: string; kidId: string }>();
  readonly notebookRevisionRows: (NotebookRevision & { householdId: string; kidId: string })[] = [];
  readonly sessionReadRows: (StoredSessionRead & { householdId: string; kidId: string })[] = [];
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
          username: k.username,
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
        username: "kai",
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
      verdict: null,
      ...ARI_SAMPLE_FOCUS_NOTE,
      householdId: DEMO_HOUSEHOLD_ID,
      kidId: JORDAN_ID,
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

  async kidByUsername(username: string) {
    const lower = username.trim().toLowerCase();
    for (const p of this.profiles.values()) if (p.role === "child" && p.username === lower) return p;
    return null;
  }

  private checkUsername(username: string | null, exceptId?: string) {
    if (!username) return;
    for (const p of this.profiles.values()) if (p.id !== exceptId && p.username === username) throw new UsernameTakenError();
  }

  private checkNickname(householdId: string, nickname: string, exceptId?: string) {
    const lower = nickname.toLowerCase();
    for (const p of this.profiles.values()) {
      if (p.householdId === householdId && p.id !== exceptId && p.nickname.toLowerCase() === lower) throw new NicknameTakenError();
    }
  }

  private apply(p: Profile, patch: ProfilePatch): Profile {
    if (patch.nickname !== undefined) this.checkNickname(p.householdId, patch.nickname, p.id);
    if (patch.username !== undefined) this.checkUsername(patch.username, p.id);
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
    for (const [key, row] of this.beatRows) if (row.kidId === kidId) this.beatRows.delete(key);
    for (const [key, row] of this.creationRows) if (row.kidId === kidId) this.creationRows.delete(key);
    this.kixMessageRows.splice(0, this.kixMessageRows.length, ...this.kixMessageRows.filter((m) => m.kidId !== kidId));
    this.guardianSettingRows.delete(kidId);
    return this.profiles.delete(kidId);
  }

  async audit(entry: AuditEntry) {
    this.auditLog.push({ ...entry, createdAt: nowIso() });
  }

  async countAudit(householdId: string, action: string, sinceIso: string) {
    const since = Date.parse(sinceIso);
    return this.auditLog.filter((e) => e.householdId === householdId && e.action === action && Date.parse(e.createdAt) >= since).length;
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
      const row: StoredNote = { id: randomUUID(), householdId, kidId, ...note, synthetic: false, verdict: null };
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
    setFocusVerdict: async (householdId: string, noteId: string, verdict: "right" | "not-right" | null) => {
      const n = this.focusNoteRows.find((x) => x.id === noteId && x.householdId === householdId);
      if (!n) return null;
      n.verdict = verdict;
      return n.kidId;
    },
  };

  readonly guardian = {
    saveBeat: async (householdId: string, kidId: string, beat: StoredBeat) => {
      if (!this.ownsKid(householdId, kidId)) return;
      const slot = Math.floor(Date.parse(beat.at) / BEAT_MS) * BEAT_MS;
      const key = `${kidId}|${slot}`;
      if (!this.beatRows.has(key)) this.beatRows.set(key, { ...beat, at: new Date(slot).toISOString(), householdId, kidId });
    },
    beats: async (householdId: string, kidId: string, sinceIso: string) => {
      const since = Date.parse(sinceIso);
      return [...this.beatRows.values()]
        .filter((b) => b.householdId === householdId && b.kidId === kidId && Date.parse(b.at) >= since)
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
        .map(({ at, kind, idle, synthetic }) => ({ at, kind, idle, ...(synthetic ? { synthetic } : {}) }));
    },
    saveMessage: async (householdId: string, kidId: string, message: StoredKixMessage) => {
      if (!this.ownsKid(householdId, kidId)) return;
      this.kixMessageRows.push({ ...message, householdId, kidId });
    },
    messages: async (householdId: string, kidId: string, sinceIso: string) => {
      const since = Date.parse(sinceIso);
      return this.kixMessageRows
        .filter((m) => m.householdId === householdId && m.kidId === kidId && Date.parse(m.at) >= since)
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
        .map((m) => ({ at: m.at, text: m.text, source: m.source, distress: m.distress, selfTalk: m.selfTalk, ...(m.synthetic ? { synthetic: true } : {}) }));
    },
    settings: async (householdId: string, kidId: string) => {
      const row = this.guardianSettingRows.get(kidId);
      if (!row || row.householdId !== householdId) return null;
      return { quietFromHour: row.quietFromHour, quietToHour: row.quietToHour, breakEveryMin: row.breakEveryMin, learnMinMin: row.learnMinMin, playMaxMin: row.playMaxMin };
    },
    saveSettings: async (householdId: string, kidId: string, settings: StoredGuardianSettings) => {
      if (!this.ownsKid(householdId, kidId)) return;
      this.guardianSettingRows.set(kidId, { ...settings, householdId });
    },
    seenFlags: async (householdId: string) => [...this.seenFlagRows].filter((k) => k.startsWith(`${householdId}|`)).map((k) => k.slice(householdId.length + 1)),
    markSeen: async (householdId: string, flagId: string) => {
      this.seenFlagRows.add(`${householdId}|${flagId}`);
    },
  };

  readonly games = {
    progress: async (householdId: string, kidId: string): Promise<GameProgress[]> =>
      [...this.gameRows.entries()]
        .filter(([k, r]) => r.householdId === householdId && k.startsWith(`${kidId}|`))
        .map(([, r]) => structuredClone({ game: r.game, stage: r.stage, level: r.level, stars: r.stars, bestAccuracy: r.bestAccuracy, bestWpm: r.bestWpm, keys: r.keys, updatedAt: r.updatedAt })),
    save: async (householdId: string, kidId: string, progress: GameProgress) => {
      if (!this.ownsKid(householdId, kidId)) return;
      this.gameRows.set(`${kidId}|${progress.game}`, { ...structuredClone(progress), householdId });
    },
  };

  readonly runs = {
    save: async (run: StoredRun) => {
      this.runRows.push({ ...run });
      if (this.runRows.length > 500) this.runRows.shift();
    },
    recent: async (limit: number) => this.runRows.slice(-limit).reverse().map((r) => ({ ...r })),
  };

  readonly skills = {
    log: async (events: readonly StoredSkillEvent[]) => {
      this.skillRows.push(...events.map((e) => ({ ...e })));
      if (this.skillRows.length > 500) this.skillRows.splice(0, this.skillRows.length - 500);
    },
    recent: async (limit: number) => this.skillRows.slice(-limit).reverse().map((e) => ({ ...e })),
    prune: async (beforeIso: string) => {
      const keep = this.skillRows.filter((e) => e.at >= beforeIso);
      const gone = this.skillRows.length - keep.length;
      this.skillRows.splice(0, this.skillRows.length, ...keep);
      return gone;
    },
  };

  readonly family = {
    grownUps: async (householdId: string) => [...this.profiles.values()].filter((p) => p.householdId === householdId && p.role === "parent"),
    thread: async (householdId: string, a: string, b: string) =>
      this.familyRows
        .filter((m) => m.householdId === householdId && ((m.from === a && m.to === b) || (m.from === b && m.to === a)))
        .slice(-60)
        .map(toMessage),
    unread: async (householdId: string, to: string) => this.familyRows.filter((m) => m.householdId === householdId && m.to === to && !m.readAt).map(toMessage),
    send: async (householdId: string, m: { from: string; to: string; body: string | null; sticker: Sticker | null; byVoice: boolean }) => {
      const both = [m.from, m.to].every((id) => this.profiles.get(id)?.householdId === householdId);
      if (!both) return null;
      const row = { ...m, id: randomUUID(), at: nowIso(), readAt: null, householdId };
      this.familyRows.push(row);
      return toMessage(row);
    },
    markRead: async (householdId: string, to: string, ids: readonly string[]) => {
      const now = nowIso();
      for (const m of this.familyRows) if (m.householdId === householdId && m.to === to && ids.includes(m.id) && !m.readAt) m.readAt = now;
    },
  };

  readonly notebook = {
    pages: async (householdId: string, kidId: string) =>
      [...this.notebookRows.values()].filter((p) => p.householdId === householdId && p.kidId === kidId).map((p) => ({ slug: p.slug, body: p.body, updatedAt: p.updatedAt })),
    write: async (householdId: string, kidId: string, slug: PageSlug, body: string, by: NotebookRevision["by"], reason: string | null) => {
      if (!this.ownsKid(householdId, kidId)) return;
      const key = `${kidId}|${slug}`;
      const before = this.notebookRows.get(key)?.body ?? "";
      const at = nowIso();
      this.notebookRows.set(key, { slug, body, updatedAt: at, householdId, kidId });
      this.notebookRevisionRows.push({ slug, before, after: body, by, reason, at, householdId, kidId });
    },
    revisions: async (householdId: string, kidId: string, limit: number) =>
      this.notebookRevisionRows
        .filter((r) => r.householdId === householdId && r.kidId === kidId)
        .slice(-limit)
        .reverse()
        .map((r) => ({ slug: r.slug, before: r.before, after: r.after, by: r.by, reason: r.reason, at: r.at })),
    wipe: async (householdId: string, kidId: string) => {
      for (const [k, p] of this.notebookRows) if (p.householdId === householdId && p.kidId === kidId) this.notebookRows.delete(k);
      for (let i = this.notebookRevisionRows.length - 1; i >= 0; i--) {
        const r = this.notebookRevisionRows[i];
        if (r.householdId === householdId && r.kidId === kidId) this.notebookRevisionRows.splice(i, 1);
      }
    },
    saveRead: async (householdId: string, kidId: string, read: StoredSessionRead) => {
      if (!this.ownsKid(householdId, kidId)) return;
      const i = this.sessionReadRows.findIndex((r) => r.kidId === kidId && r.sessionStart === read.sessionStart);
      const row = { ...read, householdId, kidId };
      if (i >= 0) this.sessionReadRows[i] = row;
      else this.sessionReadRows.push(row);
    },
    reads: async (householdId: string, kidId: string, sinceIso: string) =>
      this.sessionReadRows
        .filter((r) => r.householdId === householdId && r.kidId === kidId && r.sessionEnd >= sinceIso)
        .map((r) => ({ sessionStart: r.sessionStart, sessionEnd: r.sessionEnd, mood: r.mood, confidence: r.confidence, evidence: [...r.evidence], concern: r.concern })),
  };

  readonly creations = {
    list: async (householdId: string, kidId?: string) =>
      [...this.creationRows.values()]
        .filter((c) => c.householdId === householdId && (!kidId || c.kidId === kidId))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(toCreation),
    saveVersion: async (householdId: string, kidId: string, id: string | null, spec: FlashcardSpec) => {
      if (!this.ownsKid(householdId, kidId)) return null;
      const now = nowIso();
      const had = id ? this.creationRows.get(id) : undefined;
      if (id && (!had || had.householdId !== householdId || had.kidId !== kidId)) return null;
      const row = had
        ? { ...had, title: spec.title, versions: [...had.versions, structuredClone(spec)], currentVersion: had.versions.length + 1, updatedAt: now }
        : { id: randomUUID(), kidId, kind: "flashcards" as const, title: spec.title, versions: [structuredClone(spec)], currentVersion: 1, sharedVersion: null, createdAt: now, updatedAt: now, householdId, sharedWith: [] };
      this.creationRows.set(row.id, row);
      return toCreation(row);
    },
    share: async (householdId: string, creationId: string, version: number, recipientIds: readonly string[]) => {
      const c = this.creationRows.get(creationId);
      if (!c || c.householdId !== householdId) return;
      c.sharedVersion = version;
      c.sharedWith = recipientIds.filter((r) => this.profiles.get(r)?.householdId === householdId);
    },
    revoke: async (householdId: string, creationId: string) => {
      const c = this.creationRows.get(creationId);
      if (!c || c.householdId !== householdId) return;
      c.sharedVersion = null;
      c.sharedWith = [];
    },
  };

  readonly knowledge = {
    saveUpload: async (u: KnowledgeUpload) => {
      this.knowledgeRows.set(u.id, structuredClone(u));
    },
    uploads: async () => [...this.knowledgeRows.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((u) => structuredClone(u)),
    setReview: async (id: string, review: Review) => {
      const u = this.knowledgeRows.get(id);
      if (u && !u.publishedIn) u.review = { ...review };
    },
    markPublished: async (ids: readonly string[], version: string) => {
      for (const id of ids) {
        const u = this.knowledgeRows.get(id);
        if (u) u.publishedIn = version;
      }
    },
    saveUpdate: async (update: SkillUpdate) => {
      this.skillUpdateRows.push(structuredClone(update));
    },
    updates: async (pack?: string) => this.skillUpdateRows.filter((u) => !pack || u.pack === pack).map((u) => structuredClone(u)),
    upload: async (id: string) => {
      const u = this.knowledgeRows.get(id);
      return u ? structuredClone(u) : null;
    },
    updateUpload: async (id: string, patch: { sessionId?: string | null; state?: UploadState; review?: Review }) => {
      const u = this.knowledgeRows.get(id);
      if (!u || u.publishedIn) return null;
      if (patch.sessionId !== undefined) u.sessionId = patch.sessionId;
      if (patch.state) u.state = structuredClone(patch.state);
      if (patch.review) u.review = { ...patch.review };
      return structuredClone(u);
    },
    sessions: async () => [...this.knowledgeSessionRows.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((s) => structuredClone(s)),
    session: async (id: string) => {
      const s = this.knowledgeSessionRows.get(id);
      return s ? structuredClone(s) : null;
    },
    saveSession: async (s: KnowledgeSession) => {
      this.knowledgeSessionRows.set(s.id, structuredClone(s));
    },
  };

  readonly skillVersions = {
    list: async (packId?: string) =>
      [...this.skillVersionRows.values()]
        .filter((v) => !packId || v.packId === packId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(metaOf),
    get: async (id: string) => {
      const v = this.skillVersionRows.get(id);
      return v ? structuredClone(v) : null;
    },
    published: async () => {
      const best = new Map<string, SkillVersion>();
      for (const v of this.skillVersionRows.values()) {
        if (v.status !== "published" || v.deletedAt) continue;
        const had = best.get(v.packId);
        if (!had || (v.publishedAt ?? v.createdAt) > (had.publishedAt ?? had.createdAt)) best.set(v.packId, v);
      }
      return [...best.values()].map((v) => structuredClone(v));
    },
    save: async (v: SkillVersion) => {
      if ([...this.skillVersionRows.values()].some((r) => r.packId === v.packId && r.version === v.version)) throw new Error(`${v.packId} v${v.version} exists`);
      this.skillVersionRows.set(v.id, structuredClone(v));
    },
    update: async (id: string, patch: Partial<Pick<SkillVersion, "files" | "status" | "publishedAt" | "note">>) => {
      const v = this.skillVersionRows.get(id);
      if (!v || v.deletedAt) return null;
      Object.assign(v, structuredClone(patch));
      return structuredClone(v);
    },
    remove: async (ids: readonly string[], atIso: string) => {
      let n = 0;
      for (const id of ids) {
        const v = this.skillVersionRows.get(id);
        if (v && !v.deletedAt) {
          v.deletedAt = atIso;
          n += 1;
        }
      }
      return n;
    },
  };

  readonly papers = {
    saveScan: async (run: Omit<ScoutRun, "fresh" | "found" | "auto" | "manual" | "skip">, rows: readonly ScoutRow[]) => {
      let fresh = 0;
      for (const r of rows) {
        const fields = findFields(r);
        const old = this.paperFindRows.get(findKey(fields));
        if (!old) fresh += 1;
        this.paperFindRows.set(findKey(fields), { ...fields, id: old?.id ?? randomUUID(), status: old?.status ?? "new", uploadId: old?.uploadId ?? null, firstSeen: old?.firstSeen ?? run.at, lastSeen: run.at });
      }
      const saved: ScoutRun = { ...run, ...runCounts(rows), fresh, problems: [...run.problems] };
      this.scoutRunRows.push(saved);
      return structuredClone(saved);
    },
    finds: async () => [...this.paperFindRows.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || (b.year ?? 0) - (a.year ?? 0)).map((f) => structuredClone(f)),
    find: async (id: string) => {
      const f = [...this.paperFindRows.values()].find((x) => x.id === id);
      return f ? structuredClone(f) : null;
    },
    setFind: async (id: string, patch: { status: FindStatus; uploadId?: string | null }) => {
      const f = [...this.paperFindRows.values()].find((x) => x.id === id);
      if (!f) return null;
      f.status = patch.status;
      if (patch.uploadId !== undefined) f.uploadId = patch.uploadId;
      return structuredClone(f);
    },
    setStatus: async (ids: readonly string[], status: Exclude<FindStatus, "read">) => {
      const want = new Set(ids);
      let n = 0;
      for (const f of this.paperFindRows.values()) {
        if (!want.has(f.id) || f.status === "read") continue;
        f.status = status;
        n += 1;
      }
      return n;
    },
    runs: async (limit: number) => [...this.scoutRunRows].reverse().slice(0, limit).map((r) => structuredClone(r)),
  };

  readonly whereabouts = {
    settings: async (householdId: string) => [...this.locationSettingRows.values()].filter((r) => r.householdId === householdId).map(withoutHousehold),
    saveSettings: async (householdId: string, kidId: string, patch: Partial<Omit<KidLocationSettings, "kidId">>) => {
      const old = this.locationSettingRows.get(kidId);
      const row = { kidId, enabled: false, mode: "balanced" as const, pausedUntil: null, ...(old?.householdId === householdId ? old : {}), ...patch, householdId };
      this.locationSettingRows.set(kidId, row);
      return withoutHousehold(row);
    },
    addPoints: async (householdId: string, points: readonly StoredPoint[]) => {
      let added = 0;
      for (const p of points) {
        if (this.pointRows.some((r) => r.kidId === p.kidId && r.at === p.at)) continue;
        this.pointRows.push({ ...p, householdId });
        added += 1;
      }
      const cutoff = Date.now() - KEEP_POINTS_DAYS * 86_400_000;
      for (let i = this.pointRows.length - 1; i >= 0; i--) if (Date.parse(this.pointRows[i].at) < cutoff) this.pointRows.splice(i, 1);
      return added;
    },
    track: async (householdId: string, kidId: string, sinceIso: string) =>
      this.pointRows.filter((r) => r.householdId === householdId && r.kidId === kidId && r.at >= sinceIso).sort((a, b) => a.at.localeCompare(b.at)).map(withoutHousehold),
    latest: async (householdId: string) => {
      const last = new Map<string, StoredPoint>();
      for (const { householdId: h, ...r } of this.pointRows) if (h === householdId && (!last.has(r.kidId) || last.get(r.kidId)!.at < r.at)) last.set(r.kidId, { ...r });
      return [...last.values()];
    },
    places: async (householdId: string) => [...this.placeRows.values()].filter((r) => r.householdId === householdId).map(withoutHousehold),
    savePlace: async (householdId: string, place: Omit<Place, "id"> & { id?: string }) => {
      if (place.id && this.placeRows.get(place.id)?.householdId !== householdId) return null;
      const row = { ...place, id: place.id ?? randomUUID(), householdId };
      this.placeRows.set(row.id, row);
      return withoutHousehold(row);
    },
    deletePlace: async (householdId: string, id: string) => {
      if (this.placeRows.get(id)?.householdId !== householdId) return false;
      this.placeRows.delete(id);
      for (let i = this.placeEventRows.length - 1; i >= 0; i--) if (this.placeEventRows[i].placeId === id) this.placeEventRows.splice(i, 1);
      return true;
    },
    addEvents: async (householdId: string, events: readonly Omit<PlaceEvent, "id">[]) => {
      for (const e of events) this.placeEventRows.push({ ...e, id: randomUUID(), householdId });
    },
    events: async (householdId: string, sinceIso: string) =>
      this.placeEventRows.filter((r) => r.householdId === householdId && r.at >= sinceIso).sort((a, b) => b.at.localeCompare(a.at)).map(withoutHousehold),
  };

  readonly outings = {
    latest: async (householdId: string) => {
      const run = this.outingRuns.get(householdId) ?? (householdId === DEMO_HOUSEHOLD_ID ? DEMO_OUTINGS : null);
      return run ? structuredClone(run) : null;
    },
    save: async (householdId: string, run: OutingRun) => {
      this.outingRuns.set(householdId, structuredClone(run));
    },
  };

  readonly homeWatch = {
    prefs: async (householdId: string) => structuredClone(this.guardianPrefRows.get(householdId) ?? DEFAULT_PREFS),
    savePrefs: async (householdId: string, prefs: GuardianPrefs) => {
      this.guardianPrefRows.set(householdId, structuredClone(prefs));
      return structuredClone(prefs);
    },
    createDevice: async (householdId: string, d: { name: string; kind: DeviceKind; pairCodeHash: string; pairExpiresAt: string; createdBy: string | null }) => {
      const row = { id: randomUUID(), householdId, name: d.name, kind: d.kind, createdAt: new Date().toISOString(), lastSeenAt: null, revokedAt: null, paired: false, pairExpiresAt: d.pairExpiresAt, tokenHash: null, pairCodeHash: d.pairCodeHash, framesDay: null, framesCount: 0 };
      this.deviceRows.set(row.id, row);
      return this.publicDevice(row);
    },
    claimDevice: async (pairCodeHash: string, tokenHash: string, nowIso: string) => {
      const row = [...this.deviceRows.values()].find((d) => d.pairCodeHash === pairCodeHash && !d.revokedAt && d.pairExpiresAt && d.pairExpiresAt > nowIso);
      if (!row) return null;
      Object.assign(row, { tokenHash, pairCodeHash: null, pairExpiresAt: null, paired: true, lastSeenAt: nowIso });
      return this.publicDevice(row);
    },
    deviceByToken: async (tokenHash: string) => {
      const row = [...this.deviceRows.values()].find((d) => d.tokenHash === tokenHash && !d.revokedAt);
      return row ? this.publicDevice(row) : null;
    },
    devices: async (householdId: string) => [...this.deviceRows.values()].filter((d) => d.householdId === householdId).map((d) => this.publicDevice(d)),
    revokeDevice: async (householdId: string, id: string) => {
      const row = this.deviceRows.get(id);
      if (!row || row.householdId !== householdId) return false;
      row.revokedAt = new Date().toISOString();
      row.tokenHash = null;
      row.pairCodeHash = null;
      return true;
    },
    spendFrames: async (deviceId: string, day: string, n: number, max: number, nowIso: string) => {
      const row = this.deviceRows.get(deviceId);
      if (!row) return false;
      const used = row.framesDay === day ? row.framesCount : 0;
      row.lastSeenAt = nowIso;
      if (used + n > max) return false;
      row.framesDay = day;
      row.framesCount = used + n;
      return true;
    },
    syncCameras: async (householdId: string, deviceId: string, cameras: readonly { key: string; room: string; roomKind: RoomKind; enabled: boolean }[]) => {
      const mine = [...this.cameraRows.values()].filter((c) => c.deviceId === deviceId);
      for (const c of mine) if (!cameras.some((x) => x.key === c.key)) c.enabled = false;
      for (const x of cameras) {
        const old = mine.find((c) => c.key === x.key);
        if (old) Object.assign(old, { room: x.room, roomKind: x.roomKind, enabled: x.enabled });
        else {
          const id = randomUUID();
          this.cameraRows.set(id, { id, deviceId, householdId, key: x.key, room: x.room, roomKind: x.roomKind, enabled: x.enabled, lastFrameAt: null, lastStatusAt: null });
        }
      }
      return [...this.cameraRows.values()].filter((c) => c.deviceId === deviceId).map(withoutHousehold);
    },
    cameras: async (householdId: string) => [...this.cameraRows.values()].filter((c) => c.householdId === householdId).map(withoutHousehold),
    touchCameras: async (householdId: string, cameraIds: readonly string[], at: string) => {
      for (const id of cameraIds) {
        const c = this.cameraRows.get(id);
        if (c && c.householdId === householdId) c.lastFrameAt = at;
      }
    },
    saveStatuses: async (householdId: string, rows: readonly Omit<HomeStatus, "id">[]) => {
      for (const r of rows) {
        this.statusRows.push({ ...structuredClone(r), id: randomUUID(), householdId });
        const c = this.cameraRows.get(r.cameraId);
        if (c && c.householdId === householdId) c.lastStatusAt = r.at;
      }
      const cutoff = Date.now() - KEEP_STATUS_DAYS * 86_400_000;
      for (let i = this.statusRows.length - 1; i >= 0; i--) if (Date.parse(this.statusRows[i].at) < cutoff) this.statusRows.splice(i, 1);
    },
    statuses: async (householdId: string, sinceIso: string) =>
      this.statusRows.filter((r) => r.householdId === householdId && r.at >= sinceIso).sort((a, b) => b.at.localeCompare(a.at)).map((r) => structuredClone(withoutHousehold(r))),
    addAlert: async (householdId: string, alert: Omit<HomeAlert, "id" | "verdict" | "seenAt">) => {
      const row = { ...structuredClone(alert), id: randomUUID(), verdict: null, seenAt: null, householdId };
      this.alertRows.push(row);
      return structuredClone(withoutHousehold(row));
    },
    alerts: async (householdId: string, sinceIso: string) =>
      this.alertRows.filter((r) => r.householdId === householdId && r.at >= sinceIso).sort((a, b) => b.at.localeCompare(a.at)).map((r) => structuredClone(withoutHousehold(r))),
    setAlertVerdict: async (householdId: string, id: string, verdict: HomeAlert["verdict"]) => {
      const row = this.alertRows.find((r) => r.id === id && r.householdId === householdId);
      if (!row) return null;
      row.verdict = verdict;
      row.seenAt ??= new Date().toISOString();
      return structuredClone(withoutHousehold(row));
    },
    saveAlertFrames: async (householdId: string, alertKey: string, frames: readonly Uint8Array[]) =>
      frames.map((bytes, i) => {
        const path = `${householdId}/${alertKey}/${i}.webp`;
        this.alertFrameRows.set(path, `data:image/webp;base64,${Buffer.from(bytes).toString("base64")}`);
        return path;
      }),
    alertFrameUrls: async (householdId: string, paths: readonly string[]) => paths.filter((p) => p.startsWith(`${householdId}/`)).flatMap((p) => (this.alertFrameRows.has(p) ? [this.alertFrameRows.get(p)!] : [])),
    purgeAlertFrames: async (nowIso: string) => {
      let n = 0;
      for (const a of this.alertRows) {
        if (!a.framesExpireAt || a.framesExpireAt > nowIso || !a.framePaths.length) continue;
        for (const p of a.framePaths) this.alertFrameRows.delete(p);
        a.framePaths = [];
        n += 1;
      }
      return n;
    },
  };

  private publicDevice(d: HomeDevice & { tokenHash: string | null; pairCodeHash: string | null; framesDay: string | null; framesCount: number }): HomeDevice {
    return { id: d.id, householdId: d.householdId, name: d.name, kind: d.kind, createdAt: d.createdAt, lastSeenAt: d.lastSeenAt, revokedAt: d.revokedAt, paired: d.paired, pairExpiresAt: d.pairExpiresAt };
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

  // Agents you can edit (agent_versions): every version, deleted ones kept with deletedAt (lib/agents).
  readonly agentVersionRows: StoredAgentVersion[] = [];

  readonly agents = {
    versions: async (agentId?: string) =>
      this.agentVersionRows
        .filter((v) => !agentId || v.agentId === agentId)
        .sort((a, b) => a.agentId.localeCompare(b.agentId) || a.version - b.version)
        .map((v) => ({ ...v })),
    add: async (v: { agentId: string; instructions: string; note: string | null; status: StoredAgentVersion["status"]; createdBy: string | null }) => {
      const version = Math.max(1, ...this.agentVersionRows.filter((r) => r.agentId === v.agentId).map((r) => r.version)) + 1;
      const row: StoredAgentVersion = { id: randomUUID(), ...v, version, createdAt: nowIso(), deletedAt: null };
      this.agentVersionRows.push(row);
      return { ...row };
    },
    updateDraft: async (agentId: string, version: number, patch: { instructions: string; note: string | null; status: StoredAgentVersion["status"] }) => {
      const row = this.agentVersionRows.find((r) => r.agentId === agentId && r.version === version && r.status === "draft" && !r.deletedAt);
      if (!row) return null;
      Object.assign(row, patch);
      return { ...row };
    },
    remove: async (agentId: string, version: number, atIso: string) => {
      const row = this.agentVersionRows.find((r) => r.agentId === agentId && r.version === version && !r.deletedAt);
      if (!row) return false;
      row.deletedAt = atIso;
      return true;
    },
  };
}

function publicNote({ id, kidId, from, to, evidence, confidence, synthetic, verdict }: StoredNote): FocusNote {
  return { id, kidId, from, to, evidence, confidence, synthetic, verdict: verdict ?? null };
}

/** Strips one `${kidId}:` storage prefix back to the award key. */
function stripKidPrefix(storageKey: string, kidId: string): string {
  return storageKey.startsWith(`${kidId}:`) ? storageKey.slice(kidId.length + 1) : storageKey;
}

/** Drops the storage envelope (household, key, raw answer, pack version). */
/** A stored creation without its storage fields. */
function toCreation(r: Creation): Creation {
  return structuredClone({ id: r.id, kidId: r.kidId, kind: r.kind, title: r.title, versions: r.versions, currentVersion: r.currentVersion, sharedVersion: r.sharedVersion, createdAt: r.createdAt, updatedAt: r.updatedAt });
}

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
    ...(r.durationMs !== undefined ? { durationMs: r.durationMs } : {}),
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
 * Jordan's synthetic earlier history (yesterday afternoon, SG): two answered frog
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
      kidId: JORDAN_ID,
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
      kidId: JORDAN_ID,
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
      kidId: JORDAN_ID,
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
    { key: `${JORDAN_ID}:first_attempt:p3sci-demo-01`, kind: "stars", rule: "first_attempt", amount: 2, ref: "p3sci-demo-01", at: at(0), day, householdId: DEMO_HOUSEHOLD_ID, kidId: JORDAN_ID },
    { key: `${JORDAN_ID}:retry_revised:p3sci-demo-02`, kind: "stars", rule: "retry_revised", amount: 3, ref: "p3sci-demo-02", at: at(4), day, householdId: DEMO_HOUSEHOLD_ID, kidId: JORDAN_ID },
  ];
  for (const e of entries) store.ledgerRows.set(e.key, e);
  // Jordan's synthetic guardian week (lib/guardian/sample.ts): screen time and a few words to Kix, labelled "Sample".
  const week = sampleGuardianWeek();
  for (const b of week.beats) store.beatRows.set(`${JORDAN_ID}|${Date.parse(b.at)}`, { ...b, householdId: DEMO_HOUSEHOLD_ID, kidId: JORDAN_ID });
  for (const m of week.messages) store.kixMessageRows.push({ ...m, householdId: DEMO_HOUSEHOLD_ID, kidId: JORDAN_ID });
  // Guardian: the demo family's Home and School pins in Sengkang (synthetic), and who shares (same as supabase/seed.sql).
  for (const p of DEMO_PLACES) store.placeRows.set(p.id, { ...p, householdId: DEMO_HOUSEHOLD_ID });
  for (const [kidId, mode] of [[JORDAN_ID, "balanced"], [ABBY_ID, "school"], [LEONARD_ID, "balanced"]] as const) store.locationSettingRows.set(kidId, { kidId, enabled: true, mode, pausedUntil: null, householdId: DEMO_HOUSEHOLD_ID });
  store.guardianPrefRows.set(DEMO_HOUSEHOLD_ID, { ...DEFAULT_PREFS, descriptions: DEMO_DESCRIPTIONS });
}

/** A copy of a row without its household id (the store contract's shapes don't carry it). */
function withoutHousehold<T extends { householdId: string }>(row: T): Omit<T, "householdId"> {
  const out: Partial<T> = { ...row };
  delete out.householdId;
  return out as Omit<T, "householdId">;
}

/** The demo family's descriptions, in a parent's words, matching the synthetic camera frames' cast (public/art/sim). */
export const DEMO_DESCRIPTIONS: Record<string, string> = {
  [JORDAN_ID]: "Youngest, about 9, short straight black hair, often a light blue T-shirt",
  [ABBY_ID]: "About 12, curly chin-length hair, often a mustard-yellow T-shirt",
  [LEONARD_ID]: "About 14, long black ponytail and round glasses, often a grey hoodie",
};

/** The demo family's synthetic pins (GUARDIAN §2.1): a block near Sengkang's riverside and a primary school about 1.6 km away. */
export const DEMO_PLACES: readonly Place[] = [
  { id: "00000000-0000-4000-8000-0000000000b1", name: "Home", kind: "home", lat: 1.3895, lng: 103.9003, radiusM: 150 },
  { id: "00000000-0000-4000-8000-0000000000b2", name: "School", kind: "school", lat: 1.3966, lng: 103.8865, radiusM: 200 },
];
