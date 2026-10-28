// Row-level security tests on PGlite (Postgres in WebAssembly), so household isolation is proven
// before Supabase exists. The cross-household test from the plan's definition of done lives here.
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const sql = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

const PARENT_A = "aaaaaaaa-0000-4000-8000-000000000001";
const PARENT_B = "bbbbbbbb-0000-4000-8000-000000000001";
const HOUSE_A = "00000000-0000-4000-8000-000000000001"; // the seeded demo family
const HOUSE_B = "bbbbbbbb-0000-4000-8000-0000000000aa";
const ARI = "00000000-0000-4000-8000-000000000011";
const KID_B = "bbbbbbbb-0000-4000-8000-0000000000c1";

let db: PGlite;

/** Runs `fn` as a signed-in parent (or anon when `userId` is null), then returns to superuser. */
async function as<T>(userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
  await db.exec(`set role ${userId ? "authenticated" : "anon"}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  for (const f of ["test-auth-stub.sql", "schema.sql", "rls.sql", "seed.sql"]) await db.exec(sql(f));
  await db.exec(`
    insert into auth.users (id) values ('${PARENT_A}'), ('${PARENT_B}');
    update profiles set user_id = '${PARENT_A}' where id = '00000000-0000-4000-8000-000000000010';
    insert into households (id, name) values ('${HOUSE_B}', 'Other family');
    insert into profiles (household_id, user_id, role, nickname) values ('${HOUSE_B}', '${PARENT_B}', 'parent', 'Other Parent');
    insert into profiles (id, household_id, role, nickname, band, level, pack) values ('${KID_B}', '${HOUSE_B}', 'child', 'Kai', 'junior', 'P3', 'toon-pop');
    insert into attempts (household_id, profile_id, skill_id, skill_version, item_id, topic, answer, correct, marks, max_marks, first_try, idempotency_key)
      values ('${HOUSE_A}', '${ARI}', 'p3-science', '1.0.0', 'p3sci-lc-001', 'cycles.animal', '{"choice":2}', true, 1, 1, true, 'a-1'),
             ('${HOUSE_B}', '${KID_B}', 'p3-science', '1.0.0', 'p3sci-lc-001', 'cycles.animal', '{"choice":3}', false, 0, 1, true, 'b-1');
    insert into creations (id, household_id, profile_id, kind, title) values
      ('cccccccc-0000-4000-8000-00000000000b', '${HOUSE_B}', '${KID_B}', 'flashcards', 'B deck');
  `);
});

afterAll(async () => {
  await db.close();
});

describe("household isolation (row-level security)", () => {
  it("a parent sees only their own household's profiles and attempts", async () => {
    const names = await as(PARENT_A, () => db.query<{ nickname: string }>("select nickname from profiles order by nickname"));
    expect(names.rows.map((r) => r.nickname)).toEqual(["Ari", "Demo Parent", "Mei", "Zara"]);
    const attempts = await as(PARENT_A, () => db.query<{ idempotency_key: string }>("select idempotency_key from attempts"));
    // Ari's synthetic seed history (seed.sql) plus the row this file inserts.
    expect(attempts.rows.map((r) => r.idempotency_key)).toEqual(["seed:ari:p3sci-demo-01", "seed:ari:p3sci-demo-02-try1", "seed:ari:p3sci-demo-02-try2", "a-1"]);
  });

  it("can't change another household's child", async () => {
    const res = await as(PARENT_A, () => db.query(`update profiles set pack = 'dreamlight' where id = $1`, [KID_B]));
    expect(res.affectedRows).toBe(0);
  });

  it("can change its own child's allowed settings, but not their name", async () => {
    const ok = await as(PARENT_A, () => db.query(`update profiles set pack = 'dreamlight' where id = $1`, [ARI]));
    expect(ok.affectedRows).toBe(1);
    await expect(as(PARENT_A, () => db.query(`update profiles set nickname = 'X' where id = $1`, [ARI]))).rejects.toThrow(/permission denied/);
  });

  it("can't create or share into another household", async () => {
    await expect(
      as(PARENT_A, () => db.query(`insert into creations (household_id, profile_id, kind, title) values ($1, $2, 'flashcards', 'x')`, [HOUSE_B, KID_B])),
    ).rejects.toThrow(/row-level security/);
    const mine = await as(PARENT_A, () =>
      db.query<{ id: string }>(`insert into creations (household_id, profile_id, kind, title) values ($1, $2, 'flashcards', 'Frog deck') returning id`, [HOUSE_A, ARI]),
    );
    await expect(
      as(PARENT_A, () => db.query(`insert into shares (household_id, creation_id, version, recipient_profile_id) values ($1, $2, 0, $3)`, [HOUSE_A, mine.rows[0].id, KID_B])),
    ).rejects.toThrow(/row-level security/);
  });

  it("can't write progress directly: attempts and the ledger are server-only", async () => {
    await expect(
      as(PARENT_A, () =>
        db.query(`insert into ledger (household_id, profile_id, kind, rule, idempotency_key) values ($1, $2, 'stars', 'cheat', 'x')`, [HOUSE_A, ARI]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("gives anonymous visitors nothing", async () => {
    await expect(as(null, () => db.query("select * from profiles"))).rejects.toThrow(/permission denied/);
  });
});

describe("integrity", () => {
  it("grants each attempt and reward once (idempotency keys)", async () => {
    await expect(
      db.query(
        `insert into attempts (household_id, profile_id, skill_id, skill_version, item_id, topic, answer, correct, marks, max_marks, first_try, idempotency_key)
         values ($1, $2, 'p3-science', '1.0.0', 'x', 't', '{}', true, 1, 1, true, 'a-1')`,
        [HOUSE_A, ARI],
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it("refuses contributor-mode models in model_runs (hard rule 1)", async () => {
    await expect(
      db.query(`insert into model_runs (route, operation, model, ok) values ('/api/kix/tutor', 'chat', 'muse-spark-1.3-contributor', true)`),
    ).rejects.toThrow(/check constraint/);
  });

  it("requires a band and level for children", async () => {
    await expect(db.query(`insert into profiles (household_id, role, nickname) values ($1, 'child', 'No band')`, [HOUSE_A])).rejects.toThrow(/check constraint/);
  });
});

describe("accounts (ACCOUNTS.md §5)", () => {
  const HOUSE_C = "cccccccc-0000-4000-8000-0000000000aa";
  const PARENT_C = "cccccccc-0000-4000-8000-000000000001";

  beforeAll(async () => {
    await db.exec(`
      insert into audit_log (actor, actor_role, action, target, household_id, detail)
        values ('00000000-0000-4000-8000-000000000010', 'admin', 'admin.lock', '${KID_B}', '${HOUSE_B}', '{"role":"child"}');
      insert into auth.users (id) values ('${PARENT_C}');
      insert into households (id, name) values ('${HOUSE_C}', 'Disabled family');
      insert into profiles (household_id, user_id, role, is_admin, nickname, disabled_at)
        values ('${HOUSE_C}', '${PARENT_C}', 'parent', true, 'Gone Parent', now());
      insert into profiles (household_id, role, nickname, band, level, pack) values ('${HOUSE_C}', 'child', 'Pip', 'junior', 'P3', 'terrarium');
    `);
  });

  it("never lets a client read a kid's secret hash, but does show the rest", async () => {
    await expect(as(PARENT_A, () => db.query("select secret_hash from profiles"))).rejects.toThrow(/permission denied/);
    const rows = await as(PARENT_A, () =>
      db.query<{ nickname: string; secret_kind: string | null; failed_attempts: number }>(
        "select nickname, secret_kind, failed_attempts from profiles where role = 'child' order by nickname",
      ),
    );
    expect(rows.rows.map((r) => [r.nickname, r.secret_kind])).toEqual([
      ["Ari", "pictures"],
      ["Mei", "password"],
      ["Zara", "password"],
    ]);
  });

  it("keeps nicknames, secrets, locks and the admin flag behind server routes", async () => {
    for (const set of ["nickname = 'Ariel'", "secret_hash = null", "failed_attempts = 0", "locked_until = null", "disabled_at = now()", "is_admin = true"]) {
      await expect(as(PARENT_A, () => db.query(`update profiles set ${set} where id = $1`, [ARI]))).rejects.toThrow(/permission denied/);
    }
  });

  it("shows the audit log to admins only, and nobody can write it from the browser", async () => {
    const admin = await as(PARENT_A, () => db.query<{ action: string }>("select action from audit_log"));
    expect(admin.rows.map((r) => r.action)).toEqual(["admin.lock"]);
    const parent = await as(PARENT_B, () => db.query("select * from audit_log"));
    expect(parent.rows).toEqual([]);
    await expect(
      as(PARENT_A, () => db.query(`insert into audit_log (actor_role, action) values ('admin', 'admin.unlock')`)),
    ).rejects.toThrow(/permission denied/);
    await expect(as(PARENT_A, () => db.query(`delete from audit_log`))).rejects.toThrow(/permission denied/);
    await expect(as(null, () => db.query("select * from audit_log"))).rejects.toThrow(/permission denied/);
  });

  it("a disabled account loses its household and its admin rights", async () => {
    const profiles = await as(PARENT_C, () => db.query("select nickname from profiles"));
    expect(profiles.rows).toEqual([]);
    const audit = await as(PARENT_C, () => db.query("select * from audit_log"));
    expect(audit.rows).toEqual([]);
  });

  it("stores hashes only, and keeps account rows well formed", async () => {
    const kid = (nickname: string, extra = "", values = "") =>
      db.query(`insert into profiles (household_id, role, nickname, band, level${extra}) values ($1, 'child', $2, 'junior', 'P3'${values})`, [HOUSE_A, nickname]);
    await expect(kid("Plain", ", secret_kind, secret_hash", ", 'password', 'frogs123'")).rejects.toThrow(/check constraint/);
    await expect(kid("Twentyone characters!")).rejects.toThrow(/check constraint/);
    await expect(kid("   ")).rejects.toThrow(/check constraint/);
    await expect(kid("Boss", ", is_admin", ", true")).rejects.toThrow(/check constraint/);
    await expect(kid("Hashonly", ", secret_hash", ", 'scrypt$1$1$1$a$b'")).rejects.toThrow(/check constraint/);
    await expect(kid("ari")).rejects.toThrow(/duplicate key/); // one door per name, any case
    await expect(
      db.query(`insert into profiles (household_id, role, nickname, secret_kind) values ($1, 'parent', 'Grown Up', 'password')`, [HOUSE_A]),
    ).rejects.toThrow(/check constraint/);
    await expect(db.query(`insert into audit_log (actor_role, action, detail) values ('admin', 'admin.lock', '[]')`)).rejects.toThrow(/check constraint/);
    await expect(db.query(`insert into audit_log (actor_role, action) values ('admin', 'Drop Table')`)).rejects.toThrow(/check constraint/);
  });
});

describe("focus camera signals (AGENTS.md rule 12)", () => {
  const SAMPLE_NOTE = "00000000-0000-4000-8000-0000000000f1";

  it("keeps the camera off by default, and a parent may switch their own kid's on", async () => {
    const off = await db.query<{ camera_enabled: boolean }>(`select camera_enabled from profiles where role = 'child'`);
    expect(off.rows.every((r) => r.camera_enabled === false)).toBe(true);
    const mine = await as(PARENT_A, () => db.query(`update profiles set camera_enabled = true where id = $1`, [ARI]));
    expect(mine.affectedRows).toBe(1);
    const theirs = await as(PARENT_A, () => db.query(`update profiles set camera_enabled = true where id = $1`, [KID_B]));
    expect(theirs.affectedRows).toBe(0);
    await db.query(`update profiles set camera_enabled = false where id = $1`, [ARI]);
  });

  it("shows a household's signals to its own grown-ups only, and never to anonymous visitors", async () => {
    await db.query(`insert into signals (household_id, profile_id, kind, minute, counts) values ($1, $2, 'camera-minute', '2026-10-28T08:00:00Z', '{"awaySeconds":3,"eyesClosedEvents":0,"yawns":0,"facePresentRatio":1}')`, [HOUSE_B, KID_B]);
    const a = await as(PARENT_A, () => db.query<{ id: string; synthetic: boolean }>("select id, synthetic from signals"));
    expect(a.rows).toEqual([{ id: SAMPLE_NOTE, synthetic: true }]);
    const b = await as(PARENT_B, () => db.query<{ kind: string }>("select kind from signals"));
    expect(b.rows.map((r) => r.kind)).toEqual(["camera-minute"]);
    await expect(as(null, () => db.query("select * from signals"))).rejects.toThrow(/permission denied/);
  });

  it("lets only the server write signals; a grown-up may delete their own", async () => {
    await expect(
      as(PARENT_A, () => db.query(`insert into signals (household_id, profile_id, kind, minute, counts) values ($1, $2, 'camera-minute', now(), '{}')`, [HOUSE_A, ARI])),
    ).rejects.toThrow(/permission denied/);
    await expect(as(PARENT_A, () => db.query(`update signals set confidence = 'high'`))).rejects.toThrow(/permission denied/);
    const theirs = await as(PARENT_B, () => db.query(`delete from signals where id = $1`, [SAMPLE_NOTE]));
    expect(theirs.affectedRows).toBe(0);
    const mine = await as(PARENT_A, () => db.query(`delete from signals where id = $1`, [SAMPLE_NOTE]));
    expect(mine.affectedRows).toBe(1);
  });

  it("holds counts only: no other keys, and notes need their evidence", async () => {
    const minute = (counts: string, extra = "", values = "") =>
      db.query(`insert into signals (household_id, profile_id, kind, minute, counts${extra}) values ($1, $2, 'camera-minute', now(), $3${values})`, [HOUSE_A, ARI, counts]);
    await expect(minute('{"image":"data:image/png;base64,AAAA"}')).rejects.toThrow(/check constraint/);
    await expect(minute('{"awaySeconds":1,"landmarks":[[0.1,0.2]]}')).rejects.toThrow(/check constraint/);
    await expect(minute("[]")).rejects.toThrow(/check constraint/);
    await expect(minute('{"yawns":1}', ", evidence", ", 'words'")).rejects.toThrow(/check constraint/);
    await expect(
      db.query(`insert into signals (household_id, profile_id, kind, minute, until, confidence) values ($1, $2, 'focus-watch', now(), now() + interval '3 minutes', 'low')`, [HOUSE_A, ARI]),
    ).rejects.toThrow(/check constraint/);
    await expect(db.query(`insert into signals (household_id, profile_id, kind, minute) values ($1, $2, 'face-photo', now())`, [HOUSE_A, ARI])).rejects.toThrow(/check constraint/);
  });

  it("stores each minute once per kid", async () => {
    const insert = () =>
      db.query(`insert into signals (household_id, profile_id, kind, minute, counts) values ($1, $2, 'camera-minute', '2026-10-28T09:00:00Z', '{"yawns":0}')`, [HOUSE_A, ARI]);
    await insert();
    await expect(insert()).rejects.toThrow(/duplicate key/);
  });
});

describe("migrations/20261028_focus_camera.sql", () => {
  /** A database as the founder had it before this migration: camera_signals, no signals table. */
  async function before(): Promise<PGlite> {
    const old = new PGlite();
    for (const f of ["test-auth-stub.sql", "schema.sql", "rls.sql"]) await old.exec(sql(f));
    await old.exec(`drop table signals; alter table profiles rename column camera_enabled to camera_signals;`);
    await old.exec(sql("seed.sql").replace("camera_enabled", "camera_signals").split("-- A sample")[0]);
    await old.exec(`update profiles set camera_signals = true where id = '${ARI}'`);
    return old;
  }

  it("renames the old column (keeping its value), adds signals with RLS and the sample note, and can run twice", async () => {
    const old = await before();
    try {
      const migration = sql("migrations/20261028_focus_camera.sql");
      await old.exec(migration);
      await old.exec(migration);
      const cols = await old.query<{ column_name: string }>(
        `select column_name from information_schema.columns where table_name = 'profiles' and column_name like 'camera%'`,
      );
      expect(cols.rows.map((r) => r.column_name)).toEqual(["camera_enabled"]);
      const ari = await old.query<{ camera_enabled: boolean }>(`select camera_enabled from profiles where id = $1`, [ARI]);
      expect(ari.rows[0].camera_enabled).toBe(true);
      const notes = await old.query<{ synthetic: boolean }>(`select synthetic from signals`);
      expect(notes.rows).toEqual([{ synthetic: true }]);
      const rls = await old.query<{ relrowsecurity: boolean }>(`select relrowsecurity from pg_class where relname = 'signals'`);
      expect(rls.rows[0].relrowsecurity).toBe(true);
      await old.exec(`insert into auth.users (id) values ('${PARENT_A}'); update profiles set user_id = '${PARENT_A}' where id = '00000000-0000-4000-8000-000000000010';`);
      await old.query(`select set_config('request.jwt.claim.sub', $1, false)`, [PARENT_A]);
      await old.exec("set role authenticated");
      const seen = await old.query("select id from signals");
      expect(seen.rows).toHaveLength(1);
      await expect(old.query(`insert into signals (household_id, profile_id, kind, minute) values ($1, $2, 'camera-minute', now())`, [HOUSE_A, ARI])).rejects.toThrow(/permission denied/);
      await old.exec("reset role");
    } finally {
      await old.close();
    }
  });

  it("is a no-op on a fresh install", async () => {
    const fresh = new PGlite();
    try {
      for (const f of ["test-auth-stub.sql", "schema.sql", "rls.sql", "seed.sql", "migrations/20261028_focus_camera.sql"]) await fresh.exec(sql(f));
      const notes = await fresh.query(`select id from signals`);
      expect(notes.rows).toHaveLength(1);
    } finally {
      await fresh.close();
    }
  });
});

describe("migrations/20261028_parent_pin.sql", () => {
  it("adds pin_hash (server only), runnable twice, on old and fresh databases", async () => {
    const old = new PGlite();
    try {
      for (const f of ["test-auth-stub.sql", "schema.sql", "rls.sql"]) await old.exec(sql(f));
      await old.exec(`alter table profiles drop column pin_hash;`);
      const migration = sql("migrations/20261028_parent_pin.sql");
      await old.exec(migration);
      await old.exec(migration);
      const cols = await old.query<{ column_name: string }>(
        `select column_name from information_schema.columns where table_name = 'profiles' and column_name = 'pin_hash'`,
      );
      expect(cols.rows).toEqual([{ column_name: "pin_hash" }]);
      // The server (superuser here) writes through the route mapping; clients can't read it.
      await old.exec(`insert into auth.users (id) values ('${PARENT_A}'); update profiles set user_id = '${PARENT_A}' where id = '00000000-0000-4000-8000-000000000010';`);
      await old.query(`update profiles set pin_hash = 'scrypt$1$2$3$abc' where id = '00000000-0000-4000-8000-000000000010'`);
      await old.query(`select set_config('request.jwt.claim.sub', $1, false)`, [PARENT_A]);
      await old.exec("set role authenticated");
      await expect(old.query(`select pin_hash from profiles limit 1`)).rejects.toThrow(/permission denied/);
      await old.exec("reset role");
    } finally {
      await old.close();
    }
  });
});

describe("migrations/20261030_paper_scout.sql and 20261030_focus_verdict.sql", () => {
  it("add the scout's tables (admins read, nobody else) and the verdict columns, runnable twice", async () => {
    const old = new PGlite();
    try {
      for (const f of ["test-auth-stub.sql", "schema.sql", "rls.sql", "seed.sql"]) await old.exec(sql(f));
      await old.exec(`drop table paper_finds; drop table scout_runs; alter table signals drop column verdict, drop column verdict_at;`);
      for (const f of ["migrations/20261030_paper_scout.sql", "migrations/20261030_focus_verdict.sql"]) {
        await old.exec(sql(f));
        await old.exec(sql(f));
      }
      await old.exec(`insert into paper_finds (key, site, title, page_url, fetch_mode, reason) values ('mathtutor https://x/a.pdf', 'mathtutor', 'WA1', 'https://x/', 'auto', 'robots.txt allows it')`);
      await expect(old.exec(`insert into paper_finds (key, site, title, page_url, fetch_mode, reason) values ('mathtutor https://x/a.pdf', 'mathtutor', 'WA1', 'https://x/', 'auto', 'again')`)).rejects.toThrow(/duplicate key/);
      await expect(old.exec(`update signals set verdict = 'maybe'`)).rejects.toThrow(/check constraint/);
      await old.exec(`insert into auth.users (id) values ('${PARENT_A}'); update profiles set user_id = '${PARENT_A}', is_admin = false where id = '00000000-0000-4000-8000-000000000010';`);
      await old.query(`select set_config('request.jwt.claim.sub', $1, false)`, [PARENT_A]);
      await old.exec("set role authenticated");
      expect((await old.query("select id from paper_finds")).rows).toHaveLength(0); // a parent who isn't an admin sees nothing
      await expect(old.query(`insert into scout_runs (trigger) values ('admin')`)).rejects.toThrow(/permission denied/);
      await old.exec("reset role");
      await old.exec(`update profiles set is_admin = true where id = '00000000-0000-4000-8000-000000000010'`);
      await old.exec("set role authenticated");
      expect((await old.query("select id from paper_finds")).rows).toHaveLength(1);
      await old.exec("reset role");
    } finally {
      await old.close();
    }
  });
});

describe("Guardian tables (migrations/20261028_guardian.sql)", () => {
  it("keeps each household's locations and room statuses to itself, hides device keys, and runs twice", async () => {
    const g = new PGlite();
    try {
      for (const f of ["test-auth-stub.sql", "schema.sql", "rls.sql", "seed.sql"]) await g.exec(sql(f));
      await g.exec(`drop table home_alerts, home_status, home_cameras, home_devices, place_events, places, locations, kid_location, guardian_prefs;`);
      const migration = sql("migrations/20261028_guardian.sql");
      await g.exec(migration);
      await g.exec(migration);
      await g.exec(`
        insert into auth.users (id) values ('${PARENT_A}'), ('${PARENT_B}');
        update profiles set user_id = '${PARENT_A}' where id = '00000000-0000-4000-8000-000000000010';
        insert into households (id, name) values ('${HOUSE_B}', 'Other family');
        insert into profiles (household_id, user_id, role, nickname) values ('${HOUSE_B}', '${PARENT_B}', 'parent', 'Other Parent');
        insert into profiles (id, household_id, role, nickname, band, level, pack) values ('${KID_B}', '${HOUSE_B}', 'child', 'Kai', 'junior', 'P3', 'toon-pop');
        insert into locations (household_id, profile_id, at, lat, lng, accuracy_m, motion, source) values
          ('${HOUSE_A}', '${ARI}', '2026-10-30T07:41:00Z', 1.3918, 103.8954, 8, 'still', 'sim'),
          ('${HOUSE_B}', '${KID_B}', '2026-10-30T07:41:00Z', 1.30, 103.80, 8, 'walking', 'sim');
        insert into home_devices (id, household_id, name, kind, token_hash) values
          ('dddddddd-0000-4000-8000-00000000000a', '${HOUSE_A}', 'Study laptop', 'home-link', repeat('a', 64)),
          ('dddddddd-0000-4000-8000-00000000000b', '${HOUSE_B}', 'Their laptop', 'home-link', repeat('b', 64));
        insert into home_cameras (id, household_id, device_id, key, room, room_kind) values
          ('eeeeeeee-0000-4000-8000-00000000000a', '${HOUSE_A}', 'dddddddd-0000-4000-8000-00000000000a', 'cam1', 'Living room', 'living'),
          ('eeeeeeee-0000-4000-8000-00000000000b', '${HOUSE_B}', 'dddddddd-0000-4000-8000-00000000000b', 'cam1', 'Living room', 'living');
        insert into home_status (household_id, camera_id, at, reading, concern) values
          ('${HOUSE_A}', 'eeeeeeee-0000-4000-8000-00000000000a', now(), '{"activity":"reading"}', 'none'),
          ('${HOUSE_B}', 'eeeeeeee-0000-4000-8000-00000000000b', now(), '{"activity":"watching a screen"}', 'none');
      `);
      await expect(g.exec(`insert into home_cameras (household_id, device_id, key, room, room_kind) values ('${HOUSE_A}', 'dddddddd-0000-4000-8000-00000000000a', 'cam1', 'Again', 'other')`)).rejects.toThrow(/duplicate key/);
      await expect(g.exec(`insert into locations (household_id, profile_id, at, lat, lng, accuracy_m, motion, source) values ('${HOUSE_A}', '${ARI}', now(), 1.3, 103.8, 8, 'teleporting', 'sim')`)).rejects.toThrow(/check constraint/);
      await g.query(`select set_config('request.jwt.claim.sub', $1, false)`, [PARENT_A]);
      await g.exec("set role authenticated");
      expect((await g.query<{ motion: string }>("select motion from locations")).rows).toEqual([{ motion: "still" }]);
      expect((await g.query<{ reading: { activity: string } }>("select reading from home_status")).rows.map((r) => r.reading.activity)).toEqual(["reading"]);
      await expect(g.query("select token_hash from home_devices")).rejects.toThrow(/permission denied/);
      await expect(g.query(`insert into locations (household_id, profile_id, at, lat, lng, accuracy_m, motion, source) values ('${HOUSE_A}', '${ARI}', now(), 1.3, 103.8, 8, 'still', 'web')`)).rejects.toThrow(/permission denied/);
      // A parent may delete their own kid's points, and only theirs.
      await g.exec(`delete from locations`);
      await g.exec("reset role");
      expect((await g.query<{ n: number }>("select count(*)::int as n from locations")).rows[0].n).toBe(1);
    } finally {
      await g.close();
    }
  });
});
