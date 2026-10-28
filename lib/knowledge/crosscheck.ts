// Muse's cross-check (founder, 29 Oct): a separate Muse Spark (Standard) structured call that works each answer out
// independently and says whether the key holds up: ok, mismatch (with its own answer), spelling (with the fix) or
// unusual (marks that don't fit, an answer that doesn't answer). Code adds "waiting" for a question that has no key
// yet (no answer sheet). Used by the knowledge review (a paper's questions, our own items, Kix's new questions) and by
// Enhance with Muse (the questions it wrote). Muse only reports; publishing is blocked by code while a mismatch is
// unresolved (lib/knowledge/session.ts). A school paper's questions are never sent here: for those Muse sees only
// the pattern in its own words and the answer it worked out when it read the paper (rule 10). Server only.
import { z } from "zod";
import { hasMetaApiKey } from "../meta/client.ts";
import { sparkStructured } from "../meta/spark.ts";
import { sameAnswer } from "./session.ts";
import type { CrossCheck } from "./knowledge.ts";

/** One answer to check. Items carry their stem and options (our own or Muse-written material); a school paper's
 *  question carries only its pattern and Muse's earlier worked answer. */
export interface CheckRow {
  key: string;
  label: string;
  topic: string;
  marks: number;
  keyAnswer: string | null;
  pattern?: string;
  workedAnswer?: string | null;
  stem?: string;
  options?: string[] | null;
}

export const crossCheckSchema = z.strictObject({
  checks: z
    .array(
      z.strictObject({
        key: z.string().max(80),
        status: z.enum(["ok", "mismatch", "spelling", "unusual"]),
        museAnswer: z.string().max(200).nullable(),
        fix: z.string().max(200).nullable(),
        note: z.string().max(200).nullable(),
      }),
    )
    .max(80),
});

export function crossCheckPrompt(level: string | null, subject: string | null): string {
  return [
    `You check answer keys for myKx, a Singapore learning app (${[level, subject].filter(Boolean).join(" ") || "primary and secondary"}, MOE syllabus). For every row, work the answer out yourself, then compare it with keyAnswer.`,
    "Rows with a stem: solve the question from its stem and options. Rows without a stem are from a school paper you read earlier: you have the pattern and the answer you worked out then (workedAnswer); judge the key against it.",
    "status: ok when the key is right (the same value; equivalent units or forms count, e.g. 96 min = 1 h 36 min). mismatch when it's wrong: put your answer in museAnswer. spelling when the key is right but misspelt: put the corrected text in fix. unusual when something doesn't fit (marks too high or low for the work, a missing part, an answer that doesn't answer the question): say what in note.",
    "Keep museAnswer short (a number with its unit, an option number, or a few words) and note under 20 words. Return one check per row, with the row's key.",
  ].join("\n");
}

const rowText = (r: CheckRow) =>
  JSON.stringify({
    key: r.key,
    question: r.label,
    topic: r.topic,
    marks: r.marks,
    keyAnswer: r.keyAnswer,
    ...(r.stem ? { stem: r.stem, options: r.options ?? null } : { pattern: r.pattern ?? null, workedAnswer: r.workedAnswer ?? null }),
  });

/** Without Muse (no key, or the call failed): compare the key with Muse's earlier worked answer, else say so. */
export function fallbackCheck(r: CheckRow): CrossCheck {
  if (!r.keyAnswer) return { key: r.key, status: "waiting", museAnswer: null, fix: null, note: "No answer yet: add the answer sheet." };
  if (r.workedAnswer) return sameAnswer(r.keyAnswer, r.workedAnswer) ? { key: r.key, status: "ok", museAnswer: r.workedAnswer, fix: null, note: null } : { key: r.key, status: "mismatch", museAnswer: r.workedAnswer, fix: null, note: "The key differs from the answer Muse worked out when it read the paper." };
  return { key: r.key, status: "unusual", museAnswer: null, fix: null, note: "Muse couldn't check this one: check it yourself." };
}

/**
 * Checks every row that has a key; rows without one are "waiting". One structured call for up to 40 rows (more are
 * checked in a second call). Never throws: a failed call falls back to `fallbackCheck`.
 */
export async function crossCheck(rows: readonly CheckRow[], o: { level: string | null; subject: string | null; signal?: AbortSignal }): Promise<CrossCheck[]> {
  const out = new Map<string, CrossCheck>();
  const keyed = rows.filter((r) => r.keyAnswer);
  for (const r of rows) if (!r.keyAnswer) out.set(r.key, fallbackCheck(r));
  for (let i = 0; i < keyed.length; i += 40) {
    const batch = keyed.slice(i, i + 40);
    let got: CrossCheck[] = [];
    if (hasMetaApiKey()) {
      try {
        const { data } = await sparkStructured(
          {
            messages: [
              { role: "system", content: crossCheckPrompt(o.level, o.subject) },
              { role: "user", content: batch.map(rowText).join("\n") },
            ],
            schema: crossCheckSchema,
            schemaName: "answer_cross_check",
            reasoningEffort: "medium",
          },
          { timeoutMs: 150_000, signal: o.signal },
        );
        got = data.checks;
      } catch {
        got = [];
      }
    }
    for (const r of batch) {
      const c = got.find((x) => x.key === r.key);
      // A "mismatch" whose answers are the same value after all is a pass.
      if (c?.status === "mismatch" && c.museAnswer && sameAnswer(c.museAnswer, r.keyAnswer ?? "")) out.set(r.key, { ...c, status: "ok" });
      else out.set(r.key, c ? { key: r.key, status: c.status, museAnswer: c.museAnswer, fix: c.fix, note: c.note } : fallbackCheck(r));
    }
  }
  return rows.map((r) => out.get(r.key) ?? fallbackCheck(r));
}
