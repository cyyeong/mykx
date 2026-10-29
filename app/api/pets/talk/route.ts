// Talking to a pet (founder, 29 Oct): the Critter Keeper agent (Muse Spark, Standard) answers as the pet at its life
// stage and coaches its care, from the pet's facts only (lib/pets/voice.ts). Distress words skip the model: Kix's
// caring reply and the helplines answer, and that message is kept so the parent gets an urgent flag (rule 12).
// Otherwise chats aren't stored and never feed the mood readings. Talking is time together: it tops up the love bar a
// little (the care rules decide). Without a model, or if it fails, the cached reply answers (rule 7).
import { z } from "zod";
import { instructionsFor } from "@/lib/agents/runtime";
import { getStore } from "@/lib/auth/context";
import { requireFamily } from "@/lib/auth/guard";
import { fail, ok, readBody } from "@/lib/auth/http";
import { caringReply, checkWords, HELPLINES } from "@/lib/guardian/words";
import { hasMetaApiKey } from "@/lib/meta/client";
import { sparkStructured } from "@/lib/meta/spark";
import { care } from "@/lib/pets/care";
import { PET_IDS, type PetId } from "@/lib/pets/species";
import { fallbackReply, petFacts, petReplySchema } from "@/lib/pets/voice";
import { logRunsFor } from "@/lib/runs/log";
import { publishedInstructions } from "@/lib/agents/runtime";
import { flagFor, type Flag } from "@/lib/synapse/turn";

const body = z.strictObject({ species: z.enum(PET_IDS as [PetId, ...PetId[]]), text: z.string().trim().min(1).max(200) });

export async function POST(request: Request) {
  const family = await requireFamily(request, "critter-keeper", 20);
  if (family.refused) return family.refused;
  const kid = family.kid;
  if (!kid) return fail(401, "no-kid");
  const input = await readBody(request, body);
  if (!input) return fail(400, "invalid");
  const store = getStore()!;
  const now = new Date().toISOString();

  const check = checkWords(input.text);
  if (check.distress) {
    await store.guardian.saveMessage(family.householdId, kid.id, { at: now, text: input.text, source: "talk", ...check }).catch(() => undefined);
    return ok({ care: { reply: caringReply(kid.nickname), helplines: HELPLINES } });
  }

  const pet = (await store.pets.list(family.householdId, kid.id)).find((p) => p.species === input.species);
  if (!pet) return fail(404, "not-found");
  let answer = { ...fallbackReply(pet, now, input.text), source: "cached" as "cached" | "live" };
  let flag: Flag | null = null;
  if (hasMetaApiKey()) {
    try {
      logRunsFor("critter-keeper", family.householdId, kid.id);
      const system = await instructionsFor("critter-keeper", { band: kid.band }, { store });
      const { data } = await sparkStructured(
        { messages: [{ role: "system", content: `${system}\n\nFacts about you:\n${petFacts(pet, now)}` }, { role: "user", content: input.text }], schema: petReplySchema, schemaName: "pet_reply", reasoningEffort: "minimal" },
        { timeoutMs: 10_000, signal: request.signal },
      );
      answer = { reply: data.reply.trim(), feeling: data.feeling, source: "live" };
      // Kix Synapse: a signed turn, so the kid can flag what the pet said (lib/synapse/turn.ts).
      flag = flagFor({ surface: "critter", kid: kid.id, agent: "critter-keeper", agentVersion: (await publishedInstructions("critter-keeper", store)).version, packId: null, packVersion: null, itemId: null, level: kid.level, subject: "science", stage: null, species: pet.species, petStage: pet.stage, sections: [], shown: answer.reply, ask: input.text });
    } catch {
      // The cached reply stands in.
    }
  }
  const after = care(pet, { kind: "talk" }, now).pet;
  await store.pets.save(family.householdId, kid.id, after);
  return ok({ ...answer, pet: after, now, flag });
}
