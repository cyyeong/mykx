// Supabase accounts store. The parent's session is Supabase Auth cookies through @supabase/ssr (with
// the publishable key); everything else uses the service-role client, which bypasses RLS, so every
// household query filters by the caller's household id explicitly. Keys never leave the server.
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { CookieJar } from "./http.ts";
import type { AuditEntry, AuthStore, AuthUser, Household, NewKid, Profile, ProfilePatch } from "./store.ts";
import { NicknameTakenError } from "./store.ts";

export interface SupabaseEnv {
  url: string;
  publishableKey: string;
  secretKey: string;
}

const COLUMNS =
  "id, household_id, user_id, role, is_admin, nickname, band, level, pack, voice_enabled, daily_limit_min, synthetic, secret_kind, secret_hash, secret_set_at, secret_event, failed_attempts, locked_until, disabled_at, last_sign_in_at, created_at";

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
    dailyLimitMin: (r.daily_limit_min as number | null) ?? null,
    synthetic: Boolean(r.synthetic),
    secretKind: (r.secret_kind as Profile["secretKind"]) ?? null,
    secretHash: (r.secret_hash as string | null) ?? null,
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
  dailyLimitMin: "daily_limit_min",
  secretKind: "secret_kind",
  secretHash: "secret_hash",
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
