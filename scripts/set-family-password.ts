// Sets one password for a grown-up and every kid in their family who signs in with a password (picture-code kids
// are left alone). For the founder's own accounts, run by hand:
//
//   node --env-file=.env.local scripts/set-family-password.ts <grown-up email> '<new password>'
//
// The grown-up's password goes through Supabase Auth's admin API. Kids' passwords are hashed with the app's own
// scrypt helper (lib/auth/secrets.ts), exactly like a reset in Your family: stored as a hash, never shown again,
// tries and lockouts cleared (AGENTS.md rule 13). Every change goes in the audit log. Nothing is printed back.
import { createClient } from "@supabase/supabase-js";
import { passwordSchema } from "../lib/auth/schemas.ts";
import { hashSecret } from "../lib/auth/secrets.ts";
import { SupabaseStore } from "../lib/auth/store-supabase.ts";

const [email, password] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

if (!email || !password) {
  console.log("Usage: node --env-file=.env.local scripts/set-family-password.ts <grown-up email> '<new password>'");
  process.exit(1);
}
if (!passwordSchema.safeParse(password).success) {
  console.log("That password is too short or too long for a kid's door (8 to 128 characters).");
  process.exit(1);
}
if (!url || !secretKey) {
  console.log("Supabase isn't configured in .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY).");
  process.exit(1);
}

const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
const store = new SupabaseStore({ url, publishableKey, secretKey });

// 1. The grown-up's sign-in password (Supabase Auth).
let user = null;
for (let page = 1; !user && page < 50; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  if (data.users.length < 200) break;
}
if (!user) {
  console.log(`No grown-up account with the email ${email}.`);
  process.exit(1);
}
const updated = await admin.auth.admin.updateUserById(user.id, { password });
if (updated.error) throw updated.error;
const parent = await store.profileByUserId(user.id);
if (!parent) {
  console.log(`Updated the sign-in password for ${email}, but it has no myKx family, so there are no kids to update.`);
  process.exit(0);
}
await store.audit({ actor: parent.id, actorRole: "parent", action: "parent.password-reset", target: parent.id, householdId: parent.householdId, detail: { by: "script" } });
console.log(`✓ ${email}: sign-in password updated.`);

// 2. Every kid in the family who uses a password door.
const kids = (await store.kids(parent.householdId)).filter((k) => k.secretKind === "password");
for (const kid of kids) {
  const secretHash = await hashSecret({ kind: "password", password });
  await store.update(parent.householdId, kid.id, { secretKind: "password", secretHash, secretSetAt: new Date().toISOString(), secretEvent: "reset", failedAttempts: 0, lockedUntil: null });
  await store.audit({ actor: parent.id, actorRole: "parent", action: "kid.secret-reset", target: kid.id, householdId: parent.householdId, detail: { kind: "password", by: "script" } });
  console.log(`✓ ${kid.nickname}: password door updated.`);
}
const pictures = (await store.kids(parent.householdId)).filter((k) => k.secretKind !== "password").map((k) => k.nickname);
if (!kids.length) console.log("No kids in this family use a password door.");
if (pictures.length) console.log(`Left as they are (picture codes): ${pictures.join(", ")}.`);
