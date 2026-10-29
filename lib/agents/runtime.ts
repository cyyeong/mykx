// Server only: the instructions each agent runs with. The newest published version from agent_versions, else the
// built-in default, cached in memory for a minute per agent (and dropped at once on this server when an admin
// publishes, restores or deletes), followed by the fixed guardrails (lib/agents/instructions.ts). Never throws: a
// store that fails, or a database without the table, means the default (or the last text read, if there was one).
import { getStore } from "../auth/context.ts";
import type { AuthStore } from "../auth/store.ts";
import { compose, defaultText, type EditableAgent, type Vars } from "./instructions.ts";
import { currentOf } from "./versions.ts";
import { cautionsFor } from "../synapse/cautions.ts";

export const INSTRUCTIONS_TTL_MS = 60_000;
/** After a failed read, try again this soon. */
const RETRY_MS = 10_000;

type Entry = { version: number; text: string; until: number; generation: number };
// On globalThis, like the demo store, so every route bundle in one server process shares the cache and sees a
// forget from the admin route at once. Separate server instances (Vercel functions) catch up within the TTL.
const g = globalThis as typeof globalThis & { __mykxAgentInstructions?: { cache: WeakMap<AuthStore, Map<EditableAgent, Entry>>; generation: number } };
const shared = (g.__mykxAgentInstructions ??= { cache: new WeakMap(), generation: 0 });

/** Forgets what was read, so the next call reads the database (an admin just changed an agent). */
export function forgetInstructions(): void {
  shared.generation += 1;
}

/** The text Kix uses for this agent now and its version (1 is the built-in default). */
export async function publishedInstructions(agent: EditableAgent, store: AuthStore | null = getStore(), now = Date.now()): Promise<{ version: number; text: string }> {
  if (!store) return { version: 1, text: defaultText(agent) };
  let byAgent = shared.cache.get(store);
  if (!byAgent) shared.cache.set(store, (byAgent = new Map()));
  const hit = byAgent.get(agent);
  const generation = shared.generation;
  if (hit && hit.generation === generation && now < hit.until) return { version: hit.version, text: hit.text };
  try {
    const current = currentOf(agent, await store.agents.versions(agent));
    byAgent.set(agent, { ...current, until: now + INSTRUCTIONS_TTL_MS, generation });
    return current;
  } catch {
    const fallback = hit ? { version: hit.version, text: hit.text } : { version: 1, text: defaultText(agent) };
    byAgent.set(agent, { ...fallback, until: now + RETRY_MS, generation });
    return fallback;
  }
}

/**
 * The published instructions for one agent (and part), filled in with `vars`, followed by its fixed guardrails.
 * Builders add their context (the question, the facts, the Notebook) after it.
 */
export async function instructionsFor(
  agent: EditableAgent,
  vars: Vars,
  o: { part?: string; store?: AuthStore | null; now?: number; scope?: { level?: string | null; subject?: string | null }; extraCautions?: readonly string[] } = {},
): Promise<string> {
  const store = o.store === undefined ? getStore() : o.store;
  const { text } = await publishedInstructions(agent, store, o.now);
  // Kix Synapse's learned cautions for this agent whose scope fits the call (by level, from vars unless given).
  const scope = o.scope ?? { level: typeof vars.level === "string" ? vars.level : null };
  const learned = await cautionsFor(store, agent, scope, o.now);
  return compose(agent, vars, text, o.part, [...(o.extraCautions ?? []), ...learned]);
}
