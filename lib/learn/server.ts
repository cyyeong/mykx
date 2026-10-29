// Server-only data for the learning loop pages (Learn hub, subject pages, quest map, question, done pages,
// Treasure): the signed-in kid's store, household, level and attempts. Every page scopes its packs to the kid's
// level through lib/learn/subjects.ts.
import { cookies } from "next/headers";
import { connection } from "next/server";
import { currentKid, currentParent, getStore } from "../auth/context.ts";
import type { CookieJar } from "../auth/http.ts";
import type { Band, Level, Pack } from "../auth/schemas.ts";
import type { AuthStore } from "../auth/store.ts";
import type { AttemptEvent } from "../domain/attempts.ts";
import type { LedgerEntry } from "../domain/rewards.ts";
import { refreshSkillOverrides } from "../skills/overrides.ts";
import { loadFrogItems } from "./frog-quest.ts";
import { subjectsFor, type Subject } from "./subjects.ts";
import type { SkillItem } from "../types.ts";

export interface LearnContext {
  store: AuthStore;
  householdId: string;
  kidId: string;
  nickname: string;
  /** The kid's level, band and world (null only for a profile that was never enrolled). */
  level: Level | null;
  band: Band;
  pack: Pack;
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
  if (!kid) return null;
  // The packs' published versions, so pages serve what an admin published (lib/skills/overrides.ts).
  await refreshSkillOverrides(store);
  return {
    store,
    householdId: kid.householdId,
    kidId: kid.id,
    nickname: kid.nickname,
    level: kid.level,
    band: kid.band ?? "junior",
    pack: kid.pack ?? (kid.band === "teen" ? "anime-sky" : "dreamlight"),
  };
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

export interface SubjectData {
  ctx: LearnContext;
  /** The kid's own subjects (their level's packs), in school order. */
  subjects: Subject[];
  attempts: AttemptEvent[];
  ledger: LedgerEntry[];
}

/** The kid's subjects plus their attempts and ledger. */
export async function subjectData(ctx: LearnContext): Promise<SubjectData> {
  const [attempts, ledger] = await Promise.all([
    ctx.store.learn.attempts(ctx.householdId, ctx.kidId),
    ctx.store.learn.ledger(ctx.householdId, ctx.kidId),
  ]);
  return { ctx, subjects: subjectsFor(ctx.level), attempts, ledger };
}
