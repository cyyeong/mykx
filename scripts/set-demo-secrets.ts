// Sets the sample family's sign-ins in production from .env.local, so they never live in git (founder, 29 Oct).
// The judges get them through the submission form; anyone else asks the founder.
//
//   node --env-file=.env.local scripts/set-demo-secrets.ts
//
// DEMO_PASSWORD: the grown-up demo@mykx.ai (Supabase Auth) and every password kid in the demo family.
// DEMO_PICTURE_CODE: four picture ids, comma-separated (lib/auth/schemas.ts PICTURE_IDS), for every picture-code kid.
// Refuses unless every profile in the household is synthetic. Kids' secrets are hashed with the app's own scrypt
// helper, exactly like a reset in Your family, and tries and lockouts are cleared (AGENTS.md rule 13). Each change is
// audited. Nothing secret is printed. The in-memory demo store (lib/auth/demo-family.ts) keeps its own local-only
// secrets for tests and fresh clones.
import { createClient } from "@supabase/supabase-js";
import { DEMO_HOUSEHOLD_ID, DEMO_PARENT_EMAIL } from "../lib/auth/demo-family.ts";
import { passwordSchema, pictureCodeSchema } from "../lib/auth/schemas.ts";
import { hashSecret, verifySecret } from "../lib/auth/secrets.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const password = process.env.DEMO_PASSWORD ?? "";
const code = (process.env.DEMO_PICTURE_CODE ?? "").split(",").map((s) => s.trim());

if (!url || !secretKey) throw new Error("Supabase isn't configured in .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY).");
if (!passwordSchema.safeParse(password).success) throw new Error("DEMO_PASSWORD is missing or not 8 to 128 characters.");
const picture = pictureCodeSchema.safeParse(code);
if (!picture.success) throw new Error("DEMO_PICTURE_CODE must be four picture ids, comma-separated.");

const db = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: rows, error } = await db.from("profiles").select("id, nickname, role, synthetic, secret_kind, user_id").eq("household_id", DEMO_HOUSEHOLD_ID);
if (error) throw error;
if (!rows?.length || rows.some((p) => !p.synthetic)) throw new Error("Refusing: the demo household is missing or not all synthetic.");

const now = new Date().toISOString();
for (const p of rows) {
  if (p.role === "parent") {
    if (!p.user_id) continue;
    const { data, error: e } = await db.auth.admin.updateUserById(p.user_id, { password });
    if (e) throw e;
    console.log(`grown-up ${data.user?.email === DEMO_PARENT_EMAIL ? DEMO_PARENT_EMAIL : "(other email)"}: password set`);
    continue;
  }
  const secret = p.secret_kind === "pictures" ? ({ kind: "pictures", code: picture.data } as const) : ({ kind: "password", password } as const);
  const hash = await hashSecret(secret);
  const { error: e } = await db.from("profiles").update({ secret_hash: hash, secret_kind: secret.kind, secret_set_at: now, secret_event: "reset", failed_attempts: 0, locked_until: null }).eq("id", p.id);
  if (e) throw e;
  const back = await db.from("profiles").select("secret_hash").eq("id", p.id).single();
  console.log(`${p.nickname}: ${secret.kind === "pictures" ? "picture code" : "password"} set, verifies: ${await verifySecret(secret, back.data?.secret_hash as string)}`);
  await db.from("audit_log").insert({ actor: null, actor_role: "system", action: "demo.secret-set", target: p.id, household_id: DEMO_HOUSEHOLD_ID, detail: { kind: secret.kind } });
}
