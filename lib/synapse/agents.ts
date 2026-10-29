// Re-running an agent for Kix Synapse (docs/prd/SYNAPSE.md §5.2, §5.5): the same agent, on the same published
// instructions and pack sections, given the de-identified turn ("Learner", no Notebook, no family). Used to reproduce
// a reported problem, to re-test a caution before it ships, and for the nightly evals. Server only.
import type { AuthStore } from "../auth/store.ts";
import { instructionsFor } from "../agents/runtime.ts";
import { askKixVars, enforceStage, explanationSchema, systemPrompt, teachingNotes, type Explanation } from "../kix/homework.ts";
import { sparkStructured } from "../meta/spark.ts";
import { adopt } from "../pets/care.ts";
import { PET_IDS, type PetId } from "../pets/species.ts";
import { petFacts, petReplySchema } from "../pets/voice.ts";
import { readSection } from "../skills/runtime.ts";

export interface AgentOutput {
  text: string;
  final: string | null;
  costUsd: number;
}

/** Everything a kid saw in an Ask Kix explanation, as plain lines. */
export function explanationText(e: Pick<Explanation, "blocks" | "finalAnswer">): string {
  const lines: string[] = [];
  for (const b of e.blocks) {
    if (b.title) lines.push(b.title);
    if (b.text) lines.push(b.text);
    for (const s of b.steps ?? []) lines.push(s);
    for (const bar of b.bars ?? []) lines.push(`${bar.label}: ${bar.parts.map((p) => `${p.label} ${p.value}`).join(", ")}`);
    if (b.claim) lines.push(`Claim: ${b.claim}`);
    if (b.evidence) lines.push(`Evidence: ${b.evidence}`);
    if (b.reasoning) lines.push(`Reasoning: ${b.reasoning}`);
    if (b.question) lines.push(`Try this: ${b.question}`);
  }
  if (e.finalAnswer) lines.push(`Answer: ${e.finalAnswer}`);
  return lines.join("\n");
}

export const bandOf = (level: string | null) => (level && /^P[1-4]$/i.test(level) ? "junior" : "teen");

/** Ask Kix at the full stage on a question as Kix read it, with any extra cautions to test. */
export async function runAskKix(o: { store: AuthStore | null; level: string | null; question: string; sections: readonly string[]; extraCautions?: readonly string[] }): Promise<AgentOutput> {
  const asked = { nickname: "Learner", level: o.level, band: bandOf(o.level), stage: "full" as const };
  const head = await instructionsFor("ask-kix", askKixVars(asked), { store: o.store, extraCautions: o.extraCautions });
  const reads = o.sections.flatMap((id) => {
    const r = readSection(id);
    return r ? [r.text] : [];
  });
  const notes = reads.length ? reads.join("\n\n") : teachingNotes(o.level);
  const { data, run } = await sparkStructured(
    { messages: [{ role: "system", content: systemPrompt({ ...asked, notes }, head) }, { role: "user", content: [{ type: "text", text: `The question (as you read it before): ${o.question}` }] }], schema: explanationSchema, schemaName: "kix_homework", reasoningEffort: "low" },
    { timeoutMs: 60_000 },
  );
  const e = enforceStage(data, "full");
  return { text: explanationText(e), final: e.finalAnswer, costUsd: run.costUsd ?? 0 };
}

/** The Critter Keeper as a pet of this species and stage, answering the kid's words. */
export async function runCritter(o: { store: AuthStore | null; species: string; petStage: number; ask: string; extraCautions?: readonly string[] }): Promise<AgentOutput> {
  if (!(PET_IDS as readonly string[]).includes(o.species)) throw new Error("unknown species");
  const now = new Date().toISOString();
  const pet = { ...adopt(o.species as PetId, now), stage: Math.max(0, Math.min(3, o.petStage)) };
  const system = await instructionsFor("critter-keeper", { band: "junior" }, { store: o.store, extraCautions: o.extraCautions });
  const { data, run } = await sparkStructured(
    { messages: [{ role: "system", content: `${system}\n\nFacts about you:\n${petFacts(pet, now)}` }, { role: "user", content: o.ask }], schema: petReplySchema, schemaName: "pet_reply", reasoningEffort: "minimal" },
    { timeoutMs: 20_000 },
  );
  return { text: data.reply, final: null, costUsd: run.costUsd ?? 0 };
}
