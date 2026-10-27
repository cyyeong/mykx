// Server-component helpers: read the sign-in state from next/headers cookies, so a page can pick the
// junior or teen door look without a client fetch. Read-only: a Server Component can't set cookies,
// so a Supabase token refresh here is dropped (the next route call refreshes it).
// With Cache Components, call these inside a <Suspense> boundary (they read request cookies). Each awaits
// connection() and the cookies before anything else, so no clock read happens during prerendering.
import { cookies } from "next/headers";
import { connection } from "next/server";
import { currentKid, currentParent, getStore, grownUpLabel, toDoor, toKidMe } from "./context.ts";
import { doorsFor } from "./flows.ts";
import type { CookieJar } from "./http.ts";
import { isId, type Door, type DoorsResult, type KidMe } from "./schemas.ts";
import { DEMO_HOUSEHOLD_ID } from "./demo-family.ts";

async function readOnlyJar(): Promise<CookieJar> {
  // Sign-in state is request-time only: lockouts and sessions read the clock, which a (runtime) prerender can't.
  await connection();
  const store = await cookies();
  return {
    get: (name) => store.get(name)?.value,
    getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
    set: () => {},
    delete: () => {},
    setHeaders: () => {},
  };
}

/** Same shape as GET /api/auth/kids. Signed out or not configured: no doors. */
export async function getDoors(): Promise<DoorsResult> {
  const jar = await readOnlyJar();
  const store = getStore();
  if (!store) return { signedIn: false, grownUp: null, kids: [] };
  const { signedIn, grownUp, kids } = await doorsFor(store, jar);
  return { signedIn, grownUp, kids };
}

/** One door in the signed-in household, or null (signed out, not in the household, or disabled). */
export async function getDoor(kidId: string): Promise<Door | null> {
  const jar = await readOnlyJar();
  const store = getStore();
  if (!store) return null;
  const parent = await currentParent(store, jar);
  if (!parent) return null;
  const kid = isId(kidId) ? await store.kid(parent.householdId, kidId) : null;
  return kid && !kid.disabledAt ? toDoor(kid) : null;
}

/** The kid signed in on this device (same as GET /api/me), or null. */
export async function getSignedInKid(): Promise<KidMe | null> {
  const jar = await readOnlyJar();
  const store = getStore();
  if (!store) return null;
  const kid = await currentKid(store, jar, await currentParent(store, jar));
  return kid ? toKidMe(kid) : null;
}

/** The grown-up signed in on this device: their label and whether they're an admin, or null. */
export async function getGrownUp(): Promise<{ name: string; isAdmin: boolean } | null> {
  const jar = await readOnlyJar();
  const store = getStore();
  if (!store) return null;
  const parent = await currentParent(store, jar);
  return parent ? { name: grownUpLabel(parent), isAdmin: parent.isAdmin } : null;
}

/** Whether the signed-in household is the synthetic demo family (AGENTS.md rule 8: label synthetic data). */
export async function isDemoFamily(): Promise<boolean> {
  const jar = await readOnlyJar();
  const store = getStore();
  if (!store) return false;
  const parent = await currentParent(store, jar);
  return parent?.householdId === DEMO_HOUSEHOLD_ID;
}
