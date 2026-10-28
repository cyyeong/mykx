// Supabase accounts store. The parent's session is Supabase Auth cookies through @supabase/ssr (with
// the publishable key); everything else uses the service-role client, which bypasses RLS, so every
// household query filters by the caller's household id explicitly. Keys never leave the server.
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FocusMinute } from "../signals/focus.ts";
import type { FocusNote } from "../signals/schemas.ts";
import type { CookieJar } from "./http.ts";
import { familyOf, type AttemptEvent } from "../domain/attempts.ts";
import { sgDate } from "../domain/time.ts";
import type { LedgerEntry } from "../domain/rewards.ts";
import type { AuditEntry, AuthStore, AuthUser, Household, NewFocusNote, NewKid, Profile, ProfilePatch, StoredAttempt, StoredBeat, StoredGuardianSettings, StoredKixMessage, Creation, NotebookPage, NotebookRevision, StoredSessionRead, StoredRun } from "./store.ts";
import { BEAT_MS, type ActivityKind } from "../guardian/screen-time.ts";
import type { Extraction, KnowledgeUpload, Review, Rights, SkillUpdate } from "../knowledge/knowledge.ts";
import type { FlashcardSpec } from "../vibe/flashcards.ts";
import type { FamilyMessage, Sticker } from "../family/messages.ts";
import type { PageSlug } from "../notebook/notebook.ts";
import type { GameProgress } from "../games/progress.ts";
import { findFields, findKey, runCounts, type FindStatus, type PaperFind, type ScoutRun } from "../papers/finds.ts";
import type { ScoutRow } from "../papers/scan.ts";
import { NicknameTakenError } from "./store.ts";

export interface SupabaseEnv {
  url: string;
  publishableKey: string;
  secretKey: string;
}

const COLUMNS =
  "id, household_id, user_id, role, is_admin, nickname, band, level, pack, voice_enabled, camera_enabled, daily_limit_min, synthetic, secret_kind, secret_hash, pin_hash, secret_set_at, secret_event, failed_attempts, locked_until, disabled_at, last_sign_in_at, created_at";

type Row = Record<string, unknown>;

function toProfile(r: Row): Profile {
  return {
    id: r.id as string,
    householdId: r.household_id as string,
    userId: (r.user_id as string | null) ?? null,
    role: r.role as Profile["role"],
    isAdmin: Boolean(r.is_admin),
    nickname: r.nickname as string,
    band: (r.band as Profile["band"]) ?? null,
    level: (r.level as Profile["level"]) ?? null,
    pack: (r.pack as Profile["pack"]) ?? null,
    voiceEnabled: Boolean(r.voice_enabled),
    cameraEnabled: Boolean(r.camera_enabled),
    dailyLimitMin: (r.daily_limit_min as number | null) ?? null,
    synthetic: Boolean(r.synthetic),
    secretKind: (r.secret_kind as Profile["secretKind"]) ?? null,
    secretHash: (r.secret_hash as string | null) ?? null,
    pinHash: (r.pin_hash as string | null) ?? null,
    secretSetAt: (r.secret_set_at as string | null) ?? null,
    secretEvent: (r.secret_event as Profile["secretEvent"]) ?? null,
    failedAttempts: (r.failed_attempts as number) ?? 0,
    lockedUntil: (r.locked_until as string | null) ?? null,
    disabledAt: (r.disabled_at as string | null) ?? null,
    lastSignInAt: (r.last_sign_in_at as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

const PATCH_COLUMNS: Record<keyof ProfilePatch, string> = {
  nickname: "nickname",
  pack: "pack",
  voiceEnabled: "voice_enabled",
  cameraEnabled: "camera_enabled",
  dailyLimitMin: "daily_limit_min",
  secretKind: "secret_kind",
  secretHash: "secret_hash",
  pinHash: "pin_hash",
  secretSetAt: "secret_set_at",
  secretEvent: "secret_event",
  failedAttempts: "failed_attempts",
  lockedUntil: "locked_until",
  disabledAt: "disabled_at",
  isAdmin: "is_admin",
  lastSignInAt: "last_sign_in_at",
};

function toRow(patch: ProfilePatch): Row {
  const row: Row = {};
  for (const [key, value] of Object.entries(patch)) if (value !== undefined) row[PATCH_COLUMNS[key as keyof ProfilePatch]] = value;
  return row;
}

type DbError = { code?: string; message?: string } | null;

const FIND_COLUMNS = "id, site, title, level, subject, year, exam_type, school, page_url, file_url, fetch_mode, reason, pack, pack_is_new, status, upload_id, first_seen, last_seen";
function toFind(r: Record<string, unknown>): PaperFind {
  return {
    id: r.id as string,
    site: r.site as PaperFind["site"],
    title: r.title as string,
    level: (r.level as PaperFind["level"]) ?? null,
    subject: (r.subject as string | null) ?? null,
    year: (r.year as number | null) ?? null,
    type: (r.exam_type as string | null) ?? null,
    school: (r.school as string | null) ?? null,
    pageUrl: r.page_url as string,
    fileUrl: (r.file_url as string | null) ?? null,
    fetch: r.fetch_mode as PaperFind["fetch"],
    reason: r.reason as string,
    pack: (r.pack as string | null) ?? null,
    packIsNew: Boolean(r.pack_is_new),
    status: r.status as FindStatus,
    uploadId: (r.upload_id as string | null) ?? null,
    firstSeen: new Date(r.first_seen as string).toISOString(),
    lastSeen: new Date(r.last_seen as string).toISOString(),
  };
}
const toRun = (r: Record<string, unknown>): ScoutRun => ({ id: r.id as string, at: new Date(r.at as string).toISOString(), trigger: r.trigger as ScoutRun["trigger"], found: Number(r.found), fresh: Number(r.fresh), auto: Number(r.auto), manual: Number(r.manual), skip: Number(r.skip), problems: (r.problems as string[]) ?? [] });

function check(error: DbError) {
  if (!error) return;
  if (error.code === "23505" && /nickname/.test(error.message ?? "")) throw new NicknameTakenError();
  throw new Error(`accounts store: ${error.code ?? "error"}`); // no row data in the message
}

// The `signals` table (supabase/schema.sql). Camera minutes keep the four counts in `counts`; notes keep their
// window, evidence and confidence. Nothing else exists to be stored.
const MINUTE_KIND = "camera-minute";
const NOTE_KIND = "focus-watch";
const NOTE_COLUMNS = "id, profile_id, minute, until, evidence, confidence, synthetic, verdict";

function toFocusMinute(r: Row): FocusMinute {
  const c = (r.counts ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    minute: new Date(r.minute as string).toISOString(),
    awaySeconds: n(c.awaySeconds),
    eyesClosedEvents: n(c.eyesClosedEvents),
    yawns: n(c.yawns),
    facePresentRatio: n(c.facePresentRatio),
  };
}

/** The `answer` envelope (store.ts): the raw response plus the child's explanation. */
function toAttemptEvent(r: Row): AttemptEvent {
  const a = (r.answer ?? {}) as { explanation?: unknown; revised?: unknown };
  const explanationText = typeof a.explanation === "string" && a.explanation.trim() ? a.explanation : null;
  return {
    id: r.id as string,
    itemId: r.item_id as string,
    family: familyOf({ id: r.item_id as string }),
    skill: r.skill_id as string,
    topic: r.topic as string,
    subskill: (r.subskill as string | null) ?? "",
    at: new Date(r.created_at as string).toISOString(),
    marks: Number(r.marks),
    maxMarks: Number(r.max_marks),
    firstTry: Boolean(r.first_try),
    hintsBeforeSubmit: Number(r.hints_used ?? 0),
    revealed: Boolean(r.revealed),
    // This store only holds deterministically marked attempts (open items need review first).
    confirmed: true,
    ...(explanationText ? { explanation: true } : {}),
    ...(a.revised === true ? { explanationRevised: true } : {}),
    ...(r.duration_ms != null ? { durationMs: Number(r.duration_ms) } : {}),
  };
}

function toLedgerEntry(r: Row, kidId: string): LedgerEntry {
  const at = new Date(r.created_at as string).toISOString();
  const storageKey = r.idempotency_key as string;
  return {
    key: storageKey.startsWith(`${kidId}:`) ? storageKey.slice(kidId.length + 1) : storageKey,
    kind: r.kind as LedgerEntry["kind"],
    rule: r.rule as LedgerEntry["rule"],
    amount: Number(r.amount),
    ...(typeof r.ref === "string" && r.ref ? { ref: r.ref } : {}),
    at,
    day: sgDate(at),
  };
}

const MESSAGE_COLUMNS = "id, sender_profile_id, recipient_profile_id, body, sticker, by_voice, created_at, read_at";
function toMessage(r: Row): FamilyMessage {
  return {
    id: r.id as string,
    from: r.sender_profile_id as string,
    to: r.recipient_profile_id as string,
    body: (r.body as string | null) ?? null,
    sticker: (r.sticker as Sticker | null) ?? null,
    byVoice: Boolean(r.by_voice),
    at: new Date(r.created_at as string).toISOString(),
    readAt: r.read_at ? new Date(r.read_at as string).toISOString() : null,
  };
}

function toSessionRead(r: Row): StoredSessionRead {
  return {
    sessionStart: new Date(r.session_start as string).toISOString(),
    sessionEnd: new Date(r.session_end as string).toISOString(),
    mood: r.mood as string,
    confidence: r.confidence as StoredSessionRead["confidence"],
    evidence: (r.evidence as string[]) ?? [],
    concern: Boolean(r.concern),
  };
}

function toFocusNote(r: Row): FocusNote {
  return {
    id: r.id as string,
    kidId: r.profile_id as string,
    from: new Date(r.minute as string).toISOString(),
    to: new Date(r.until as string).toISOString(),
    evidence: (r.evidence as string) ?? "",
    confidence: (r.confidence as FocusNote["confidence"]) ?? "low",
    synthetic: Boolean(r.synthetic),
    verdict: r.verdict === "right" || r.verdict === "not-right" ? r.verdict : null,
  };
}

/** `%`, `_` and `\` are wildcards to ilike; match them literally. */
const likeEscape = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SupabaseStore implements AuthStore {
  readonly mode = "supabase" as const;
  private readonly db: SupabaseClient;
  private readonly env: SupabaseEnv;

  // A plain field, not a parameter property, so Node's type stripping can run scripts that use this store.
  constructor(env: SupabaseEnv) {
    this.env = env;
    this.db = createClient(env.url, env.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }

  /** A per-request client that reads and writes the parent's auth cookies through the jar. */
  private session(jar: CookieJar) {
    return createServerClient(this.env.url, this.env.publishableKey, {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (cookies, headers) => {
          for (const { name, value, options } of cookies) jar.set(name, value, options as Parameters<CookieJar["set"]>[2]);
          if (headers) jar.setHeaders(headers);
        },
      },
    });
  }

  // Sessions

  async signInParent(jar: CookieJar, email: string, password: string): Promise<AuthUser | null> {
    const { data, error } = await this.session(jar).auth.signInWithPassword({ email, password });
    if (error || !data.user) return null;
    return { userId: data.user.id, email: data.user.email ?? null };
  }

  async currentUser(jar: CookieJar): Promise<AuthUser | null> {
    if (!jar.getAll().some((c) => c.name.startsWith("sb-"))) return null; // no session cookie: skip the round trip
    const { data, error } = await this.session(jar).auth.getUser();
    if (error || !data.user) return null;
    return { userId: data.user.id, email: data.user.email ?? null };
  }

  async signOutParent(jar: CookieJar, everywhere: boolean): Promise<void> {
    await this.session(jar).auth.signOut({ scope: everywhere ? "global" : "local" });
  }

  async sendPasswordReset(email: string, redirectTo: string): Promise<void> {
    // Errors (unknown address, rate limit) are swallowed so the reply never reveals which it was.
    await this.db.auth.resetPasswordForEmail(email, { redirectTo }).catch(() => undefined);
  }

  // Household-scoped

  async profileByUserId(userId: string) {
    const { data, error } = await this.db.from("profiles").select(COLUMNS).eq("user_id", userId).maybeSingle();
    check(error);
    return data ? toProfile(data) : null;
  }

  async household(householdId: string): Promise<Household | null> {
    const { data, error } = await this.db.from("households").select("id, name").eq("id", householdId).maybeSingle();
    check(error);
    return data ? { id: data.id as string, name: data.name as string } : null;
  }

  async kids(householdId: string) {
    const { data, error } = await this.db
      .from("profiles")
      .select(COLUMNS)
      .eq("household_id", householdId)
      .eq("role", "child")
      .order("created_at")
      .order("id");
    check(error);
    return (data ?? []).map(toProfile);
  }

  async kid(householdId: string, kidId: string) {
    const { data, error } = await this.db.from("profiles").select(COLUMNS).eq("household_id", householdId).eq("id", kidId).eq("role", "child").maybeSingle();
    check(error);
    return data ? toProfile(data) : null;
  }

  async update(householdId: string, profileId: string, patch: ProfilePatch) {
    const { data, error } = await this.db.from("profiles").update(toRow(patch)).eq("household_id", householdId).eq("id", profileId).select(COLUMNS).maybeSingle();
    check(error);
    return data ? toProfile(data) : null;
  }

  async addKid(householdId: string, kid: NewKid) {
    const { data, error } = await this.db
      .from("profiles")
      .insert({
        household_id: householdId,
        role: "child",
        nickname: kid.nickname,
        band: kid.band,
        level: kid.level,
        pack: kid.pack,
        secret_kind: kid.secretKind,
        secret_hash: kid.secretHash,
        secret_set_at: kid.secretSetAt,
        secret_event: kid.secretEvent,
      })
      .select(COLUMNS)
      .single();
    check(error);
    return toProfile(data as Row);
  }

  async removeKid(householdId: string, kidId: string) {
    const { data, error } = await this.db.from("profiles").delete().eq("household_id", householdId).eq("id", kidId).eq("role", "child").select("id");
    check(error);
    return (data ?? []).length > 0;
  }

  async audit(entry: AuditEntry) {
    const { error } = await this.db.from("audit_log").insert({
      actor: entry.actor,
      actor_role: entry.actorRole,
      action: entry.action,
      target: entry.target,
      household_id: entry.householdId,
      detail: entry.detail ?? {},
    });
    check(error);
  }

  async countAudit(householdId: string, action: string, sinceIso: string) {
    const { count, error } = await this.db
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("action", action)
      .gte("created_at", sinceIso);
    check(error);
    return count ?? 0;
  }

  // Wellbeing signals. The service role bypasses RLS, so each query filters by household; writes check the kid
  // is in it first.

  private async ownsKid(householdId: string, kidId: string) {
    return (await this.kid(householdId, kidId)) !== null;
  }

  // Learning record (`attempts`, `ledger`). Same household filtering; writes are idempotent by key.

  readonly learn = {
    attempts: async (householdId: string, kidId: string): Promise<AttemptEvent[]> => {
      const { data, error } = await this.db
        .from("attempts")
        .select("id, item_id, skill_id, topic, subskill, answer, marks, max_marks, first_try, hints_used, revealed, duration_ms, created_at")
        .eq("household_id", householdId)
        .eq("profile_id", kidId)
        .order("created_at")
        .limit(5000);
      check(error);
      return (data ?? []).map(toAttemptEvent);
    },
    attemptByKey: async (householdId: string, kidId: string, key: string): Promise<AttemptEvent | null> => {
      const { data, error } = await this.db
        .from("attempts")
        .select("id, item_id, skill_id, topic, subskill, answer, marks, max_marks, first_try, hints_used, revealed, duration_ms, created_at")
        .eq("household_id", householdId)
        .eq("profile_id", kidId)
        .eq("idempotency_key", key)
        .maybeSingle();
      check(error);
      return data ? toAttemptEvent(data) : null;
    },
    saveAttempt: async (householdId: string, kidId: string, attempt: StoredAttempt): Promise<void> => {
      if (!(await this.ownsKid(householdId, kidId))) return;
      const { error } = await this.db
        .from("attempts")
        .upsert(
          {
            household_id: householdId,
            profile_id: kidId,
            skill_id: attempt.skill,
            skill_version: attempt.skillVersion,
            item_id: attempt.itemId,
            topic: attempt.topic,
            subskill: attempt.subskill,
            answer: { response: attempt.answer, explanation: attempt.explanationText, revised: Boolean(attempt.explanationRevised) },
            marks: attempt.marks,
            max_marks: attempt.maxMarks,
            correct: attempt.marks >= attempt.maxMarks,
            first_try: attempt.firstTry,
            hints_used: attempt.hintsBeforeSubmit,
            revealed: attempt.revealed,
            duration_ms: attempt.durationMs ?? null,
            idempotency_key: attempt.idempotencyKey,
            created_at: attempt.at,
          },
          { onConflict: "idempotency_key", ignoreDuplicates: true },
        );
      check(error);
    },
    ledger: async (householdId: string, kidId: string): Promise<LedgerEntry[]> => {
      const { data, error } = await this.db
        .from("ledger")
        .select("kind, ref, amount, rule, idempotency_key, created_at")
        .eq("household_id", householdId)
        .eq("profile_id", kidId)
        .order("created_at")
        .limit(5000);
      check(error);
      return (data ?? []).map((r) => toLedgerEntry(r, kidId));
    },
    saveLedgerEntries: async (householdId: string, kidId: string, entries: readonly LedgerEntry[]): Promise<void> => {
      if (!entries.length || !(await this.ownsKid(householdId, kidId))) return;
      const { error } = await this.db
        .from("ledger")
        .upsert(
          entries.map((e) => ({
            household_id: householdId,
            profile_id: kidId,
            kind: e.kind,
            ref: e.ref ?? null,
            amount: e.amount,
            rule: e.rule,
            // idempotency_key is unique table-wide; award keys repeat per kid.
            idempotency_key: `${kidId}:${e.key}`,
            created_at: e.at,
          })),
          { onConflict: "idempotency_key", ignoreDuplicates: true },
        );
      check(error);
    },
  };

  readonly signals = {
    saveFocusMinutes: async (householdId: string, kidId: string, minutes: readonly FocusMinute[]) => {
      if (!minutes.length || !(await this.ownsKid(householdId, kidId))) return;
      const rows = minutes.map((m) => ({
        household_id: householdId,
        profile_id: kidId,
        kind: MINUTE_KIND,
        minute: m.minute,
        counts: { awaySeconds: m.awaySeconds, eyesClosedEvents: m.eyesClosedEvents, yawns: m.yawns, facePresentRatio: m.facePresentRatio },
      }));
      const { error } = await this.db.from("signals").upsert(rows, { onConflict: "profile_id,kind,minute" });
      check(error);
    },
    focusMinutes: async (householdId: string, kidId: string, sinceIso: string) => {
      const { data, error } = await this.db
        .from("signals")
        .select("minute, counts")
        .eq("household_id", householdId)
        .eq("profile_id", kidId)
        .eq("kind", MINUTE_KIND)
        .gte("minute", sinceIso)
        .order("minute")
        .limit(5000);
      check(error);
      return (data ?? []).map(toFocusMinute);
    },
    latestFocusNote: async (householdId: string, kidId: string) => {
      const { data, error } = await this.db
        .from("signals")
        .select(NOTE_COLUMNS)
        .eq("household_id", householdId)
        .eq("profile_id", kidId)
        .eq("kind", NOTE_KIND)
        .order("minute", { ascending: false })
        .limit(1)
        .maybeSingle();
      check(error);
      return data ? toFocusNote(data) : null;
    },
    saveFocusNote: async (householdId: string, kidId: string, note: NewFocusNote) => {
      if (!(await this.ownsKid(householdId, kidId))) return null;
      const { data, error } = await this.db
        .from("signals")
        .upsert(
          { household_id: householdId, profile_id: kidId, kind: NOTE_KIND, minute: note.from, until: note.to, evidence: note.evidence, confidence: note.confidence },
          { onConflict: "profile_id,kind,minute", ignoreDuplicates: true },
        )
        .select(NOTE_COLUMNS);
      check(error);
      const row = (data ?? [])[0];
      return row ? toFocusNote(row) : null;
    },
    focusNotes: async (householdId: string, sinceIso: string) => {
      const { data, error } = await this.db
        .from("signals")
        .select(NOTE_COLUMNS)
        .eq("household_id", householdId)
        .eq("kind", NOTE_KIND)
        .or(`minute.gte."${sinceIso}",synthetic.is.true`)
        .order("minute", { ascending: false })
        .limit(50);
      check(error);
      return (data ?? []).map(toFocusNote);
    },
    removeFocusNote: async (householdId: string, noteId: string) => {
      if (!UUID.test(noteId)) return null;
      const { data, error } = await this.db.from("signals").delete().eq("household_id", householdId).eq("kind", NOTE_KIND).eq("id", noteId).select("profile_id");
      check(error);
      return ((data ?? [])[0]?.profile_id as string | undefined) ?? null;
    },
    setFocusVerdict: async (householdId: string, noteId: string, verdict: "right" | "not-right" | null) => {
      if (!UUID.test(noteId)) return null;
      const { data, error } = await this.db
        .from("signals")
        .update({ verdict, verdict_at: verdict ? new Date().toISOString() : null })
        .eq("household_id", householdId)
        .eq("kind", NOTE_KIND)
        .eq("id", noteId)
        .select("profile_id");
      check(error);
      return ((data ?? [])[0]?.profile_id as string | undefined) ?? null;
    },
  };

  // The guardian (screen_beats, kix_messages, guardian_settings, flags_seen). Same household filtering.
  readonly guardian = {
    saveBeat: async (householdId: string, kidId: string, beat: StoredBeat) => {
      if (!(await this.ownsKid(householdId, kidId))) return;
      const slot = new Date(Math.floor(Date.parse(beat.at) / BEAT_MS) * BEAT_MS).toISOString();
      const { error } = await this.db
        .from("screen_beats")
        .upsert({ household_id: householdId, profile_id: kidId, slot, kind: beat.kind, idle: beat.idle }, { onConflict: "profile_id,slot", ignoreDuplicates: true });
      check(error);
    },
    beats: async (householdId: string, kidId: string, sinceIso: string) => {
      const { data, error } = await this.db
        .from("screen_beats")
        .select("slot, kind, idle, synthetic")
        .eq("household_id", householdId)
        .eq("profile_id", kidId)
        .gte("slot", sinceIso)
        .order("slot")
        .limit(20000);
      check(error);
      return (data ?? []).map((r) => ({
        at: new Date(r.slot as string).toISOString(),
        kind: r.kind as ActivityKind,
        idle: Boolean(r.idle),
        ...(r.synthetic ? { synthetic: true } : {}),
      }));
    },
    saveMessage: async (householdId: string, kidId: string, m: StoredKixMessage) => {
      if (!(await this.ownsKid(householdId, kidId))) return;
      const { error } = await this.db.from("kix_messages").insert({
        household_id: householdId,
        profile_id: kidId,
        at: m.at,
        text: m.text.slice(0, 500),
        source: m.source,
        distress: m.distress,
        self_talk: m.selfTalk,
      });
      check(error);
    },
    messages: async (householdId: string, kidId: string, sinceIso: string) => {
      const { data, error } = await this.db
        .from("kix_messages")
        .select("at, text, source, distress, self_talk, synthetic")
        .eq("household_id", householdId)
        .eq("profile_id", kidId)
        .gte("at", sinceIso)
        .order("at")
        .limit(2000);
      check(error);
      return (data ?? []).map((r) => ({
        at: new Date(r.at as string).toISOString(),
        text: r.text as string,
        source: r.source as StoredKixMessage["source"],
        distress: Boolean(r.distress),
        selfTalk: Boolean(r.self_talk),
        ...(r.synthetic ? { synthetic: true } : {}),
      }));
    },
    settings: async (householdId: string, kidId: string): Promise<StoredGuardianSettings | null> => {
      const { data, error } = await this.db
        .from("guardian_settings")
        .select("quiet_from_hour, quiet_to_hour, break_every_min, learn_min_min, play_max_min")
        .eq("household_id", householdId)
        .eq("profile_id", kidId)
        .maybeSingle();
      check(error);
      return data
        ? { quietFromHour: data.quiet_from_hour, quietToHour: data.quiet_to_hour, breakEveryMin: data.break_every_min, learnMinMin: data.learn_min_min, playMaxMin: data.play_max_min }
        : null;
    },
    saveSettings: async (householdId: string, kidId: string, g: StoredGuardianSettings) => {
      if (!(await this.ownsKid(householdId, kidId))) return;
      const { error } = await this.db.from("guardian_settings").upsert(
        {
          profile_id: kidId,
          household_id: householdId,
          quiet_from_hour: g.quietFromHour,
          quiet_to_hour: g.quietToHour,
          break_every_min: g.breakEveryMin,
          learn_min_min: g.learnMinMin,
          play_max_min: g.playMaxMin,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      );
      check(error);
    },
    seenFlags: async (householdId: string) => {
      const { data, error } = await this.db.from("flags_seen").select("flag_id").eq("household_id", householdId).limit(1000);
      check(error);
      return (data ?? []).map((r) => r.flag_id as string);
    },
    markSeen: async (householdId: string, flagId: string) => {
      const { error } = await this.db.from("flags_seen").upsert({ household_id: householdId, flag_id: flagId.slice(0, 200) }, { onConflict: "household_id,flag_id", ignoreDuplicates: true });
      check(error);
    },
  };

  // Vibe Zone creations and shares. Same household filtering; a share's recipient must be in the household.
  readonly creations = {
    list: async (householdId: string, kidId?: string): Promise<Creation[]> => {
      let q = this.db.from("creations").select("id, profile_id, kind, title, versions, current_version, created_at, updated_at").eq("household_id", householdId);
      if (kidId) q = q.eq("profile_id", kidId);
      const { data, error } = await q.order("updated_at", { ascending: false }).limit(100);
      check(error);
      const ids = (data ?? []).map((r) => r.id as string);
      const shared = new Map<string, number>();
      if (ids.length) {
        const s = await this.db.from("shares").select("creation_id, version").eq("household_id", householdId).in("creation_id", ids).is("revoked_at", null);
        check(s.error);
        for (const r of s.data ?? []) shared.set(r.creation_id as string, Number(r.version));
      }
      return (data ?? []).map((r) => ({
        id: r.id as string,
        kidId: r.profile_id as string,
        kind: "flashcards" as const,
        title: r.title as string,
        versions: (r.versions as FlashcardSpec[]) ?? [],
        currentVersion: Number(r.current_version),
        sharedVersion: shared.get(r.id as string) ?? null,
        createdAt: new Date(r.created_at as string).toISOString(),
        updatedAt: new Date(r.updated_at as string).toISOString(),
      }));
    },
    saveVersion: async (householdId: string, kidId: string, id: string | null, spec: FlashcardSpec): Promise<Creation | null> => {
      if (!(await this.ownsKid(householdId, kidId))) return null;
      const now = new Date().toISOString();
      if (!id) {
        const { data, error } = await this.db
          .from("creations")
          .insert({ household_id: householdId, profile_id: kidId, kind: "flashcards", title: spec.title.slice(0, 60), versions: [spec], current_version: 1, created_at: now, updated_at: now })
          .select("id")
          .single();
        check(error);
        if (!data) return null;
        return { id: data.id as string, kidId, kind: "flashcards", title: spec.title, versions: [spec], currentVersion: 1, sharedVersion: null, createdAt: now, updatedAt: now };
      }
      const cur = await this.db.from("creations").select("versions, created_at").eq("household_id", householdId).eq("profile_id", kidId).eq("id", id).maybeSingle();
      check(cur.error);
      if (!cur.data) return null;
      const versions = [...((cur.data.versions as FlashcardSpec[]) ?? []), spec];
      const { error } = await this.db.from("creations").update({ title: spec.title.slice(0, 60), versions, current_version: versions.length, updated_at: now }).eq("id", id).eq("household_id", householdId);
      check(error);
      return { id, kidId, kind: "flashcards", title: spec.title, versions, currentVersion: versions.length, sharedVersion: null, createdAt: new Date(cur.data.created_at as string).toISOString(), updatedAt: now };
    },
    share: async (householdId: string, creationId: string, version: number, recipientIds: readonly string[]) => {
      const now = new Date().toISOString();
      const r = await this.db.from("shares").update({ revoked_at: now }).eq("household_id", householdId).eq("creation_id", creationId).is("revoked_at", null);
      check(r.error);
      if (!recipientIds.length) return;
      const { error } = await this.db.from("shares").insert(recipientIds.map((rid) => ({ household_id: householdId, creation_id: creationId, version, recipient_profile_id: rid })));
      check(error);
    },
    revoke: async (householdId: string, creationId: string) => {
      const { error } = await this.db.from("shares").update({ revoked_at: new Date().toISOString() }).eq("household_id", householdId).eq("creation_id", creationId).is("revoked_at", null);
      check(error);
    },
  };

  readonly games = {
    progress: async (householdId: string, kidId: string): Promise<GameProgress[]> => {
      const { data, error } = await this.db.from("game_progress").select("game, stage, level, stars, best_accuracy, best_wpm, keys, updated_at").eq("household_id", householdId).eq("profile_id", kidId);
      check(error);
      return (data ?? []).map((r) => ({
        game: r.game as string,
        stage: Number(r.stage),
        level: Number(r.level),
        stars: (r.stars as Record<string, number>) ?? {},
        bestAccuracy: Number(r.best_accuracy),
        bestWpm: Number(r.best_wpm),
        keys: (r.keys as GameProgress["keys"]) ?? {},
        updatedAt: new Date(r.updated_at as string).toISOString(),
      }));
    },
    save: async (householdId: string, kidId: string, p: GameProgress) => {
      if (!(await this.ownsKid(householdId, kidId))) return;
      const { error } = await this.db.from("game_progress").upsert(
        { household_id: householdId, profile_id: kidId, game: p.game, stage: p.stage, level: p.level, stars: p.stars, best_accuracy: Math.round(p.bestAccuracy * 10000) / 10000, best_wpm: p.bestWpm, keys: p.keys, updated_at: p.updatedAt },
        { onConflict: "profile_id,game" },
      );
      check(error);
    },
  };

  readonly runs = {
    save: async (run: StoredRun) => {
      const { error } = await this.db.from("model_runs").insert({
        household_id: run.householdId,
        profile_id: run.profileId,
        route: run.route,
        operation: run.operation,
        model: run.model,
        request_id: run.requestId,
        response_id: run.responseId,
        latency_ms: run.latencyMs,
        first_token_ms: run.firstTokenMs,
        input_tokens: run.inputTokens,
        output_tokens: run.outputTokens,
        images: run.images,
        audio_seconds: run.audioSeconds,
        cost_usd: run.costUsd,
        ok: run.ok,
        error: run.error?.slice(0, 300) ?? null,
        created_at: run.at,
      });
      check(error);
    },
    recent: async (limit: number): Promise<StoredRun[]> => {
      const { data, error } = await this.db
        .from("model_runs")
        .select("created_at, route, operation, model, household_id, profile_id, request_id, response_id, latency_ms, first_token_ms, input_tokens, output_tokens, images, audio_seconds, cost_usd, ok, error")
        .order("created_at", { ascending: false })
        .limit(limit);
      check(error);
      const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
      return (data ?? []).map((r) => ({
        at: new Date(r.created_at as string).toISOString(),
        route: r.route as string,
        operation: r.operation as string,
        model: r.model as string,
        householdId: (r.household_id as string | null) ?? null,
        profileId: (r.profile_id as string | null) ?? null,
        requestId: (r.request_id as string | null) ?? null,
        responseId: (r.response_id as string | null) ?? null,
        latencyMs: n(r.latency_ms),
        firstTokenMs: n(r.first_token_ms),
        inputTokens: n(r.input_tokens),
        outputTokens: n(r.output_tokens),
        images: n(r.images),
        audioSeconds: n(r.audio_seconds),
        costUsd: n(r.cost_usd),
        ok: Boolean(r.ok),
        error: (r.error as string | null) ?? null,
      }));
    },
  };

  readonly family = {
    grownUps: async (householdId: string): Promise<Profile[]> => {
      const { data, error } = await this.db.from("profiles").select(COLUMNS).eq("household_id", householdId).eq("role", "parent");
      check(error);
      return (data ?? []).map(toProfile);
    },
    thread: async (householdId: string, a: string, b: string): Promise<FamilyMessage[]> => {
      if (![a, b].every((id) => UUID.test(id))) return [];
      const { data, error } = await this.db
        .from("family_messages")
        .select(MESSAGE_COLUMNS)
        .eq("household_id", householdId)
        .or(`and(sender_profile_id.eq.${a},recipient_profile_id.eq.${b}),and(sender_profile_id.eq.${b},recipient_profile_id.eq.${a})`)
        .order("created_at", { ascending: false })
        .limit(60);
      check(error);
      return (data ?? []).map(toMessage).reverse();
    },
    unread: async (householdId: string, to: string): Promise<FamilyMessage[]> => {
      const { data, error } = await this.db.from("family_messages").select(MESSAGE_COLUMNS).eq("household_id", householdId).eq("recipient_profile_id", to).is("read_at", null).order("created_at").limit(30);
      check(error);
      return (data ?? []).map(toMessage);
    },
    send: async (householdId: string, m: { from: string; to: string; body: string | null; sticker: Sticker | null; byVoice: boolean }): Promise<FamilyMessage | null> => {
      const both = await this.db.from("profiles").select("id").eq("household_id", householdId).in("id", [m.from, m.to]);
      check(both.error);
      if ((both.data ?? []).length !== 2) return null;
      const { data, error } = await this.db
        .from("family_messages")
        .insert({ household_id: householdId, sender_profile_id: m.from, recipient_profile_id: m.to, body: m.body, sticker: m.sticker, by_voice: m.byVoice })
        .select(MESSAGE_COLUMNS)
        .single();
      check(error);
      return data ? toMessage(data) : null;
    },
    markRead: async (householdId: string, to: string, ids: readonly string[]) => {
      const valid = ids.filter((id) => UUID.test(id));
      if (!valid.length) return;
      const { error } = await this.db.from("family_messages").update({ read_at: new Date().toISOString() }).eq("household_id", householdId).eq("recipient_profile_id", to).in("id", valid).is("read_at", null);
      check(error);
    },
  };

  readonly notebook = {
    pages: async (householdId: string, kidId: string): Promise<NotebookPage[]> => {
      const { data, error } = await this.db.from("notebook_pages").select("slug, body, updated_at").eq("household_id", householdId).eq("profile_id", kidId);
      check(error);
      return (data ?? []).map((r) => ({ slug: r.slug as PageSlug, body: r.body as string, updatedAt: new Date(r.updated_at as string).toISOString() }));
    },
    write: async (householdId: string, kidId: string, slug: PageSlug, body: string, by: NotebookRevision["by"], reason: string | null) => {
      if (!(await this.ownsKid(householdId, kidId))) return;
      const cur = await this.db.from("notebook_pages").select("body").eq("profile_id", kidId).eq("slug", slug).maybeSingle();
      check(cur.error);
      const now = new Date().toISOString();
      const up = await this.db.from("notebook_pages").upsert({ household_id: householdId, profile_id: kidId, slug, body, updated_at: now }, { onConflict: "profile_id,slug" });
      check(up.error);
      const { error } = await this.db.from("notebook_revisions").insert({ household_id: householdId, profile_id: kidId, slug, before: (cur.data?.body as string) ?? "", after: body, by, reason });
      check(error);
    },
    revisions: async (householdId: string, kidId: string, limit: number): Promise<NotebookRevision[]> => {
      const { data, error } = await this.db.from("notebook_revisions").select("slug, before, after, by, reason, created_at").eq("household_id", householdId).eq("profile_id", kidId).order("created_at", { ascending: false }).limit(limit);
      check(error);
      return (data ?? []).map((r) => ({ slug: r.slug as string, before: r.before as string, after: r.after as string, by: r.by as NotebookRevision["by"], reason: (r.reason as string | null) ?? null, at: new Date(r.created_at as string).toISOString() }));
    },
    wipe: async (householdId: string, kidId: string) => {
      const a = await this.db.from("notebook_revisions").delete().eq("household_id", householdId).eq("profile_id", kidId);
      check(a.error);
      const b = await this.db.from("notebook_pages").delete().eq("household_id", householdId).eq("profile_id", kidId);
      check(b.error);
    },
    saveRead: async (householdId: string, kidId: string, read: StoredSessionRead) => {
      if (!(await this.ownsKid(householdId, kidId))) return;
      const { error } = await this.db.from("session_reads").upsert(
        { household_id: householdId, profile_id: kidId, session_start: read.sessionStart, session_end: read.sessionEnd, mood: read.mood, confidence: read.confidence, evidence: read.evidence, concern: read.concern },
        { onConflict: "profile_id,session_start" },
      );
      check(error);
    },
    reads: async (householdId: string, kidId: string, sinceIso: string): Promise<StoredSessionRead[]> => {
      const { data, error } = await this.db.from("session_reads").select("session_start, session_end, mood, confidence, evidence, concern").eq("household_id", householdId).eq("profile_id", kidId).gte("session_end", sinceIso).order("session_end");
      check(error);
      return (data ?? []).map(toSessionRead);
    },
  };

  // The knowledge agent (knowledge_uploads, skill_updates): platform content; the route checks the admin flag.
  readonly knowledge = {
    saveUpload: async (u: KnowledgeUpload) => {
      const { error } = await this.db.from("knowledge_uploads").insert({
        id: u.id,
        uploaded_by: u.uploadedBy,
        file_name: u.fileName.slice(0, 200),
        bytes: u.bytes,
        rights: u.rights,
        source_url: u.sourceUrl,
        status: u.status,
        pack: u.pack,
        pack_is_new: u.packIsNew,
        extraction: u.extraction,
        review: u.review,
        published_in: u.publishedIn,
        error: u.error?.slice(0, 300) ?? null,
        created_at: u.createdAt,
      });
      check(error);
    },
    uploads: async (): Promise<KnowledgeUpload[]> => {
      const { data, error } = await this.db.from("knowledge_uploads").select("*").order("created_at", { ascending: false }).limit(200);
      check(error);
      return (data ?? []).map((r) => ({
        id: r.id as string,
        uploadedBy: r.uploaded_by as string,
        fileName: r.file_name as string,
        bytes: Number(r.bytes),
        rights: r.rights as Rights,
        sourceUrl: (r.source_url as string | null) ?? null,
        status: r.status as KnowledgeUpload["status"],
        pack: (r.pack as string | null) ?? null,
        packIsNew: Boolean(r.pack_is_new),
        extraction: (r.extraction as Extraction | null) ?? null,
        review: (r.review as Review) ?? {},
        publishedIn: (r.published_in as string | null) ?? null,
        error: (r.error as string | null) ?? null,
        createdAt: new Date(r.created_at as string).toISOString(),
      }));
    },
    setReview: async (id: string, review: Review) => {
      const { error } = await this.db.from("knowledge_uploads").update({ review }).eq("id", id).is("published_in", null);
      check(error);
    },
    markPublished: async (ids: readonly string[], version: string) => {
      if (!ids.length) return;
      const { error } = await this.db.from("knowledge_uploads").update({ published_in: version }).in("id", [...ids]);
      check(error);
    },
    saveUpdate: async (u: SkillUpdate) => {
      const { error } = await this.db.from("skill_updates").insert({
        id: u.id,
        pack: u.pack,
        version: u.version,
        published_by: u.publishedBy,
        published_at: u.publishedAt,
        summary: u.summary.slice(0, 300),
        payload: { archetypes: u.archetypes, traps: u.traps, markingCues: u.markingCues, items: u.items },
      });
      check(error);
    },
    updates: async (pack?: string): Promise<SkillUpdate[]> => {
      let q = this.db.from("skill_updates").select("*").order("published_at");
      if (pack) q = q.eq("pack", pack);
      const { data, error } = await q.limit(200);
      check(error);
      return (data ?? []).map((r) => {
        const p = r.payload as Pick<SkillUpdate, "archetypes" | "traps" | "markingCues" | "items">;
        return { id: r.id as string, pack: r.pack as string, version: r.version as string, publishedBy: (r.published_by as string | null) ?? "", publishedAt: new Date(r.published_at as string).toISOString(), summary: r.summary as string, archetypes: p.archetypes ?? [], traps: p.traps ?? [], markingCues: p.markingCues ?? [], items: p.items ?? [] };
      });
    },
  };

  // The weekly paper scout (paper_finds, scout_runs): platform content; the cron or admin route writes.
  readonly papers = {
    saveScan: async (run: Omit<ScoutRun, "fresh" | "found" | "auto" | "manual" | "skip">, rows: readonly ScoutRow[]): Promise<ScoutRun> => {
      const { data: known, error: e1 } = await this.db.from("paper_finds").select("key").limit(5000);
      check(e1);
      const seen = new Set((known ?? []).map((k) => k.key as string));
      const unique = new Map(rows.map((r) => [findKey(findFields(r)), findFields(r)]));
      const fresh = [...unique.keys()].filter((k) => !seen.has(k)).length;
      // Status, first seen and the upload are left out, so an existing find keeps them and a new one gets defaults.
      const payload = [...unique.entries()].map(([key, f]) => ({ key, site: f.site, title: f.title, level: f.level, subject: f.subject, year: f.year, exam_type: f.type, school: f.school, page_url: f.pageUrl, file_url: f.fileUrl, fetch_mode: f.fetch, reason: f.reason, pack: f.pack, pack_is_new: f.packIsNew, last_seen: run.at }));
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await this.db.from("paper_finds").upsert(payload.slice(i, i + 200), { onConflict: "key" });
        check(error);
      }
      const saved: ScoutRun = { ...run, ...runCounts(rows), fresh, problems: run.problems.slice(0, 60).map((p) => p.slice(0, 400)) };
      const { error } = await this.db.from("scout_runs").insert({ id: saved.id, at: saved.at, trigger: saved.trigger, found: saved.found, fresh, auto: saved.auto, manual: saved.manual, skip: saved.skip, problems: saved.problems });
      check(error);
      return saved;
    },
    finds: async (): Promise<PaperFind[]> => {
      const { data, error } = await this.db.from("paper_finds").select(FIND_COLUMNS).order("last_seen", { ascending: false }).order("year", { ascending: false }).limit(1000);
      check(error);
      return (data ?? []).map(toFind);
    },
    find: async (id: string): Promise<PaperFind | null> => {
      const { data, error } = await this.db.from("paper_finds").select(FIND_COLUMNS).eq("id", id).maybeSingle();
      check(error);
      return data ? toFind(data) : null;
    },
    setFind: async (id: string, patch: { status: FindStatus; uploadId?: string | null }): Promise<PaperFind | null> => {
      const { data, error } = await this.db.from("paper_finds").update({ status: patch.status, ...(patch.uploadId !== undefined ? { upload_id: patch.uploadId } : {}) }).eq("id", id).select(FIND_COLUMNS).maybeSingle();
      check(error);
      return data ? toFind(data) : null;
    },
    setStatus: async (ids: readonly string[], status: Exclude<FindStatus, "read">): Promise<number> => {
      if (!ids.length) return 0;
      const { data, error } = await this.db.from("paper_finds").update({ status }).in("id", [...ids]).neq("status", "read").select("id");
      check(error);
      return data?.length ?? 0;
    },
    runs: async (limit: number): Promise<ScoutRun[]> => {
      const { data, error } = await this.db.from("scout_runs").select("*").order("at", { ascending: false }).limit(limit);
      check(error);
      return (data ?? []).map(toRun);
    },
  };

  // Admin

  readonly admin = {
    search: async (q: string, limit: number) => {
      const needle = q.trim();
      let ids: string[];
      if (!needle) {
        const { data, error } = await this.db.from("households").select("id").order("created_at", { ascending: false }).limit(limit);
        check(error);
        ids = (data ?? []).map((h) => h.id as string);
      } else {
        const found = new Set<string>();
        const pattern = `%${likeEscape(needle)}%`;
        const [byName, byNick] = await Promise.all([
          this.db.from("households").select("id").ilike("name", pattern).limit(limit),
          this.db.from("profiles").select("household_id").ilike("nickname", pattern).limit(limit),
        ]);
        check(byName.error);
        check(byNick.error);
        for (const h of byName.data ?? []) found.add(h.id as string);
        for (const p of byNick.data ?? []) found.add(p.household_id as string);
        if (UUID.test(needle)) {
          const [h, p] = await Promise.all([
            this.db.from("households").select("id").eq("id", needle),
            this.db.from("profiles").select("household_id").or(`id.eq.${needle},user_id.eq.${needle}`),
          ]);
          for (const row of h.data ?? []) found.add(row.id as string);
          for (const row of p.data ?? []) found.add(row.household_id as string);
        }
        if (needle.includes("@")) {
          const users = await this.listUsers();
          const matching = users.filter((u) => u.email?.toLowerCase().includes(needle.toLowerCase())).map((u) => u.id);
          if (matching.length) {
            const { data, error } = await this.db.from("profiles").select("household_id").in("user_id", matching);
            check(error);
            for (const row of data ?? []) found.add(row.household_id as string);
          }
        }
        ids = [...found].slice(0, limit);
      }
      if (!ids.length) return [];
      const [households, people] = await Promise.all([
        this.db.from("households").select("id, name").in("id", ids),
        this.db.from("profiles").select(COLUMNS).in("household_id", ids).order("role", { ascending: false }).order("nickname"),
      ]);
      check(households.error);
      check(people.error);
      const profiles = (people.data ?? []).map(toProfile);
      return (households.data ?? []).map((h) => ({
        household: { id: h.id as string, name: h.name as string },
        people: profiles.filter((p) => p.householdId === h.id),
      }));
    },
    profile: async (profileId: string) => {
      const { data, error } = await this.db.from("profiles").select(COLUMNS).eq("id", profileId).maybeSingle();
      check(error);
      return data ? toProfile(data) : null;
    },
    update: async (profileId: string, patch: ProfilePatch) => {
      const { data, error } = await this.db.from("profiles").update(toRow(patch)).eq("id", profileId).select(COLUMNS).maybeSingle();
      check(error);
      return data ? toProfile(data) : null;
    },
    emails: async (userIds: string[]) => {
      const out = new Map<string, string>();
      if (!userIds.length) return out;
      const wanted = new Set(userIds);
      for (const u of await this.listUsers()) if (wanted.has(u.id) && u.email) out.set(u.id, u.email);
      return out;
    },
    setBanned: async (userId: string, banned: boolean) => {
      const { error } = await this.db.auth.admin.updateUserById(userId, { ban_duration: banned ? "876000h" : "none" });
      if (error) throw new Error("accounts store: could not update the sign-in ban");
    },
  };

  // Hackathon scale: one page of up to 1000 auth users.
  private async listUsers() {
    const { data, error } = await this.db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error("accounts store: could not list users");
    return data.users;
  }
}
