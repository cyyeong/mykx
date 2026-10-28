// Kix Tutor in the question player. The kid asks for a hint or asks "why?" (typed or by voice); Muse Spark
// (Standard) answers in a sentence or two, streamed, using the question's own skill pack (its method and answer
// frames) and the item's worked steps, and never gives the answer away. Every ask counts as a hint, so a helped
// answer is never mastery evidence (rule 5). Without a model, the item's own next hint answers instead (rule 7).
import { z } from "zod";
import { requireFamily } from "@/lib/auth/guard";
import { fail, ok, readBody } from "@/lib/auth/http";
import { getStore } from "@/lib/auth/context";
import { caringReply, checkWords, HELPLINES } from "@/lib/guardian/words";
import { packNotes } from "@/lib/kix/homework";
import { FROG_QUEST, loadFrogItems } from "@/lib/learn/frog-quest";
import { notebookNotes } from "@/lib/notebook/notebook";
import { hasMetaApiKey } from "@/lib/meta/client";
import { sparkStream } from "@/lib/meta/spark";
import { logRunsFor } from "@/lib/runs/log";

const body = z.strictObject({
  itemId: z.string().min(1).max(100),
  /** The hint number the kid is now on (1-based), for the cached fallback. */
  hint: z.number().int().min(1).max(10),
  /** The kid's own question ("why is it the tadpole?"), typed or transcribed. */
  ask: z.string().trim().max(300).optional(),
});

const SKILL = `${FROG_QUEST.skill}@${FROG_QUEST.version}`;

function textStream(text: string, source: string): Response {
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8", "x-kix-skill": SKILL, "x-kix-source": source } });
}

export async function POST(request: Request) {
  const family = await requireFamily(request, "tutor", 20);
  if (family.refused) return family.refused;
  const kid = family.kid;
  if (!kid) return fail(401, "no-kid");
  logRunsFor("tutor", family.householdId, kid.id);
  const input = await readBody(request, body);
  if (!input) return fail(400, "invalid");
  const item = loadFrogItems().find((i) => i.id === input.itemId);
  if (!item) return fail(404, "not-found");

  if (input.ask) {
    const check = checkWords(input.ask);
    await getStore()?.guardian.saveMessage(family.householdId, kid.id, { at: new Date().toISOString(), text: input.ask, source: "talk", ...check }).catch(() => undefined);
    if (check.distress) return ok({ care: { reply: caringReply(kid.nickname), helplines: HELPLINES } });
  }

  const hints = item.hints ?? [];
  const choices = item.options ?? [];
  const cached = hints[Math.min(input.hint, hints.length) - 1] ?? "Read the question again slowly. What is it really asking?";
  if (!hasMetaApiKey()) return textStream(cached, "cached");

  const remembered = notebookNotes(kid.nickname, (await getStore()?.notebook.pages(family.householdId, kid.id).catch(() => [])) ?? []);
  const options = choices.length ? `\nOptions: ${choices.map((o, i) => `(${i + 1}) ${o}`).join("  ")}` : "";
  const system = [
    `You are Kix, ${kid.nickname}'s friendly study sidekick (Singapore ${kid.level ?? "P3"}). You are helping with one question during a quest.`,
    "Answer in at most two short sentences a 9-year-old can read aloud. Warm, concrete, no baby talk.",
    "NEVER say the answer, which option is right, or the final word or number. Point to the thinking: what to notice, what to compare, the next small step.",
    "Use the pack's method (e.g. claim, evidence, reasoning for science explanations).",
    "If the child asks something off-topic or unsafe, kindly bring them back to the question.",
    "",
    `# The question\n${item.stem}${options}`,
    `# The worked steps (for you only; never repeat the conclusion)\n${(item.working ?? []).join("\n")}`,
    `# The item's own hints, in order\n${hints.map((h, i) => `${i + 1}. ${h}`).join("\n")}`,
    `# Pack notes (${SKILL})\n${packNotes(FROG_QUEST.skill)}`,
    remembered,
  ]
    .filter(Boolean)
    .join("\n");
  const user = input.ask ? `${kid.nickname} asks: ${input.ask}` : `Give hint ${input.hint}: a nudge that builds on the earlier hints.`;

  try {
    const stream = sparkStream({ messages: [{ role: "system", content: system }, { role: "user", content: user }], reasoningEffort: "minimal", maxCompletionTokens: 2000 }, { timeoutMs: 20_000, signal: request.signal });
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let sent = false;
        try {
          for await (const delta of stream) {
            sent = true;
            controller.enqueue(encoder.encode(delta));
          }
        } catch {
          // A failed stream still leaves the kid with a hint.
          if (!sent) controller.enqueue(encoder.encode(cached));
        }
        controller.close();
      },
    });
    return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "x-kix-skill": SKILL, "x-kix-source": "muse-spark-1.3", "cache-control": "no-store" } });
  } catch {
    return textStream(cached, "cached");
  }
}
