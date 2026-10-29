// The full stack on your own machine (founder, 29 Oct: so judges can run it in their sandbox). Needs Docker; the
// Supabase CLI comes through npx at a pinned version. It builds the local project in dev/supabase from
// supabase/schema.sql and rls.sql (a fresh install; the dated files in supabase/migrations upgrade older databases),
// seeds the synthetic demo family plus a local sign-in for its grown-up (dev/seed-local.sql), starts the containers
// and writes .env.development.local so `npm run dev` uses them. Nothing here touches production.
//
//   npm run db:local          start and seed (the first run pulls the Docker images)
//   npm run db:local -- reset wipe the local database and seed it again
//   npm run db:local -- stop  stop the containers
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CLI = ["-y", "supabase@2.122.0"];
const ROOT = process.cwd();
const WORK = join(ROOT, "dev");
const ENV_FILE = join(ROOT, ".env.development.local");
const MARK = "# Written by scripts/local-supabase.ts";

function supabase(args: string[], capture = false): string {
  const r = spawnSync("npx", [...CLI, ...args, "--workdir", WORK], { stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit", encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`\nsupabase ${args.join(" ")} failed. Is Docker running?`);
    process.exit(r.status ?? 1);
  }
  return r.stdout ?? "";
}

const mode = process.argv[2] ?? "start";
if (mode === "stop") {
  supabase(["stop"]);
  process.exit(0);
}

// The local project's migrations and seed, rebuilt from the repo's fresh-install files every run.
const dir = join(WORK, "supabase");
mkdirSync(join(dir, "migrations"), { recursive: true });
copyFileSync(join(ROOT, "supabase", "schema.sql"), join(dir, "migrations", "20261027000000_schema.sql"));
copyFileSync(join(ROOT, "supabase", "rls.sql"), join(dir, "migrations", "20261027000001_rls.sql"));
writeFileSync(join(dir, "seed.sql"), `${readFileSync(join(ROOT, "supabase", "seed.sql"), "utf8")}\n${readFileSync(join(WORK, "seed-local.sql"), "utf8")}`);

supabase(["start"]);
if (mode === "reset") supabase(["db", "reset"]);

const env = Object.fromEntries(
  supabase(["status", "-o", "env"], true)
    .split("\n")
    .map((l) => /^([A-Z_]+)="?(.*?)"?$/.exec(l.trim()))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => [m[1], m[2]]),
);
const url = env.API_URL;
const publishable = env.PUBLISHABLE_KEY || env.ANON_KEY;
const secret = env.SECRET_KEY || env.SERVICE_ROLE_KEY;
if (!url || !publishable || !secret) {
  console.error("Couldn't read the local API URL and keys from `supabase status`.");
  process.exit(1);
}

// Keep the kid-session secret across runs, so local sign-ins survive a restart.
const before = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
if (before && !before.includes(MARK)) {
  copyFileSync(ENV_FILE, `${ENV_FILE}.bak`);
  console.log("Your own .env.development.local was saved as .env.development.local.bak.");
}
const kidSecret = /^KID_SESSION_SECRET=(.+)$/m.exec(before)?.[1] ?? randomBytes(32).toString("hex");
const keep = before
  .split("\n")
  .filter((l) => /^(MODEL_API_KEY|META_API_KEY)=/.test(l))
  .join("\n");
writeFileSync(
  ENV_FILE,
  [
    MARK,
    "# Local Supabase (Docker). Delete this file to go back to .env.local or the in-memory demo store.",
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable}`,
    `SUPABASE_SECRET_KEY=${secret}`,
    env.DB_URL ? `SUPABASE_DB_URL=${env.DB_URL}` : "",
    `KID_SESSION_SECRET=${kidSecret}`,
    "# Optional: your own Meta Model API key (Standard mode) for live Muse calls; without it every agent uses its fallback.",
    keep || "# MODEL_API_KEY=",
    "",
  ]
    .filter((l) => l !== "")
    .join("\n") + "\n",
);

console.log(`
Local Supabase is up, and .env.development.local points the app at it.
  npm run dev                      then open http://localhost:3000
  Grown-up (also the admin)        demo@mykx.ai / local-demo-only
  Kids' magic names                jordan, abby, leonard
  Abby and Leonard                 password local-demo-only
  Jordan                           picture code: Kix smiling, Kix cheering, Kix the pilot, Starry Kix
  Supabase Studio                  http://127.0.0.1:54323
These sign-ins are local-only and open nothing else.`);
