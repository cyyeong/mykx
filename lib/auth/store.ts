// The accounts store: one small interface, two implementations. Supabase (./store-supabase.ts) in
// real deployments; an in-memory demo store (./store-demo.ts) for `npm run dev` before Supabase keys
// exist. Every household method takes the caller's household id and must scope by it.
import type { CookieJar } from "./http.ts";
import type { AttemptEvent } from "../domain/attempts.ts";
import type { LedgerEntry } from "../domain/rewards.ts";
import type { FocusMinute } from "../signals/focus.ts";
import type { FocusNote } from "../signals/schemas.ts";
import type { Beat, GuardianSettings } from "../guardian/screen-time.ts";
import type { KnowledgeUpload, Review, SkillUpdate } from "../knowledge/knowledge.ts";
import type { FlashcardSpec } from "../vibe/flashcards.ts";
import type { FamilyMessage, Sticker } from "../family/messages.ts";
import type { PageSlug } from "../notebook/notebook.ts";
import type { GameProgress } from "../games/progress.ts";
import type { FindStatus, PaperFind, ScoutRun } from "../papers/finds.ts";
import type { ScoutRow } from "../papers/scan.ts";
import type { KidLocationSettings, Place, PlaceEvent, StoredPoint } from "../location/location.ts";
import type { DeviceKind, GuardianPrefs, HomeCamera, HomeDevice, HomeStatus, RoomKind } from "../home-watch/home-watch.ts";
import type { Band, Level, Pack, SecretEvent, SecretKind } from "./schemas.ts";

/** A profiles row, server side. Holds the secret hash: never send one of these to a client as is. */
export interface Profile {
  id: string;
  householdId: string;
  userId: string | null;
  role: "parent" | "child";
  isAdmin: boolean;
  nickname: string;
  band: Band | null;
  level: Level | null;
  pack: Pack | null;
  voiceEnabled: boolean;
  /** The focus camera (on-device counts only), switched on by a grown-up. Off by default (rule 12). */
  cameraEnabled: boolean;
  dailyLimitMin: number | null;
  synthetic: boolean;
  secretKind: SecretKind | null;
  secretHash: string | null;
  /** The 4-digit parent PIN (scrypt hash, server only like secretHash). Null until set in Your family. */
  pinHash: string | null;
  secretSetAt: string | null;
  secretEvent: SecretEvent | null;
  failedAttempts: number;
  lockedUntil: string | null;
  disabledAt: string | null;
  lastSignInAt: string | null;
  createdAt: string;
}

/** Fields the server may change. */
export type ProfilePatch = Partial<
  Pick<
    Profile,
    | "nickname"
    | "pack"
    | "voiceEnabled"
    | "cameraEnabled"
    | "dailyLimitMin"
    | "secretKind"
    | "secretHash"
    | "pinHash"
    | "secretSetAt"
    | "secretEvent"
    | "failedAttempts"
    | "lockedUntil"
    | "disabledAt"
    | "isAdmin"
    | "lastSignInAt"
  >
>;

export interface NewKid {
  nickname: string;
  band: Band;
  level: Level;
  pack: Pack;
  secretKind: SecretKind;
  secretHash: string | null;
  secretSetAt: string | null;
  secretEvent: SecretEvent | null;
}

export interface Household {
  id: string;
  name: string;
}

export interface AuditEntry {
  actor: string | null;
  actorRole: "parent" | "admin" | "kid" | "system";
  action: string;
  target: string | null;
  householdId: string | null;
  /** Field names, reasons, counts. Never a child's messages, answers, Notebook, nickname or secrets. */
  detail?: Record<string, string | number | boolean | null | string[]>;
}

/** The signed-in grown-up, as the auth provider knows them. */
export interface AuthUser {
  userId: string;
  email: string | null;
}

/** A new "possibly losing focus" note, already checked by the server against the counts it holds. */
export type NewFocusNote = Pick<FocusNote, "from" | "to" | "evidence" | "confidence">;

/**
 * One submitted answer with its storage envelope. The `attempts` table has no
 * family, explanation or confirmed columns, so those ride along inside
 * `answer` ({ response, explanation, explanationRevised }) or are derived on
 * read (family from the item id; confirmed is always true — this store only
 * holds deterministically marked attempts).
 */
export interface StoredAttempt extends AttemptEvent {
  /** Client-generated per submission; a resend never writes twice. */
  idempotencyKey: string;
  /** The raw answer as given (option number or text). */
  answer: number | string | null;
  /** The child's own explanation, if they gave one (kept for the audit trail). */
  explanationText: string | null;
  /** Pack version the item came from. */
  skillVersion: string;
}

/** Thrown when a write hits the one-nickname-per-family rule. */
export class NicknameTakenError extends Error {
  constructor() {
    super("That nickname is already used in this family.");
    this.name = "NicknameTakenError";
  }
}

/** A 30 s heartbeat as stored: what the kid was doing, and whether they'd been idle a minute or more. */
export interface StoredBeat extends Beat {
  idle: boolean;
  synthetic?: boolean;
}

export interface NotebookPage {
  slug: PageSlug;
  body: string;
  updatedAt: string;
}

export interface NotebookRevision {
  slug: string;
  before: string;
  after: string;
  by: "memory-keeper" | "grown-up";
  reason: string | null;
  at: string;
}

/** One session's mood reading from the kid's own words (Muse Spark, Standard). */
export interface StoredSessionRead {
  sessionStart: string;
  sessionEnd: string;
  mood: string;
  confidence: "low" | "medium" | "high";
  evidence: string[];
  concern: boolean;
}

/** One model call as logged in `model_runs`: no prompt, output, audio or key. */
export interface StoredRun {
  at: string;
  route: string;
  operation: string;
  model: string;
  householdId: string | null;
  profileId: string | null;
  requestId: string | null;
  responseId: string | null;
  latencyMs: number | null;
  firstTokenMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  images: number | null;
  audioSeconds: number | null;
  costUsd: number | null;
  ok: boolean;
  error: string | null;
}

/** A Vibe Zone creation: its versions (each a validated spec) and the version shared with the grown-ups, if any. */
export interface Creation {
  id: string;
  kidId: string;
  kind: "flashcards";
  title: string;
  versions: FlashcardSpec[];
  /** 1-based, like the UI's "version 2". */
  currentVersion: number;
  sharedVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

/** The guardian settings a parent can change, apart from the daily limit (which lives on the profile). */
export type StoredGuardianSettings = Omit<GuardianSettings, "dailyLimitMin">;

/** Something the kid typed or said to Kix, with the server's safety reading. */
export interface StoredKixMessage {
  at: string;
  text: string;
  source: "talk" | "reason";
  distress: boolean;
  selfTalk: boolean;
  synthetic?: boolean;
}

export interface AuthStore {
  readonly mode: "supabase" | "demo";

  // Grown-up sessions (Supabase Auth cookies, or the signed demo cookie).
  signInParent(jar: CookieJar, email: string, password: string): Promise<AuthUser | null>;
  currentUser(jar: CookieJar): Promise<AuthUser | null>;
  signOutParent(jar: CookieJar, everywhere: boolean): Promise<void>;
  /** Sends a reset email if the address has an account. Never reveals whether it does. */
  sendPasswordReset(email: string, redirectTo: string): Promise<void>;

  // Household-scoped reads and writes.
  profileByUserId(userId: string): Promise<Profile | null>;
  household(householdId: string): Promise<Household | null>;
  kids(householdId: string): Promise<Profile[]>;
  kid(householdId: string, kidId: string): Promise<Profile | null>;
  /** Updates one profile in the household; null if it isn't there. Throws NicknameTakenError. */
  update(householdId: string, profileId: string, patch: ProfilePatch): Promise<Profile | null>;
  /** Throws NicknameTakenError. */
  addKid(householdId: string, kid: NewKid): Promise<Profile>;
  removeKid(householdId: string, kidId: string): Promise<boolean>;
  audit(entry: AuditEntry): Promise<void>;
  /** How many audit rows with `action` the household has had since `sinceIso` (the PIN's wrong-try pause). */
  countAudit(householdId: string, action: string, sinceIso: string): Promise<number>;

  // Learning record (the `attempts` and `ledger` tables), household-scoped like everything above.
  // Written by tested server code only, never by a model (supabase/schema.sql).
  // Ledger keys are per award (`rule:ref`); the stores namespace them per kid
  // (`${kidId}:${key}`) because `ledger.idempotency_key` is unique table-wide.
  learn: {
    /** The kid's attempts, oldest first. */
    attempts(householdId: string, kidId: string): Promise<AttemptEvent[]>;
    /** The attempt stored under an idempotency key, or null. */
    attemptByKey(householdId: string, kidId: string, key: string): Promise<AttemptEvent | null>;
    /** Stores one attempt; a resubmitted idempotency key (J17 offline retry) is ignored. */
    saveAttempt(householdId: string, kidId: string, attempt: StoredAttempt): Promise<void>;
    /** The kid's ledger entries, oldest first (storage keys stripped back to award keys). */
    ledger(householdId: string, kidId: string): Promise<LedgerEntry[]>;
    /** Appends entries, skipping keys already in the ledger (a replay never pays twice). */
    saveLedgerEntries(householdId: string, kidId: string, entries: readonly LedgerEntry[]): Promise<void>;
  };

  // Wellbeing signals (the `signals` table), household-scoped like everything above. Counts and notes only:
  // there is nowhere to put an image, a frame or a landmark (AGENTS.md rule 12).
  signals: {
    /** Stores a kid's per-minute camera counts. Idempotent per minute: a resent minute replaces the first. */
    saveFocusMinutes(householdId: string, kidId: string, minutes: readonly FocusMinute[]): Promise<void>;
    /** The kid's camera minutes since `sinceIso`, oldest first. */
    focusMinutes(householdId: string, kidId: string, sinceIso: string): Promise<FocusMinute[]>;
    /** The kid's most recent note, or null. */
    latestFocusNote(householdId: string, kidId: string): Promise<FocusNote | null>;
    /** Null when a note for the same minute already exists. */
    saveFocusNote(householdId: string, kidId: string, note: NewFocusNote): Promise<FocusNote | null>;
    /** The household's notes from `sinceIso` on, plus any sample notes, newest first. */
    focusNotes(householdId: string, sinceIso: string): Promise<FocusNote[]>;
    /** Removes one note; returns the kid it was about, or null when it isn't in the household. */
    removeFocusNote(householdId: string, noteId: string): Promise<string | null>;
    /** A grown-up's check on a note; returns the kid it was about, or null when it isn't in the household. */
    setFocusVerdict(householdId: string, noteId: string, verdict: "right" | "not-right" | null): Promise<string | null>;
  };

  // The guardian (screen_beats, kix_messages, guardian_settings, flags_seen), household-scoped like everything
  // above and written by tested server code only. The kid's own words to Kix live here, never family messages.
  guardian: {
    /** Stores one 30 s heartbeat; a second one in the same slot changes nothing. */
    saveBeat(householdId: string, kidId: string, beat: StoredBeat): Promise<void>;
    /** The kid's beats since `sinceIso`, oldest first. */
    beats(householdId: string, kidId: string, sinceIso: string): Promise<StoredBeat[]>;
    saveMessage(householdId: string, kidId: string, message: StoredKixMessage): Promise<void>;
    /** The kid's words to Kix since `sinceIso`, oldest first. */
    messages(householdId: string, kidId: string, sinceIso: string): Promise<StoredKixMessage[]>;
    /** The parent's guardian settings for the kid, or null for the band's defaults (the daily limit is on the profile). */
    settings(householdId: string, kidId: string): Promise<StoredGuardianSettings | null>;
    saveSettings(householdId: string, kidId: string, settings: StoredGuardianSettings): Promise<void>;
    /** Flag ids a grown-up marked as seen. */
    seenFlags(householdId: string): Promise<string[]>;
    markSeen(householdId: string, flagId: string): Promise<void>;
  };

  // Arcade progress (game_progress): one row per kid and game.
  games: {
    progress(householdId: string, kidId: string): Promise<GameProgress[]>;
    save(householdId: string, kidId: string, progress: GameProgress): Promise<void>;
  };

  // Every model call (model_runs), for Under the hood and cost. Writes come from lib/runs/log.ts.
  runs: {
    save(run: StoredRun): Promise<void>;
    /** The newest runs across every household (admins only, through an audited route). */
    recent(limit: number): Promise<StoredRun[]>;
  };

  // Family messages (never read by Kix or a model), the Notebook, and session readings. Household-scoped.
  family: {
    /** The household's grown-ups (for a kid's reply). */
    grownUps(householdId: string): Promise<Profile[]>;
    /** The thread between two people, oldest first (the last 60). */
    thread(householdId: string, a: string, b: string): Promise<FamilyMessage[]>;
    /** Unread messages to someone, oldest first. */
    unread(householdId: string, to: string): Promise<FamilyMessage[]>;
    send(householdId: string, m: { from: string; to: string; body: string | null; sticker: Sticker | null; byVoice: boolean }): Promise<FamilyMessage | null>;
    markRead(householdId: string, to: string, ids: readonly string[]): Promise<void>;
  };
  notebook: {
    pages(householdId: string, kidId: string): Promise<NotebookPage[]>;
    /** Writes a page and records the revision. */
    write(householdId: string, kidId: string, slug: PageSlug, body: string, by: NotebookRevision["by"], reason: string | null): Promise<void>;
    revisions(householdId: string, kidId: string, limit: number): Promise<NotebookRevision[]>;
    /** Wipes every page and its history for the kid (a grown-up's choice). */
    wipe(householdId: string, kidId: string): Promise<void>;
    saveRead(householdId: string, kidId: string, read: StoredSessionRead): Promise<void>;
    reads(householdId: string, kidId: string, sinceIso: string): Promise<StoredSessionRead[]>;
  };

  // Vibe Zone creations (the `creations` and `shares` tables), household-scoped; shares only to the household's
  // own grown-ups (rls.sql checks the recipient).
  creations: {
    /** Newest first; one kid's when `kidId` is given. */
    list(householdId: string, kidId?: string): Promise<Creation[]>;
    /** Saves a new creation (id null) or adds a version to one; returns it. */
    saveVersion(householdId: string, kidId: string, id: string | null, spec: FlashcardSpec): Promise<Creation | null>;
    /** Shares one version with the given grown-ups, replacing any earlier share of this creation. */
    share(householdId: string, creationId: string, version: number, recipientIds: readonly string[]): Promise<void>;
    revoke(householdId: string, creationId: string): Promise<void>;
  };

  // The knowledge agent's uploads and published pack updates: platform content, admins only (callers check first).
  knowledge: {
    saveUpload(upload: KnowledgeUpload): Promise<void>;
    /** Newest first. */
    uploads(): Promise<KnowledgeUpload[]>;
    setReview(id: string, review: Review): Promise<void>;
    markPublished(ids: readonly string[], version: string): Promise<void>;
    saveUpdate(update: SkillUpdate): Promise<void>;
    /** Published updates, oldest first; one pack's when `pack` is given. */
    updates(pack?: string): Promise<SkillUpdate[]>;
  };

  // The weekly past-paper scout's finds (links and decisions, never papers) and runs: platform content; the cron
  // route (CRON_SECRET) or an admin route writes, admins read.
  papers: {
    /** Upserts the scan's rows by key (findKey; keeping each find's status) and records the run; returns it. */
    saveScan(run: Omit<ScoutRun, "fresh" | "found" | "auto" | "manual" | "skip">, rows: readonly ScoutRow[]): Promise<ScoutRun>;
    /** Newest first by last seen. */
    finds(): Promise<PaperFind[]>;
    find(id: string): Promise<PaperFind | null>;
    setFind(id: string, patch: { status: FindStatus; uploadId?: string | null }): Promise<PaperFind | null>;
    /** Marks several finds at once (never a "read" one back to new); returns how many changed. */
    setStatus(ids: readonly string[], status: Exclude<FindStatus, "read">): Promise<number>;
    /** Newest first. */
    runs(limit: number): Promise<ScoutRun[]>;
  };

  // Guardian, where they are (docs/prd/GUARDIAN.md §2.1): household-scoped; the routes check who is asking.
  whereabouts: {
    /** The kids' sharing settings that exist (a kid without a row isn't shared). */
    settings(householdId: string): Promise<KidLocationSettings[]>;
    saveSettings(householdId: string, kidId: string, patch: Partial<Omit<KidLocationSettings, "kidId">>): Promise<KidLocationSettings>;
    /** Stores points (a repeated kid-and-time is skipped) and drops points older than 30 days; returns how many were new. */
    addPoints(householdId: string, points: readonly StoredPoint[]): Promise<number>;
    /** One kid's points since `sinceIso`, oldest first. */
    track(householdId: string, kidId: string, sinceIso: string): Promise<StoredPoint[]>;
    /** Each kid's newest point. */
    latest(householdId: string): Promise<StoredPoint[]>;
    places(householdId: string): Promise<Place[]>;
    /** Adds a place, or updates one by id; null if the id isn't this household's. */
    savePlace(householdId: string, place: Omit<Place, "id"> & { id?: string }): Promise<Place | null>;
    deletePlace(householdId: string, id: string): Promise<boolean>;
    addEvents(householdId: string, events: readonly Omit<PlaceEvent, "id">[]): Promise<void>;
    /** Arrived and left events since `sinceIso`, newest first. */
    events(householdId: string, sinceIso: string): Promise<PlaceEvent[]>;
  };

  // Guardian, Home watch (GUARDIAN §2.2): devices, cameras and room statuses (words only, never frames).
  homeWatch: {
    /** The family's Guardian preferences, or the defaults. */
    prefs(householdId: string): Promise<GuardianPrefs>;
    savePrefs(householdId: string, prefs: GuardianPrefs): Promise<GuardianPrefs>;
    createDevice(householdId: string, device: { name: string; kind: DeviceKind; pairCodeHash: string; pairExpiresAt: string; createdBy: string | null }): Promise<HomeDevice>;
    /** Swaps an unexpired, unused pairing code for a token (both as hashes); null if the code is wrong, used or late. */
    claimDevice(pairCodeHash: string, tokenHash: string, nowIso: string): Promise<HomeDevice | null>;
    /** The paired, unrevoked device with this token hash. */
    deviceByToken(tokenHash: string): Promise<HomeDevice | null>;
    devices(householdId: string): Promise<HomeDevice[]>;
    revokeDevice(householdId: string, id: string): Promise<boolean>;
    /** Notes the visit and spends `n` frames from the device's budget for `day`; false (nothing spent) when over `max`. */
    spendFrames(deviceId: string, day: string, n: number, max: number, nowIso: string): Promise<boolean>;
    /** Upserts a device's cameras by key; cameras it no longer lists are switched off. */
    syncCameras(householdId: string, deviceId: string, cameras: readonly { key: string; room: string; roomKind: RoomKind; enabled: boolean }[]): Promise<HomeCamera[]>;
    cameras(householdId: string): Promise<HomeCamera[]>;
    touchCameras(householdId: string, cameraIds: readonly string[], at: string): Promise<void>;
    /** Stores readings (and each camera's last status time), dropping statuses older than 14 days. */
    saveStatuses(householdId: string, rows: readonly Omit<HomeStatus, "id">[]): Promise<void>;
    /** Statuses since `sinceIso`, newest first. */
    statuses(householdId: string, sinceIso: string): Promise<HomeStatus[]>;
  };

  // Admin only: callers check the admin flag first (lib/auth/context.ts requireAdmin).
  admin: {
    search(q: string, limit: number): Promise<{ household: Household; people: Profile[] }[]>;
    profile(profileId: string): Promise<Profile | null>;
    update(profileId: string, patch: ProfilePatch): Promise<Profile | null>;
    /** Parents' sign-in emails by auth user id (for the People page and reset emails). */
    emails(userIds: string[]): Promise<Map<string, string>>;
    /** Blocks or unblocks sign-in at the auth provider (disable/enable). */
    setBanned(userId: string, banned: boolean): Promise<void>;
  };
}
