// Learned cautions at run time (docs/prd/SYNAPSE.md §5.4): the active cautions for an agent whose scope fits the
// call, read through a one-minute cache like the agents' instructions (dropped at once on this server when one is
// added, confirmed or retired). They sit after the editable instructions and before the fixed guardrails, which
// always come last and always win. Never throws: a store that fails means no cautions.
import type { AuthStore } from "../auth/store.ts";
import type { LearnedCaution } from "./types.ts";

const TTL_MS = 60_000;
export const MAX_ACTIVE = 12;

const g = globalThis as typeof globalThis & { __mykxCautions?: { cache: WeakMap<AuthStore, { at: number; gen: number; list: LearnedCaution[] }>; gen: number } };
const shared = (g.__mykxCautions ??= { cache: new WeakMap(), gen: 0 });

export function forgetCautions(): void {
  shared.gen += 1;
}

export const cautionLine = (c: Pick<LearnedCaution, "when" | "check">) => `When ${c.when.trim().replace(/[.,;]+$/, "")}, ${c.check.trim().replace(/\.+$/, "")}.`;

export function isLive(c: LearnedCaution, now = Date.now()): boolean {
  return c.status === "active" && (c.expiresAt === null || Date.parse(c.expiresAt) > now);
}

/** Does the caution's scope fit this call? An unset side matches anything. */
export function fits(c: LearnedCaution, scope: { level?: string | null; subject?: string | null }): boolean {
  const eq = (a: string | null | undefined, b: string | null | undefined) => !a || !b || a.toLowerCase() === b.toLowerCase();
  return eq(c.scope.level, scope.level) && eq(c.scope.subject, scope.subject);
}

/** The lines to add to an agent's prompt for this call (newest first, at most MAX_ACTIVE). */
export async function cautionsFor(store: AuthStore | null, agent: string, scope: { level?: string | null; subject?: string | null }, now = Date.now()): Promise<string[]> {
  if (!store) return [];
  let hit = shared.cache.get(store);
  if (!hit || hit.gen !== shared.gen || now - hit.at > TTL_MS) {
    try {
      hit = { at: now, gen: shared.gen, list: await store.synapse.cautions() };
    } catch {
      hit = { at: now, gen: shared.gen, list: hit?.list ?? [] };
    }
    shared.cache.set(store, hit);
  }
  return hit.list
    .filter((c) => c.agent === agent && isLive(c, now) && fits(c, scope))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_ACTIVE)
    .map(cautionLine);
}
