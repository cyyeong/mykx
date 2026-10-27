// Server-only data for the learning loop pages (quest map, question, quest
// complete, Treasure): the signed-in kid's store, household and attempts.
import { cookies } from "next/headers";
import { connection } from "next/server";
import { currentKid, currentParent, getStore } from "../auth/context.ts";
import type { CookieJar } from "../auth/http.ts";
import type { AuthStore } from "../auth/store.ts";
import type { AttemptEvent } from "../domain/attempts.ts";
import type { LedgerEntry } from "../domain/rewards.ts";
import { loadFrogItems } from "./frog-quest.ts";
import type { SkillItem } from "../types.ts";

export interface LearnContext {
  store: AuthStore;
  householdId: string;
  kidId: string;
  nickname: string;
}

async function readOnlyJar(): Promise<CookieJar> {
  const jar = await cookies();
  return {
    get: (name) => jar.get(name)?.value,
    getAll: () => jar.getAll().map(({ name, value }) => ({ name, value })),
    set: () => {},
    delete: () => {},
    setHeaders: () => {},
  };
}

/** The signed-in kid's learning context, or null (pages redirect to /doors). */
export async function learnContext(): Promise<LearnContext | null> {
  await connection();
  const store = getStore();
  if (!store) return null;
  const jar = await readOnlyJar();
  const parent = await currentParent(store, jar);
  const kid = await currentKid(store, jar, parent);
  if (!parent || !kid) return null;
  return { store, householdId: parent.householdId, kidId: kid.id, nickname: kid.nickname };
}

export interface QuestData {
  ctx: LearnContext;
  items: SkillItem[];
  attempts: AttemptEvent[];
  ledger: LedgerEntry[];
}

/** Frog items plus the kid's attempts and ledger. */
export async function questData(ctx: LearnContext): Promise<QuestData> {
  const [attempts, ledger] = await Promise.all([
    ctx.store.learn.attempts(ctx.householdId, ctx.kidId),
    ctx.store.learn.ledger(ctx.householdId, ctx.kidId),
  ]);
  return { ctx, items: loadFrogItems(), attempts, ledger };
}
