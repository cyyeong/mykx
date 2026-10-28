// Runs SQL migrations against the Supabase database directly, each file in its own transaction (all or nothing).
// Needs SUPABASE_DB_URL in .env.local: the connection string from Supabase → Connect → "Session pooler" (with the
// database password). It is never printed. The migrations are written to be safe to run more than once.
//   node --env-file=.env.local scripts/db-migrate.ts supabase/migrations/20261029_family.sql supabase/migrations/20261029_games.sql
//   node --env-file=.env.local scripts/db-migrate.ts --check      (lists which app tables exist)
import { readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is not set. Add the Session pooler connection string to .env.local.");
  process.exit(1);
}
const args = process.argv.slice(2);
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  for (const file of args.filter((a) => a.endsWith(".sql"))) {
    if (!/^supabase\/migrations\/[\w.-]+\.sql$/.test(file)) throw new Error(`Only files in supabase/migrations: ${file}`);
    const sql = readFileSync(file, "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("commit");
      console.log(`applied ${file}`);
    } catch (e) {
      await client.query("rollback");
      throw new Error(`${file} failed and was rolled back: ${(e as Error).message}`);
    }
  }
  const { rows } = await client.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema = 'public' order by table_name");
  console.log(`public tables (${rows.length}): ${rows.map((r) => r.table_name).join(", ")}`);
} finally {
  await client.end();
}
