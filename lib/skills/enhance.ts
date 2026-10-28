// Enhance with Muse (founder, 29 Oct; Skill Editor agent). The admin writes what to improve; Muse Spark 1.3
// (Standard, structured output) proposes whole-file replacements or additions, limited to SKILL.md and
// references/*.md, plus new questions. Code turns the questions into items in a new items/enhance-<version>.json
// as drafts (status "draft" until the admin marks them reviewed), and a separate cross-check call works each one
// out again and flags any whose answer it couldn't reproduce. Nothing is saved here: the admin sees the proposal as a
// diff and accepts it into a draft. Server only.
import { z } from "zod";
import { crossCheck } from "../knowledge/crosscheck.ts";
import { draftItemSchema, ITEM_RULES } from "../knowledge/kix-questions.ts";
import { toItem } from "../knowledge/refine.ts";
import { itemKeyText } from "../knowledge/session.ts";
import { sparkStructured } from "../meta/spark.ts";
import type { SkillItem, SkillManifest } from "../types.ts";
import { FILE_PATH, type PackFiles } from "./versions.ts";

export const enhanceSchema = z.strictObject({
  /** One or two sentences: what changed and why. */
  summary: z.string().max(400),
  files: z
    .array(
      z.strictObject({
        /** SKILL.md or references/<name>.md (a new file is an addition). */
        path: z.string().max(90),
        why: z.string().max(240),
        /** The whole new text of the file. */
        text: z.string().max(60_000),
      }),
    )
    .max(5),
  items: z.array(draftItemSchema).max(10),
});

export interface EnhanceChange {
  path: string;
  why: string;
  before: string | null;
  after: string;
}

export interface EnhanceCheck {
  id: string;
  status: "ok" | "mismatch" | "spelling" | "unusual" | "waiting";
  museAnswer: string | null;
  note: string | null;
}

export interface EnhanceProposal {
  summary: string;
  changes: EnhanceChange[];
  /** New questions, as drafts. */
  items: SkillItem[];
  /** Muse working each new question out again. */
  checks: EnhanceCheck[];
  /** What code left out of Muse's answer, and why. */
  ignored: string[];
}

const MAX_PROMPT_REF = 9_000;
const MAX_PROMPT_TOTAL = 60_000;

export function enhanceMessages(files: PackFiles, m: SkillManifest, ask: string) {
  const refs = Object.keys(files).filter((p) => p.startsWith("references/")).sort();
  let budget = MAX_PROMPT_TOTAL;
  const refText = refs.map((p) => {
    const t = files[p].slice(0, Math.max(0, Math.min(MAX_PROMPT_REF, budget)));
    budget -= t.length;
    return `### ${p}${t.length < files[p].length ? " (shortened here: if you change it, change only what you can see and keep the rest by not returning this file)" : ""}\n${t}`;
  });
  const counts = new Map<string, number>();
  for (const [p, t] of Object.entries(files))
    if (p.startsWith("items/"))
      try {
        for (const it of JSON.parse(t) as { topic?: string }[]) counts.set(it.topic ?? "", (counts.get(it.topic ?? "") ?? 0) + 1);
      } catch {
        // an item file mid-edit: skip its counts
      }
  return [
    {
      role: "system" as const,
      content: [
        `You improve a teaching skill pack for myKx, a Singapore learning app: ${m.title} (${m.level} ${m.subject}${m.tier ? `, ${m.tier}` : ""}, ${m.syllabus}). An admin tells you what to improve. Propose changes; a person reviews every one.`,
        "files: only SKILL.md and references/*.md. Return the WHOLE new text of each file you change (keep everything that should stay), or a new references/<name>.md. Keep `## ` headings for sections: agents read a reference section by section. Never change skill.json or existing items. Never put a child's name, a school, an exam paper's name or a diagnosis in a pack.",
        `items: new practice questions, if the admin asks for any. topic must be one of the pack's topic ids: ${m.topics.map((t) => `${t.id} (${t.title}; subskills ${t.subskills.join(", ")})`).join("; ")}.`,
        ...ITEM_RULES,
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [`What to improve: ${ask}`, "", "## SKILL.md", files["SKILL.md"]?.slice(0, 14_000) ?? "", "", "## References", ...refText, "", `## Questions already in the pack by topic: ${[...counts.entries()].map(([t, n]) => `${t} ${n}`).join(", ") || "none"}`].join("\n"),
    },
  ];
}

/** Muse's proposal, made safe: allowed paths only, items as drafts in the pack's format, each worked again by Muse. */
export async function enhancePack(o: { packId: string; files: PackFiles; ask: string; version: string; signal?: AbortSignal }): Promise<EnhanceProposal> {
  const m = JSON.parse(o.files["skill.json"]) as SkillManifest;
  const { data } = await sparkStructured(
    { messages: enhanceMessages(o.files, m, o.ask), schema: enhanceSchema, schemaName: "skill_enhancement", reasoningEffort: "medium" },
    { timeoutMs: 240_000, signal: o.signal },
  );
  const ignored: string[] = [];
  const changes: EnhanceChange[] = [];
  for (const f of data.files) {
    const path = f.path.trim().replace(/^\.?\//, "");
    if (!(path === "SKILL.md" || (path.startsWith("references/") && FILE_PATH.test(path)))) {
      ignored.push(`${path}: Muse may change only SKILL.md and references/*.md`);
      continue;
    }
    const after = f.text.replace(/\r\n/g, "\n").replace(/\n*$/, "\n");
    const before = o.files[path] ?? null;
    if (before === after) continue;
    if (path === "SKILL.md" && !/^---\n[\s\S]*?\n---/.test(after)) {
      ignored.push("SKILL.md: Muse's version lost the front matter, so it was left out");
      continue;
    }
    changes.push({ path, why: f.why, before, after });
  }
  const stamp = o.version.replace(/\./g, "");
  const items: SkillItem[] = [];
  data.items.forEach((d, i) => {
    const topic = m.topics.find((t) => t.id === d.topic || t.title.toLowerCase() === d.topic.toLowerCase());
    if (!topic) ignored.push(`question ${i + 1}: topic "${d.topic}" isn't in the pack; put under ${m.topics[0].id}`);
    const t = topic ?? m.topics[0];
    const item = toItem(d, { id: `${o.packId}-mx${stamp}-${i + 1}`, packId: o.packId, topicId: t.id, subskill: t.subskills[0], version: o.version, kind: "generated", ref: `Enhance with Muse, v${o.version}`, reviewedBy: null });
    if (item) items.push(item);
    else ignored.push(`question ${i + 1}: not a question Kix can serve (its options or answer didn't fit)`);
  });
  const checks = items.length
    ? await crossCheck(
        items.map((it) => ({ key: it.id, label: it.id, topic: it.topic, marks: it.marks, keyAnswer: itemKeyText({ type: it.type, options: it.options ?? null, answer: String(it.answer) }), stem: it.stem, options: it.options ?? null })),
        { level: m.level, subject: m.subject, signal: o.signal },
      )
    : [];
  if (items.length) {
    const path = `items/enhance-${o.version}.json`;
    let prior: SkillItem[] = [];
    try {
      prior = o.files[path] ? (JSON.parse(o.files[path]) as SkillItem[]) : [];
    } catch {
      prior = [];
    }
    const ids = new Set(prior.map((x) => x.id));
    const merged = [...prior, ...items.map((it, i) => (ids.has(it.id) ? { ...it, id: `${it.id}-${prior.length + i + 1}` } : it))];
    changes.push({ path, why: `${items.length} new ${items.length === 1 ? "question" : "questions"}, drafts until you mark them reviewed`, before: o.files[path] ?? null, after: `${JSON.stringify(merged, null, 2)}\n` });
  }
  return { summary: data.summary, changes, items, checks: checks.map((c) => ({ id: c.key, status: c.status, museAnswer: c.museAnswer, note: c.note })), ignored };
}
