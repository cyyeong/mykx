// The signed-in kid's pets (founder, 29 Oct; lib/pets). GET: every pet, with the server's clock so the page can run
// the bars down. POST: adopt a species, or one care action (feed with a food, clean, play, warm, the stage's special
// job). The care rules decide everything (lib/pets/care.ts): bars, mood, growth and a new generation. Deterministic,
// never touches mastery or the ledger (rule 5).
import { z } from "zod";
import { getStore } from "@/lib/auth/context";
import { requireFamily } from "@/lib/auth/guard";
import { fail, ok, readBody } from "@/lib/auth/http";
import { adopt, care } from "@/lib/pets/care";
import { FOODS, PET_IDS, type FoodId, type PetId } from "@/lib/pets/species";

const body = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("adopt"), species: z.enum(PET_IDS as [PetId, ...PetId[]]) }),
  z.strictObject({ action: z.literal("feed"), species: z.enum(PET_IDS as [PetId, ...PetId[]]), food: z.enum(Object.keys(FOODS) as [FoodId, ...FoodId[]]) }),
  z.strictObject({ action: z.enum(["clean", "play", "warm", "special"]), species: z.enum(PET_IDS as [PetId, ...PetId[]]) }),
]);

export async function GET(request: Request) {
  const family = await requireFamily(request, "pets", 120);
  if (family.refused) return family.refused;
  if (!family.kid) return fail(401, "no-kid");
  const pets = await getStore()!.pets.list(family.householdId, family.kid.id);
  return ok({ pets, now: new Date().toISOString() });
}

export async function POST(request: Request) {
  const family = await requireFamily(request, "pets", 60);
  if (family.refused) return family.refused;
  const kid = family.kid;
  if (!kid) return fail(401, "no-kid");
  const input = await readBody(request, body);
  if (!input) return fail(400, "invalid");
  const store = getStore()!;
  const now = new Date().toISOString();
  const pets = await store.pets.list(family.householdId, kid.id);
  const mine = pets.find((p) => p.species === input.species);

  if (input.action === "adopt") {
    if (mine) return ok({ pet: mine, now, outcome: null });
    const pet = adopt(input.species, now);
    await store.pets.save(family.householdId, kid.id, pet);
    return ok({ pet, now, outcome: null });
  }
  if (!mine) return fail(404, "not-found");
  const outcome = care(mine, input.action === "feed" ? { kind: "feed", food: input.food } : { kind: input.action }, now);
  if (outcome.ok) await store.pets.save(family.householdId, kid.id, outcome.pet);
  return ok({ pet: outcome.pet, now, outcome: { ok: outcome.ok, reaction: outcome.reaction, say: outcome.say } });
}
