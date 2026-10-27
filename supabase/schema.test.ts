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
    expect(attempts.rows.map((r) => r.idempotency_key)).toEqual(["a-1"]);
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
