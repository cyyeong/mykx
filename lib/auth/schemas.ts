// Sign-in shapes shared by the UI and the server: picture ids, levels, packs, zod schemas and the
// JSON the auth routes return. Safe to import from client components: no Node or server imports.
// Hashing lives in ./secrets.ts (server only). Spec: docs/prd/ACCOUNTS.md.
import { z } from "zod";

/** The nine pictures a junior code is made from. A code is exactly 4, in order (repeats allowed). */
export const PICTURE_IDS = ["idle", "thinking", "hint", "cheer", "dreamlight", "anime-sky", "toon-pop", "idol-stage", "pilot"] as const;
export type PictureId = (typeof PICTURE_IDS)[number];
export const PICTURE_CODE_LENGTH = 4;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;
export const NICKNAME_MAX = 20;

export const LEVELS = ["P3", "P6", "Sec 2"] as const;
export type Level = (typeof LEVELS)[number];
export const BANDS = ["junior", "teen"] as const;
export type Band = (typeof BANDS)[number];
export const PACKS = ["dreamlight", "anime-sky", "toon-pop", "idol-stage", "terrarium"] as const;
export type Pack = (typeof PACKS)[number];
export const SECRET_KINDS = ["pictures", "password"] as const;
export type SecretKind = (typeof SECRET_KINDS)[number];

/** Level sets the band (junior P1–P4, teen P5–Sec 4; MVP levels only). */
export const LEVEL_BAND: Record<Level, Band> = { P3: "junior", P6: "teen", "Sec 2": "teen" };
/** What the UI should offer by default: juniors get a picture code, teens a password. */
export const DEFAULT_SECRET_KIND: Record<Band, SecretKind> = { junior: "pictures", teen: "password" };

export const pictureCodeSchema = z.array(z.enum(PICTURE_IDS)).length(PICTURE_CODE_LENGTH);
export const passwordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);
/** Nickname as typed: trimmed, 1–20 characters. Tip for the UI: a nickname, not a full name. */
export const nicknameSchema = z.string().trim().min(1).max(NICKNAME_MAX);

/** A new code or password (the kid changing theirs, or setting a picture code at the door). */
export const secretSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pictures"), code: pictureCodeSchema }),
  z.object({ kind: z.literal("password"), password: passwordSchema }),
]);
export type SecretInput = z.infer<typeof secretSchema>;

/**
 * What a parent sends when adding a kid or resetting: a password (a temporary one on reset), or
 * `{ kind: "pictures" }` with no code, which leaves the code to be chosen with the kid at their door.
 */
export const parentSecretSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pictures"), code: pictureCodeSchema.optional() }),
  z.object({ kind: z.literal("password"), password: passwordSchema }),
]);
export type ParentSecretInput = z.infer<typeof parentSecretSchema>;

/**
 * A sign-in attempt. Passwords are only length-capped here, so a short guess is "wrong" (and counts
 * toward the lockout) rather than a validation error. Picture codes must still be 4 known ids.
 */
export const secretAttemptSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pictures"), code: pictureCodeSchema }),
  z.object({ kind: z.literal("password"), password: z.string().min(1).max(128) }),
]);
export type SecretAttempt = z.infer<typeof secretAttemptSchema>;

/** The string that gets hashed: picture ids joined with "|", or the password (NFC). */
export function canonicalSecret(secret: SecretAttempt): string {
  return secret.kind === "pictures" ? secret.code.join("|") : secret.password.normalize("NFC");
}

const id = z.guid();
/** True for a well-formed id (route params are checked before they reach the database). */
export const isId = (value: string) => id.safeParse(value).success;

// Request bodies (the routes validate with these; the UI may reuse them for forms).
export const parentSignInBody = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(256),
  /** Where to land after sign-in; the server allowlists it (USER_STORIES §8.4 fix 6). */
  next: z.string().max(256).optional(),
});
export const signOutBody = z.object({ everywhere: z.boolean().optional() });
export const resetBody = z.object({ email: z.string().trim().min(1).max(320) });
/** `setup: true` sets the first code (only when none is set) and signs in. */
export const kidSignInBody = z.object({ kidId: id, secret: secretAttemptSchema, setup: z.boolean().optional() });

/** The 4-digit parent PIN: set once in Your family, asked on grown-up pages while a kid is signed in. */
export const pinSchema = z.string().regex(/^\d{4}$/);
export const pinSetupBody = z.object({ pin: pinSchema });
export const pinVerifyBody = z.object({ pin: z.string().min(1).max(32) });
export const mePatchBody = z
  .object({ nickname: nicknameSchema.optional(), secret: z.object({ old: secretAttemptSchema, new: secretSchema }).optional(), pack: z.enum(PACKS).optional() })
  .refine((b) => b.nickname !== undefined || b.secret !== undefined || b.pack !== undefined, "Nothing to change");
/** `secret` may be left out for a picture-code kid (chosen with the kid later); a password kid needs one. */
export const addKidBody = z.object({ nickname: nicknameSchema, level: z.enum(LEVELS), pack: z.enum(PACKS), secret: parentSecretSchema.optional() });
export const updateKidBody = z
  .object({
    secret: parentSecretSchema.optional(), // { kind: "pictures" } clears the code; a password sets a temporary one
    dailyLimitMin: z.number().int().min(5).max(240).nullable().optional(),
    voiceEnabled: z.boolean().optional(),
    cameraEnabled: z.boolean().optional(), // the focus camera: on-device counts only (AGENTS.md rule 12)
    pack: z.enum(PACKS).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), "Nothing to change");
export const removeKidBody = z.object({ confirm: z.string() });
export const ADMIN_ACTIONS = ["lock", "unlock", "disable", "enable", "grant-admin", "revoke-admin", "reset-parent-password", "reset-kid-secret"] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];
export const adminActionBody = z.object({ action: z.enum(ADMIN_ACTIONS) });

// Response shapes.

/** A door on "Who's learning?". `needsSetup`: no code yet (new, or reset); choose one with the kid. */
export interface Door {
  id: string;
  nickname: string;
  band: Band;
  pack: Pack;
  level: Level;
  secretKind: SecretKind | null;
  needsSetup: boolean;
  locked: boolean;
}

/** GET /api/auth/kids and getDoors(). `grownUp`: the signed-in parent's name, or their email. */
export interface DoorsResult {
  signedIn: boolean;
  grownUp: string | null;
  kids: Door[];
}

export type SecretEvent = "set" | "changed" | "reset";

/** What the signed-in kid sees about themselves (GET /api/me). */
export interface KidMe {
  id: string;
  nickname: string;
  band: Band;
  level: Level;
  pack: Pack;
  secretKind: SecretKind | null;
  voiceEnabled: boolean;
  /** The focus camera runs on this kid's pages (counts only, on the device). */
  cameraEnabled: boolean;
  dailyLimitMin: number | null;
  synthetic: boolean;
}

/** A kid as the parent manages them ("Your family"). */
export interface FamilyKid {
  id: string;
  nickname: string;
  level: Level;
  band: Band;
  pack: Pack;
  secretKind: SecretKind | null;
  secretSetAt: string | null;
  /** What last happened to the code: first set, changed by the kid, or reset by a grown-up. */
  secretEvent: SecretEvent | null;
  lastSignInAt: string | null;
  voiceEnabled: boolean;
  cameraEnabled: boolean;
  dailyLimitMin: number | null;
  locked: boolean;
  needsSetup: boolean;
  disabled: boolean;
  synthetic: boolean;
}

/** GET /api/family/kids. */
export interface FamilyResult {
  household: { id: string; name: string };
  kids: FamilyKid[];
}

export type AccountStatus = "active" | "locked" | "disabled";

/** An account in the admin People search. Never messages, Notebook, answers or secrets. */
export interface PersonRow {
  id: string;
  role: "parent" | "child";
  nickname: string;
  isAdmin: boolean;
  status: AccountStatus;
  lastSignInAt: string | null;
  email: string | null; // parents only
  band: Band | null;
  level: Level | null;
  synthetic: boolean;
}

export interface HouseholdRow {
  id: string;
  name: string;
  people: PersonRow[];
}

/** Every failure body is `{ ok: false, reason }`. */
export type FailReason =
  | "invalid" // body failed validation (400)
  | "not-configured" // accounts aren't set up on this server (503)
  | "wrong" // wrong email/password or code (401)
  | "locked" // too many tries, or an admin lock (423)
  | "slow-down" // per-IP rate limit (429)
  | "no-parent" // no parent session on this device (401/403)
  | "no-kid" // no valid kid session (401)
  | "no-account" // signed in, but no myKx profile (403)
  | "not-found" // not in your household (403/404)
  | "disabled" // the account is disabled (403)
  | "needs-setup" // no code yet: sign in with setup: true to choose one (409)
  | "already-set" // setup: true, but a code is already set (409)
  | "wrong-kind" // a picture code for a password door, or the reverse (400)
  | "taken" // that nickname is already used in this family (409)
  | "too-many" // family is full (409)
  | "confirm" // the confirm text didn't match the nickname (400)
  | "self" // an admin can't lock, disable or demote themselves (400)
  | "not-allowed" // the action doesn't apply to this account (400/403)
  | "too-large" // an upload over its size limit (413)
  | "not-pdf" // an upload that isn't a PDF (415)
  | "nothing-approved" // publish with no approved knowledge (409)
  | "label" // a Notebook line that labels or diagnoses a child (400, rule 11)
  | "download-by-hand" // a scout find the agent may not download itself (409)
  | "download-failed" // the agent couldn't download a scout find (502; `note` says why)
  | "error"; // something went wrong on the server (500)

export interface Fail {
  ok: false;
  reason: FailReason;
  triesLeft?: number;
  retryAfterSec?: number | null;
  /** Plain words for an admin, where the reason alone isn't enough. */
  note?: string;
}
