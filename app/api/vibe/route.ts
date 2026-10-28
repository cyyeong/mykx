// Vibe Zone (design board VibeZone): the kid's flashcard sets.
//   GET:  the kid's creations.
//   POST { action: "make" }:  Muse Spark (Standard) writes a flashcard spec from the kid's own words (or revises
//         one), checked against the schema; a cached sample when the model is unavailable (rule 7).
//   POST { action: "save" }:  keeps a version; the first save of a creation pays creation_saved (+5, rule 5).
//   POST { action: "share" }: shares the current version with this device's grown-up, or stops sharing.
// Specs are data drawn by trusted components; no model-written code runs (rule 4). The maker's instructions are the
// published version (editable in Under the hood), with fixed guardrails (lib/agents).
import { z } from "zod";
import { instructionsFor } from "@/lib/agents/runtime";
import { requireFamily } from "@/lib/auth/guard";
import { currentParent, getStore } from "@/lib/auth/context";
import { fail, ok, readBody, RequestCookieJar } from "@/lib/auth/http";
import { awardsFor, DAILY_CAP, pointsOnDay } from "@/lib/domain/rewards";
import { sgDate } from "@/lib/domain/time";
import { caringReply, checkWords, HELPLINES } from "@/lib/guardian/words";
import { teachingNotes } from "@/lib/kix/homework";
import { hasMetaApiKey } from "@/lib/meta/client";
import { sparkStructured } from "@/lib/meta/spark";
import { flashcardSpecSchema, makePrompt, SAMPLE_SET, vibeVars } from "@/lib/vibe/flashcards";
import { logRunsFor } from "@/lib/runs/log";

const body = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("make"), request: z.string().trim().min(1).max(400), revise: z.strictObject({ spec: flashcardSpecSchema, change: z.string().trim().min(1).max(200) }).optional() }),
  z.strictObject({ action: z.literal("save"), id: z.guid().nullable(), spec: flashcardSpecSchema }),
  z.strictObject({ action: z.literal("share"), id: z.guid(), share: z.boolean() }),
]);

export async function GET(request: Request) {
  const family = await requireFamily(request, "vibe", 60);
  if (family.refused) return family.refused;
  if (!family.kid) return fail(401, "no-kid");
  return ok({ creations: await getStore()!.creations.list(family.householdId, family.kid.id) });
}

export async function POST(request: Request) {
  const family = await requireFamily(request, "vibe", 20);
  if (family.refused) return family.refused;
  const kid = family.kid;
  if (!kid) return fail(401, "no-kid");
  logRunsFor("vibe", family.householdId, kid.id);
  const input = await readBody(request, body);
  if (!input) return fail(400, "invalid");
  const store = getStore()!;

  if (input.action === "make") {
    const words = input.revise ? `${input.request} — ${input.revise.change}` : input.request;
    const check = checkWords(words);
    await store.guardian.saveMessage(family.householdId, kid.id, { at: new Date().toISOString(), text: words.slice(0, 500), source: "talk", ...check }).catch(() => undefined);
    if (check.distress) return ok({ care: { reply: caringReply(kid.nickname), helplines: HELPLINES }, spec: null, sample: false });
    if (!hasMetaApiKey()) return ok({ care: null, spec: SAMPLE_SET, sample: true });
    try {
      const who = { nickname: kid.nickname, level: kid.level, band: kid.band };
      const head = await instructionsFor("vibe", vibeVars(who), { store });
      const { data } = await sparkStructured(
        {
          messages: [
            { role: "system", content: makePrompt({ ...who, notes: teachingNotes(kid.level), revise: input.revise ?? null }, head) },
            { role: "user", content: `${kid.nickname} asks: ${input.request}` },
          ],
          schema: flashcardSpecSchema,
          schemaName: "vibe_flashcards",
          reasoningEffort: "low",
        },
        { timeoutMs: 45_000, signal: request.signal },
      );
      return ok({ care: null, spec: data, sample: false });
    } catch {
      return ok({ care: null, spec: SAMPLE_SET, sample: true });
    }
  }

  if (input.action === "save") {
    const creation = await store.creations.saveVersion(family.householdId, kid.id, input.id, input.spec);
    if (!creation) return fail(404, "not-found");
    const [ledger, attempts] = await Promise.all([store.learn.ledger(family.householdId, kid.id), store.learn.attempts(family.householdId, kid.id)]);
    const now = new Date().toISOString();
    const fresh = awardsFor({ type: "creation_saved", creationId: creation.id, at: now }, { ledger, attempts });
    await store.learn.saveLedgerEntries(family.householdId, kid.id, fresh);
    const starsToday = pointsOnDay(await store.learn.ledger(family.householdId, kid.id), sgDate(now));
    return ok({ creation, awards: fresh.map((e) => ({ rule: e.rule, amount: e.amount })), starsToday, capReached: starsToday >= DAILY_CAP });
  }

  const parent = await currentParent(store, new RequestCookieJar(request));
  const creations = await store.creations.list(family.householdId, kid.id);
  const c = creations.find((x) => x.id === input.id);
  if (!c) return fail(404, "not-found");
  if (input.share && parent) await store.creations.share(family.householdId, c.id, c.currentVersion, [parent.profile.id]);
  else await store.creations.revoke(family.householdId, c.id);
  await store.audit({ actor: kid.id, actorRole: "kid", action: input.share ? "creation.share" : "creation.revoke", target: c.id, householdId: family.householdId, detail: { version: c.currentVersion } });
  return ok({ creation: { ...c, sharedVersion: input.share && parent ? c.currentVersion : null } });
}
