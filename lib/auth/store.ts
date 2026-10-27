// The accounts store: one small interface, two implementations. Supabase (./store-supabase.ts) in
// real deployments; an in-memory demo store (./store-demo.ts) for `npm run dev` before Supabase keys
// exist. Every household method takes the caller's household id and must scope by it.
import type { CookieJar } from "./http.ts";
import type { AttemptEvent } from "../domain/attempts.ts";
import type { LedgerEntry } from "../domain/rewards.ts";
import type { FocusMinute } from "../signals/focus.ts";
import type { FocusNote } from "../signals/schemas.ts";
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
