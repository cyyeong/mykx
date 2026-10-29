// Kix's interest spark in the question player (founder, 29 Oct). When a kid drifts on a question (no taps for a
// while, or quick guesses), the player asks for one line that ties something they love to the thinking the question
// needs: the Kix Tutor's "spark" part on Muse Spark (Standard), with the item's worked steps as context. Interests
// are chips on the kid's profile (lib/kix/interests.ts), so nothing free-typed reaches the prompt. Without a model,
// or if it fails or names the answer, a true cached fact from that interest stands in (rule 7). A spark never
// touches mastery or rewards (rule 5), and nothing about the drift is stored.
import { z } from "zod";
import { instructionsFor } from "@/lib/agents/runtime";
import { getStore } from "@/lib/auth/context";
import { requireFamily } from "@/lib/auth/guard";
import { fail, ok, readBody } from "@/lib/auth/http";
import { loadTender } from "@/lib/guardian/load";
import { pickSpark, SPARKS } from "@/lib/kix/interests";
import { toneNote } from "@/lib/kix/today";
import { sparkSystem, tutorVars } from "@/lib/kix/tutor-prompt";
import { FROG_QUEST, loadFrogItems } from "@/lib/learn/frog-quest";
import { hasMetaApiKey } from "@/lib/meta/client";
import { sparkStructured } from "@/lib/meta/spark";
import { logRunsFor } from "@/lib/runs/log";
import { refreshSkillOverrides } from "@/lib/skills/overrides";

const body = z.strictObject({
  itemId: z.string().min(1).max(100),
  /** How many sparks this session has had: turns through the kid's interests and facts. */
  turn: z.number().int().min(0).max(50),
});
const lineSchema = z.strictObject({ line: z.string().min(1).max(240) });

/** The answer in words, to keep it out of the line (an option's text, or a short answer). */
function answerWords(item: { options?: string[]; answer: number | string }): string | null {
  const a = typeof item.answer === "number" ? item.options?.[item.answer - 1] : item.answer;
  return a && a.trim().length >= 3 ? a.trim().toLowerCase() : null;
}

export async function POST(request: Request) {
  const family = await requireFamily(request, "spark", 6);
  if (family.refused) return family.refused;
  const kid = family.kid;
  if (!kid) return fail(401, "no-kid");
  const input = await readBody(request, body);
  if (!input) return fail(400, "invalid");
  const item = loadFrogItems().find((i) => i.id === input.itemId);
  if (!item) return fail(404, "not-found");
  const spark = pickSpark(kid.interests, input.turn);
  if (!spark) return ok({ spark: null });
  const cached = { interest: spark.interest, line: `${spark.line} Now, back to the question: what do you notice first?`, place: spark.place, source: "cached" };
  if (!hasMetaApiKey()) return ok({ spark: cached });

  logRunsFor("tutor", family.householdId, kid.id);
  const store = getStore();
  await refreshSkillOverrides(store);
  try {
    const tender = store ? await loadTender(store, family.householdId, kid).catch(() => null) : null;
    const head = await instructionsFor("tutor", tutorVars(kid), { part: "spark", store });
    const system = sparkSystem({ kid, item, interest: spark.interest, flavour: SPARKS[spark.interest].flavour, tone: toneNote(tender) }, head);
    const { data } = await sparkStructured(
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Write the spark for ${kid.nickname}. A fact you may use: ${spark.line}` },
        ],
        schema: lineSchema,
        schemaName: "kix_spark",
        reasoningEffort: "minimal",
      },
      { timeoutMs: 10_000, signal: request.signal },
    );
    const line = data.line.trim();
    const answer = answerWords(item);
    if (!line || (answer && line.toLowerCase().includes(answer))) return ok({ spark: cached });
    return ok({ spark: { ...cached, line, source: "muse-spark-1.3" }, skill: `${FROG_QUEST.skill}@${FROG_QUEST.version}` });
  } catch {
    return ok({ spark: cached });
  }
}
