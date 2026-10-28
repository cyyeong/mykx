// Kix's own new questions (founder, 29 Oct): Muse Spark (Standard) writes fresh practice questions from a session's
// approved patterns (never from a paper's wording: it is only given the patterns, traps and cues, in our own words),
// then a separate cross-check call works each one out again (lib/knowledge/crosscheck.ts). The admin approves each.
// Also the item shape Enhance with Muse writes (lib/skills/enhance.ts). Server only.
import { z } from "zod";
import { sparkStructured } from "../meta/spark.ts";
import { crossCheck } from "./crosscheck.ts";
import type { KixItem } from "./knowledge.ts";
import { itemKeyText } from "./session.ts";

/** A question as Muse writes it: flat, every field present (structured output). */
export const draftItemSchema = z.strictObject({
  topic: z.string().max(60),
  pattern: z.string().max(160),
  type: z.enum(["mcq", "short"]),
  stem: z.string().max(700),
  /** mcq: 4 options; short: null. */
  options: z.array(z.string().max(200)).max(5).nullable(),
  /** mcq: the option number ("2"); short: the answer with its unit. */
  answer: z.string().max(200),
  working: z.array(z.string().max(240)).max(6),
  hints: z.array(z.string().max(200)).max(2),
  marks: z.number().int().min(1).max(5),
  difficulty: z.number().int().min(1).max(4),
});
export type DraftItem = z.infer<typeof draftItemSchema>;

export const kixQuestionsSchema = z.strictObject({ items: z.array(draftItemSchema).max(10) });

export const ITEM_RULES = [
  "Every question is new: your own wording, numbers, names and context. Never copy or closely paraphrase a past-paper question.",
  "Names: everyday Singapore names, never a real person or a child you were told about. No brands, schools or exam names.",
  "mcq: four options and the answer as the option number; short: the answer with its unit. Worked steps in `working`; two hints that nudge without giving the answer.",
  "Pitch the difficulty and marks like the pattern says; check your own answer before you return it.",
];

export async function writeKixQuestions(o: {
  level: string;
  subject: string;
  tier: string | null;
  patterns: { topic: string; pattern: string; marks: number }[];
  traps: string[];
  cues: string[];
  n: number;
  signal?: AbortSignal;
}): Promise<KixItem[]> {
  const { data } = await sparkStructured(
    {
      messages: [
        {
          role: "system",
          content: [
            `You are Kix's question writer for myKx (Singapore ${o.level} ${o.subject}${o.tier ? `, ${o.tier}` : ""}, MOE syllabus). Write ${o.n} fresh practice questions that follow the patterns below, spread across them, and that catch the traps the way the papers do.`,
            ...ITEM_RULES,
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "Patterns (from reviewed papers, in our own words):",
            ...o.patterns.slice(0, 20).map((p) => `- ${p.topic}: ${p.pattern} (${p.marks} marks)`),
            o.traps.length ? `Traps:\n${o.traps.slice(0, 10).map((t) => `- ${t}`).join("\n")}` : "",
            o.cues.length ? `What the marking rewards:\n${o.cues.slice(0, 10).map((c) => `- ${c}`).join("\n")}` : "",
          ].join("\n"),
        },
      ],
      schema: kixQuestionsSchema,
      schemaName: "kix_new_questions",
      reasoningEffort: "medium",
    },
    { timeoutMs: 150_000, signal: o.signal },
  );
  const items: KixItem[] = data.items.slice(0, o.n).map((d) => ({ ...d, options: d.type === "mcq" ? d.options : null }));
  // Worked again, independently, by a separate call.
  const checks = await crossCheck(
    items.map((it, i) => ({ key: `n:${i}`, label: `N${i + 1}`, topic: it.topic, marks: it.marks, keyAnswer: itemKeyText(it), stem: it.stem, options: it.options })),
    { level: o.level, subject: o.subject, signal: o.signal },
  );
  return items.map((it, i) => ({ ...it, check: checks[i] }));
}
