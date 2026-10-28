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
import type { AuditEntry, AuthStore, AuthUser, Household, NewFocusNote, NewKid, Profile, ProfilePatch, StoredAttempt } from "./store.ts";
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

function check(error: DbError) {
  if (!error) return;
  if (error.code === "23505" && /nickname/.test(error.message ?? "")) throw new NicknameTakenError();
  throw new Error(`accounts store: ${error.code ?? "error"}`); // no row data in the message
}

// The `signals` table (supabase/schema.sql). Camera minutes keep the four counts in `counts`; notes keep their
// window, evidence and confidence. Nothing else exists to be stored.
const MINUTE_KIND = "camera-minute";
const NOTE_KIND = "focus-watch";
const NOTE_COLUMNS = "id, profile_id, minute, until, evidence, confidence, synthetic";

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

function toFocusNote(r: Row): FocusNote {
  return {
    id: r.id as string,
    kidId: r.profile_id as string,
    from: new Date(r.minute as string).toISOString(),
    to: new Date(r.until as string).toISOString(),
    evidence: (r.evidence as string) ?? "",
    confidence: (r.confidence as FocusNote["confidence"]) ?? "low",
    synthetic: Boolean(r.synthetic),
  };
}

/** `%`, `_` and `\` are wildcards to ilike; match them literally. */
const likeEscape = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SupabaseStore implements AuthStore {
  readonly mode = "supabase" as const;
  private readonly db: SupabaseClient;

  constructor(private readonly env: SupabaseEnv) {
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
        .select("id, item_id, skill_id, topic, subskill, answer, marks, max_marks, first_try, hints_used, revealed, created_at")
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
        .select("id, item_id, skill_id, topic, subskill, answer, marks, max_marks, first_try, hints_used, revealed, created_at")
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
