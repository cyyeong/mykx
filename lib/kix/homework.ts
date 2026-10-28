// Ask Kix: homework help (founder, 28 Oct). The child types a question or sends a photo of it; Kix explains it
// the way the Singapore syllabus teaches it (the skill pack's own method: model drawing, heuristics, CER…), as a
// short visual lesson with a memory hook. Guide first: a hint, then the steps, and the full working only when the
// child asks after trying. The model returns a validated JSON spec that trusted components draw (rule 4); it
// never writes markup or code. Standard model only (rule 1); the photo is read once and never stored.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

export const STAGES = ["hint", "steps", "full"] as const;
export type Stage = (typeof STAGES)[number];

const text = (max: number) => z.string().max(max);

/** One block of Kix's explanation. A flat shape (every field present, unused ones null) keeps the JSON schema
 *  simple for structured output; the renderer only draws the fields its kind uses. */
export const blockSchema = z.strictObject({
  kind: z.enum(["say", "steps", "bar-model", "cer", "memory-hook", "try-this"]),
  title: text(80).nullable(),
  text: text(400).nullable(),
  /** steps: one line each, in order. */
  steps: z.array(text(200)).max(6).nullable(),
  /** bar-model: up to four labelled bars; each part has a label and a value, or "?" for the unknown. */
  bars: z
    .array(z.strictObject({ label: text(30), parts: z.array(z.strictObject({ label: text(30), value: text(12) })).min(1).max(6) }))
    .max(4)
    .nullable(),
  /** cer: the science answer frame. */
  claim: text(200).nullable(),
  evidence: text(240).nullable(),
  reasoning: text(240).nullable(),
  /** memory-hook: how to remember it. */
  hook: z.enum(["rhyme", "story", "acronym", "picture", "chant"]).nullable(),
  /** try-this: a fresh, similar question (never copied from a paper) and its answer. */
  question: text(300).nullable(),
  answer: text(200).nullable(),
});
export type Block = z.infer<typeof blockSchema>;

export const explanationSchema = z.strictObject({
  /** The question as Kix read it, in plain words (for a photo: what's on the page, no names). */
  question: text(500),
  /** What a figure in the photo shows, in words, so later steps don't need the photo again. */
  figure: text(300).nullable(),
  subject: z.enum(["maths", "science", "english", "chinese", "other"]),
  topic: text(80),
  /** The syllabus method Kix uses, e.g. "Model drawing: before and after". */
  method: text(80),
  stage: z.enum(STAGES),
  blocks: z.array(blockSchema).min(1).max(6),
  /** Only at the "full" stage. */
  finalAnswer: text(200).nullable(),
  /** The page isn't schoolwork, or Kix can't read it: say so kindly instead of guessing. */
  unclear: z.boolean(),
});
export type Explanation = z.infer<typeof explanationSchema>;

/** The method references for each subject's pack at a level: the parts of the pack Kix teaches from. */
const METHOD_REFS: Record<string, string[]> = {
  "p3-maths": ["model-method.md", "coaching-playbook.md"],
  "p3-science": ["answering-cer.md", "coaching-playbook.md"],
  "p3-english": ["answer-strategies.md", "teaching-toolkit.md"],
  "p3-chinese": ["coaching-playbook.md"],
  "p6-maths": ["heuristics.md", "tutoring-method.md"],
  "p6-science": ["answer-techniques.md", "memory-strategies.md"],
  "s2-science": ["coaching-playbook.md"],
};

/** The packs at a level ("P3" → p3-*, "Sec 2" → s2-*). */
export function packsForLevel(level: string | null): string[] {
  const prefix = level?.startsWith("Sec") ? `s${level.slice(4)}-` : `${(level ?? "P3").toLowerCase()}-`;
  return Object.keys(METHOD_REFS).filter((p) => p.startsWith(prefix));
}

/** The teaching notes Kix reads for this level, trimmed so one call stays small. Server only. */
export function teachingNotes(level: string | null, root = process.cwd()): string {
  const parts: string[] = [];
  for (const pack of packsForLevel(level)) {
    const dir = join(root, "content", "skills", pack);
    const read = (f: string, max: number) => {
      const p = join(dir, f);
      return existsSync(p) ? readFileSync(p, "utf8").slice(0, max) : "";
    };
    parts.push(`## Pack ${pack}\n${read("SKILL.md", 3500)}\n${METHOD_REFS[pack].map((f) => read(join("references", f), 2500)).join("\n")}`);
  }
  return parts.join("\n\n");
}

const STAGE_RULES: Record<Stage, string> = {
  hint: "Stage HINT: restate what the question asks, name the method, give ONE hint that starts the child off, and a memory hook. No steps beyond the first, no answer. finalAnswer null.",
  steps: "Stage STEPS: the method as numbered steps the child can follow, with a bar model (maths word problems) or a CER frame (science explanations) where it helps. Stop before the last calculation or the final sentence; finalAnswer null.",
  full: "Stage FULL: the complete worked solution in steps, the final answer in finalAnswer, a memory hook, and one fresh try-this question (new numbers or context, never copied) with its answer.",
};

export function systemPrompt(o: { nickname: string; level: string | null; band: string | null; stage: Stage; notes: string }): string {
  const teen = o.band === "teen";
  return [
    `You are Kix, ${o.nickname}'s friendly study sidekick in myKx (Singapore, ${o.level ?? "primary"}). You help with homework the way the Singapore MOE syllabus teaches it, using the pack notes below (methods, answer frames, common traps).`,
    teen ? "Tone: peer, clear, no baby talk." : "Tone: warm, short sentences, concrete; a 9-year-old reads this.",
    "Help the child learn, not copy: explain the thinking so they can do the next one alone.",
    "Make it stick: give a memory hook (rhyme, story, acronym, picture or chant) that fits the idea.",
    "Visuals are data, never markup: use the blocks. bar-model parts carry a value or \"?\" for the unknown; cer uses claim, evidence, reasoning. Fill unused fields with null.",
    STAGE_RULES[o.stage],
    "If the photo or text isn't schoolwork, can't be read, or asks for something unsafe, set unclear true and use one say block to ask kindly for the question. Never repeat a name, school or face you see on the page.",
    "Never copy a past-paper question into try-this: write a new one.",
    "",
    "# Pack notes",
    o.notes,
  ].join("\n");
}

/** Guide first, enforced here rather than trusted to the model: before the full stage there's no final answer
 *  and no try-this (its answer would give the game away), and the stage is the one the child asked for. */
export function enforceStage(e: Explanation, stage: Stage): Explanation {
  if (stage === "full") return { ...e, stage };
  const blocks = e.blocks.filter((b) => b.kind !== "try-this");
  return { ...e, stage, finalAnswer: null, blocks: blocks.length ? blocks : e.blocks.slice(0, 1) };
}

/** Shown when the model is unavailable (no key, error or timeout): the demo path never depends on a live call (rule 7). */
export function sampleExplanation(stage: Stage): Explanation {
  const blocks: Block[] = [
    { kind: "say", title: null, text: "This one is about a frog's life cycle. Let's put the stages in order!", steps: null, bars: null, claim: null, evidence: null, reasoning: null, hook: null, question: null, answer: null },
    { kind: "memory-hook", title: "Remember it", text: "Every Tadpole Finds Freedom: Egg, Tadpole, Froglet, Frog.", steps: null, bars: null, claim: null, evidence: null, reasoning: null, hook: "acronym", question: null, answer: null },
  ];
  if (stage !== "hint") {
    blocks.splice(1, 0, {
      kind: "steps",
      title: "Step by step",
      text: null,
      steps: ["Find the stage that comes out of the egg: the tadpole.", "Look for the stage with legs and a tail: the froglet.", "The adult frog has no tail and lives on land."],
      bars: null,
      claim: null,
      evidence: null,
      reasoning: null,
      hook: null,
      question: null,
      answer: null,
    });
  }
  if (stage === "full") {
    blocks.push({ kind: "try-this", title: "Try this one", text: null, steps: null, bars: null, claim: null, evidence: null, reasoning: null, hook: null, question: "Which stage of a frog breathes with gills and has no legs?", answer: "The tadpole." });
  }
  return {
    question: "Put the stages of a frog's life cycle in order.",
    figure: null,
    subject: "science",
    topic: "Life cycles of animals",
    method: "Sequence the stages, then check each one's features",
    stage,
    blocks,
    finalAnswer: stage === "full" ? "Egg → tadpole → froglet → adult frog" : null,
    unclear: false,
  };
}
