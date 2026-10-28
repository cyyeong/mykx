// After a session, one Muse Spark call (Standard, structured output) reads only the kid's own words to Kix in it,
// the session's deterministic stats and the current Notebook pages, and returns: a mood reading with the words
// behind it, whether anything worried it, and Notebook patches (lib/notebook/notebook.ts applies them). Family
// messages never come here (rule 12). It never changes mastery or rewards (rule 5).
import { z } from "zod";
import { MOODS } from "../guardian/words.ts";
import { PAGE_TITLE, PAGES, patchSchema } from "./notebook.ts";

export const sessionReadSchema = z.strictObject({
  mood: z.enum(MOODS),
  confidence: z.enum(["low", "medium", "high"]),
  /** The kid's own short phrases behind the reading (at most three). */
  evidence: z.array(z.string().max(80)).max(3),
  /** Distress, safety or strong negative self-talk in the words. */
  concern: z.boolean(),
  patches: z.array(patchSchema).max(5),
});
export type SessionRead = z.infer<typeof sessionReadSchema>;

export function sessionClosePrompt(o: { nickname: string; level: string | null; stats: string; pages: Partial<Record<string, string>> }): string {
  return [
    `You are the Memory Keeper for Kix, ${o.nickname}'s study sidekick (Singapore ${o.level ?? "primary"}).`,
    "Read only the child's own words to Kix from one session (below), with the session's numbers.",
    "1. mood: calm, happy, curious, unsure, frustrated, tired or worried, with confidence and up to three of the child's own short phrases as evidence. If the words say little, use calm with low confidence.",
    "2. concern: true only for distress, safety worries or strong negative self-talk.",
    `3. patches: at most 5 short Notebook updates that would help Kix be kinder and more useful next time. Pages: ${PAGES.map((p) => `${p} (${PAGE_TITLE[p]})`).join(", ")}. Plain, kind, specific observations ("asks 'why' about animals"), never a label, diagnosis or judgement, never a score, never anything private about family.`,
    "",
    `# Session numbers\n${o.stats}`,
    `# Current Notebook\n${PAGES.map((p) => `## ${p}\n${o.pages[p] ?? "(empty)"}`).join("\n")}`,
  ].join("\n");
}
