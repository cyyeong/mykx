// Gives the seeded Demo family's parent a real Supabase sign-in (so the demo works in production).
//
//   node --env-file=.env.local scripts/link-demo-parent.ts --email demo@yourdomain.com [--password '…']
//
// Creates the Supabase Auth user (email already confirmed) or reuses one with that email, then sets
// profiles.user_id on the seeded parent. Without --password it makes a strong one and prints it once:
// keep it in a password manager; it is never written anywhere. Run after schema.sql, rls.sql and seed.sql.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { DEMO_PARENT_ID } from "../lib/auth/demo-family.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
const email = arg("email")?.trim().toLowerCase();
const given = arg("password");
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first.");
if (!email || !email.includes("@")) throw new Error("Pass --email <the demo parent's email>.");
if (given !== undefined && given.length < 8) throw new Error("--password must be at least 8 characters.");
const password = given ?? randomBytes(12).toString("base64url");

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let userId: string | undefined;
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (created.data.user) {
  userId = created.data.user.id;
} else {
  // Already registered: find it and set the password (one page of up to 1000 users is plenty for a demo project).
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list.data?.users.find((u) => u.email?.toLowerCase() === email);
  if (!existing) throw new Error(`Couldn't create or find ${email}: ${created.error?.message ?? "unknown error"}`);
  userId = existing.id;
  const updated = await admin.auth.admin.updateUserById(userId, { password });
  if (updated.error) throw new Error(`Couldn't set the password: ${updated.error.message}`);
}

const linked = await admin.from("profiles").update({ user_id: userId }).eq("id", DEMO_PARENT_ID).select("id");
if (linked.error) throw new Error(`Couldn't link the profile: ${linked.error.message}`);
if (!linked.data?.length) throw new Error("The seeded Demo Parent wasn't found. Run supabase/seed.sql first.");

console.log(`Linked ${email} to the Demo family's parent (an admin).`);
if (!given) console.log(`Password (shown once, not saved): ${password}`);
