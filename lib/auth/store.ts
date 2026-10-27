// The accounts store: one small interface, two implementations. Supabase (./store-supabase.ts) in
// real deployments; an in-memory demo store (./store-demo.ts) for `npm run dev` before Supabase keys
// exist. Every household method takes the caller's household id and must scope by it.
import type { CookieJar } from "./http.ts";
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
  dailyLimitMin: number | null;
  synthetic: boolean;
  secretKind: SecretKind | null;
  secretHash: string | null;
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
    | "dailyLimitMin"
    | "secretKind"
    | "secretHash"
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
