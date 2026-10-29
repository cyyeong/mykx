// Kix Synapse: a kid flags what's wrong (docs/prd/SYNAPSE.md §4). A Learn question is looked up in the kid's own
// packs; an AI reply comes with its signed turn and the words shown, checked here. Upset words take Kix's caring path
// and the helplines first, and that note is never reviewed. The review runs after the response (lib/synapse/server.ts).
// GET: the kid's own reports, as the kid may see them (fixed, Kix was right, or checking).
import { z } from "zod";
import { getStore } from "@/lib/auth/context";
import { requireFamily } from "@/lib/auth/guard";
import { fail, ok, readBody } from "@/lib/auth/http";
import { caringReply, checkWords, HELPLINES } from "@/lib/guardian/words";
import { isGuest } from "@/lib/guest";
import { refreshSkillOverrides } from "@/lib/skills/overrides";
import { kidView, takeReport } from "@/lib/synapse/intake";
import { reviewLater } from "@/lib/synapse/server";
import { REPORT_KINDS, SURFACES } from "@/lib/synapse/types";
import { SynapseTablesMissingError } from "@/lib/auth/store";

export const maxDuration = 300;

const body = z.strictObject({
  surface: z.enum(SURFACES),
  kind: z.enum(REPORT_KINDS),
  note: z.string().trim().max(300).nullable().optional(),
  itemId: z.string().max(100).nullable().optional(),
  answer: z.string().max(200).nullable().optional(),
  marked: z.boolean().nullable().optional(),
  token: z.string().max(2048).nullable().optional(),
  shown: z.string().max(6000).nullable().optional(),
  ask: z.string().max(1000).nullable().optional(),
});

export async function POST(request: Request) {
  const family = await requireFamily(request, "synapse", 10);
  if (family.refused) return family.refused;
  const kid = family.kid;
  if (!kid) return fail(401, "no-kid");
  const input = await readBody(request, body);
  if (!input) return fail(400, "invalid");
  const store = getStore()!;
  if (input.note) {
    const check = checkWords(input.note);
    if (check.distress) {
      await store.guardian.saveMessage(family.householdId, kid.id, { at: new Date().toISOString(), text: input.note, source: "talk", ...check }).catch(() => undefined);
      return ok({ care: { reply: caringReply(kid.nickname), helplines: HELPLINES }, report: null });
    }
  }
  // The guest walkthrough keeps nothing: it shows what would happen.
  if (isGuest()) return ok({ care: null, report: { id: "guest", surface: input.surface, kind: input.kind, itemId: input.itemId ?? null, state: "checking", note: null, at: new Date().toISOString() }, sample: true });
  await refreshSkillOverrides(store);
  try {
    const taken = await takeReport(store, family.householdId, kid, { ...input, note: input.note ?? null });
    if (!taken.ok) return fail(taken.status, taken.reason, taken.note ? { note: taken.note } : undefined);
    if (!taken.duplicate) reviewLater(store, taken.report.id, family.householdId);
    return ok({ care: null, report: kidView(taken.report), duplicate: taken.duplicate });
  } catch (e) {
    if (e instanceof SynapseTablesMissingError) return fail(503, "not-configured");
    throw e;
  }
}

export async function GET(request: Request) {
  const family = await requireFamily(request, "synapse-read", 60);
  if (family.refused) return family.refused;
  const kid = family.kid;
  if (!kid) return fail(401, "no-kid");
  if (isGuest()) return ok({ reports: [] });
  const id = new URL(request.url).searchParams.get("id");
  const store = getStore()!;
  const mine = await store.synapse.reports({ householdId: family.householdId, profileId: kid.id, limit: 30 }).catch(() => []);
  const list = (id ? mine.filter((r) => r.id === id) : mine).map(kidView);
  return ok({ reports: list });
}
