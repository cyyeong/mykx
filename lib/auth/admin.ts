// Admin "People" helpers: the admin check and the account rows admins may see (role, status, last
// sign-in; a parent's email). Never a child's messages, Notebook, answers or secrets.
import { currentParent, statusOf, type Parent } from "./context.ts";
import type { CookieJar } from "./http.ts";
import type { HouseholdRow, PersonRow } from "./schemas.ts";
import type { AuthStore, Household, Profile } from "./store.ts";

/** The signed-in admin, or null (the route answers 403). The flag is read from the database each time. */
export async function requireAdmin(store: AuthStore, jar: CookieJar): Promise<Parent | null> {
  const parent = await currentParent(store, jar);
  return parent?.isAdmin ? parent : null;
}

export function toPerson(p: Profile, email: string | null, now = Date.now()): PersonRow {
  return {
    id: p.id,
    role: p.role,
    nickname: p.nickname,
    isAdmin: p.isAdmin,
    status: statusOf(p, now),
    lastSignInAt: p.lastSignInAt,
    email: p.role === "parent" ? email : null,
    band: p.band,
    level: p.level,
    synthetic: p.synthetic,
  };
}

export async function toHouseholdRows(store: AuthStore, hits: { household: Household; people: Profile[] }[]): Promise<HouseholdRow[]> {
  const userIds = hits.flatMap((h) => h.people.filter((p) => p.role === "parent" && p.userId).map((p) => p.userId!));
  const emails = await store.admin.emails(userIds);
  return hits.map(({ household, people }) => ({
    id: household.id,
    name: household.name,
    people: people.map((p) => toPerson(p, p.userId ? (emails.get(p.userId) ?? null) : null)),
  }));
}
