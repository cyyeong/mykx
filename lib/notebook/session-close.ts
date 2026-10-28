// After a session, one Muse Spark call (Standard, structured output) reads only the kid's own words to Kix in it,
// the session's deterministic stats and the current Notebook pages, and returns: a mood reading with the words
// behind it, whether anything worried it, and Notebook patches (lib/notebook/notebook.ts applies them). Family
// messages never come here (rule 12). It never changes mastery or rewards (rule 5).
import { z } from "zod";
import { compose, type Vars } from "../agents/instructions.ts";
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

/** What the Memory Keeper's instructions may fill in (lib/agents/instructions.ts). */
export const memoryKeeperVars = (o: { nickname: string; level: string | null; band?: string | null }): Vars => ({
  nickname: o.nickname,
  level: o.level ?? "primary",
  band: o.band === "teen" ? "teen" : "junior",
  pages: PAGES.map((p) => `${p} (${PAGE_TITLE[p]})`).join(", "),
});

/** The Memory Keeper's instructions (the published version, which the route passes as `head`) and guardrails, then the session. */
export function sessionClosePrompt(o: { nickname: string; level: string | null; band?: string | null; stats: string; pages: Partial<Record<string, string>> }, head = compose("memory-keeper", memoryKeeperVars(o))): string {
  return [
    head,
    "",
    `# Session numbers\n${o.stats}`,
    `# Current Notebook\n${PAGES.map((p) => `## ${p}\n${o.pages[p] ?? "(empty)"}`).join("\n")}`,
  ].join("\n");
}
