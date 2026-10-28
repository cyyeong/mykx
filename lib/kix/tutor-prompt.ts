// The Kix Tutor's two system prompts: a hint or a "why?" in the question player (app/api/kix/tutor), and feedback on
// the child's reason after marking (app/api/kix/reason). Each is the tutor's instructions for that part with its fixed
// guardrails (lib/agents/instructions.ts; the routes pass the published version through instructionsFor), then the
// question as context. Pure, so tests can check the defaults against the prompts as they were before.
import type { SkillItem } from "../types.ts";
import { compose, type Vars } from "../agents/instructions.ts";

type Kid = { nickname: string; level: string | null; band: string | null };
type Item = Pick<SkillItem, "id" | "stem" | "options" | "working" | "hints">;

/** What the tutor's instructions may fill in, for either part. */
export const tutorVars = (kid: Kid, extra: Vars = {}): Vars => ({ nickname: kid.nickname, level: kid.level ?? "P3", band: kid.band === "teen" ? "teen" : "junior", ...extra });

const optionsLine = (item: Item) => (item.options?.length ? `\nOptions: ${item.options.map((o, i) => `(${i + 1}) ${o}`).join("  ")}` : "");

/** The hint (or "why?") prompt. `remembered` is the Notebook's notes for Kix (lib/notebook/notebook.ts). */
export function hintSystem(o: { kid: Kid; item: Item; remembered: string }, head = compose("tutor", tutorVars(o.kid), null, "hint")): string {
  const hints = o.item.hints ?? [];
  return [
    head,
    `# The question\n${o.item.stem}${optionsLine(o.item)}`,
    `# The worked steps (for you only; never repeat the conclusion)\n${(o.item.working ?? []).join("\n")}`,
    `# The item's own hints, in order\n${hints.map((h, i) => `${i + 1}. ${h}`).join("\n")}`,
    `This question is item ${o.item.id}. You may never check_answer it: the child submits their own answer.`,
    o.remembered,
  ]
    .filter(Boolean)
    .join("\n");
}

/** The reason-feedback prompt. `right` is the right answer in words; `notes` the pack's method notes. */
export function reasonSystem(o: { kid: Kid; item: Item; correct: boolean; right: string; pack: string; notes: string }, head = compose("tutor", tutorVars(o.kid, { correct: o.correct }), null, "reason")): string {
  return [
    head,
    "",
    `# The question\n${o.item.stem}${optionsLine(o.item)}`,
    `# The right answer (for you only${o.correct ? "" : "; do not reveal it"})\n${o.right}`,
    `# Worked steps (for you only)\n${(o.item.working ?? []).join("\n")}`,
    `# Pack notes (${o.pack})\n${o.notes}`,
  ].join("\n");
}
