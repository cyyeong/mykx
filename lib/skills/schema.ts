// Zod schemas for skill packs (docs/prd/SKILL_ENGINE.md §4).
// The TypeScript shapes are in lib/types.ts; the checks at the bottom keep the two in step.
import { z } from "zod";
import type { Archetype, SkillItem, SkillManifest, SkillTopic } from "../types.ts";

const id = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/, "lowercase id");
const semver = z.string().regex(/^\d+\.\d+\.\d+$/, "semver");
const share = z.number().min(0).max(1);
const packPath = (dir: string) =>
  z
    .string()
    .regex(new RegExp(`^${dir}/[A-Za-z0-9._-]+$`), `a file in ${dir}/`)
    .refine((p) => !p.includes(".."), "no parent paths");

export const AgentSkillModeSchema = z.enum(["auto", "on_demand", "off"]);
export const ItemSourceKindSchema = z.enum(["own", "licensed", "generated"]);
export const ItemTypeSchema = z.enum(["mcq", "short", "open", "card"]);
export const ItemStatusSchema = z.enum(["draft", "reviewed", "retired"]);

export const SkillTopicSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9_]+(\.[a-z0-9_]+)*$/, "dotted topic id"),
  title: z.string().min(1),
  weight: share,
  subskills: z
    .array(z.string().regex(/^[a-z0-9_]+$/, "snake_case subskill"))
    .min(1)
    .refine((s) => new Set(s).size === s.length, "subskills must be unique"),
  source_tag: z.string().optional(),
});

export const ArchetypeSchema = z.strictObject({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]*$/, "archetype id"),
  topic: z.string().min(1),
  pattern: z.string().min(3).max(240),
  exam_weight: share,
  subskill: z.string().optional(),
});

export const SkillReferenceSchema = z.strictObject({
  file: packPath("references"),
  title: z.string().min(1),
  sections: z.array(z.string().min(1)),
});

export const SkillManifestSchema = z
  .strictObject({
    id,
    version: semver,
    status: z.enum(["draft", "published", "retired"]),
    title: z.string().min(1),
    description: z.string().min(10).max(400),
    subject: z.enum(["science", "maths", "english", "chinese"]),
    level: z.enum(["P3", "P6", "Sec 2"]),
    syllabus: z.string().min(1),
    language: z.string().min(2),
    agents: z.strictObject({
      tutor: AgentSkillModeSchema,
      vibe: AgentSkillModeSchema,
      parent: AgentSkillModeSchema,
      curator: AgentSkillModeSchema,
    }),
    topics: z.array(SkillTopicSchema).min(1),
    archetypes: z.array(ArchetypeSchema),
    references: z.array(SkillReferenceSchema),
    tools: z.array(z.enum(["read_reference", "find_items", "check_answer"])).min(1),
    sources: z.array(z.strictObject({ kind: ItemSourceKindSchema, note: z.string().min(1) })).min(1),
    licence: z.string().min(1),
    attributions: z.array(z.string().min(1)).optional(),
    excluded: z.array(z.string().min(1)),
    legacy_scripts: z.strictObject({
      note: z.literal("kept privately; never executed"),
      files: z.array(z.string().min(1)),
    }),
  })
  .superRefine((m, ctx) => {
    const topicIds = new Set<string>();
    for (const t of m.topics) {
      if (topicIds.has(t.id)) ctx.addIssue({ code: "custom", message: `duplicate topic ${t.id}` });
      topicIds.add(t.id);
    }
    const total = m.topics.reduce((s, t) => s + t.weight, 0);
    if (total > 1.0001) ctx.addIssue({ code: "custom", message: `topic weights sum to ${total.toFixed(3)} (> 1)` });
    const archetypeIds = new Set<string>();
    for (const a of m.archetypes) {
      if (archetypeIds.has(a.id)) ctx.addIssue({ code: "custom", message: `duplicate archetype ${a.id}` });
      archetypeIds.add(a.id);
      const topic = m.topics.find((t) => t.id === a.topic);
      if (!topic) ctx.addIssue({ code: "custom", message: `archetype ${a.id}: unknown topic ${a.topic}` });
      else if (a.subskill && !topic.subskills.includes(a.subskill))
        ctx.addIssue({ code: "custom", message: `archetype ${a.id}: unknown subskill ${a.subskill}` });
    }
  });

const units = z.number().positive().max(120);
const ModelPanelSchema = z.strictObject({
  title: z.string().min(1).max(40).optional(),
  bars: z
    .array(
      z.strictObject({
        label: z.string().min(1).max(24),
        parts: z.array(z.strictObject({ w: units, text: z.string().max(24).optional(), tone: z.enum(["unit", "extra", "ghost"]).optional() })).min(1).max(24),
      }),
    )
    .min(1)
    .max(5),
  marks: z.array(z.strictObject({ bar: z.number().int().nonnegative(), from: z.number().nonnegative(), to: units, text: z.string().min(1).max(40), side: z.enum(["above", "below"]).optional() })).max(6).optional(),
  total: z.strictObject({ text: z.string().min(1).max(24), from: z.number().int().nonnegative().optional(), to: z.number().int().nonnegative().optional() }).optional(),
});
export const WorkedModelSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("bars"), panels: z.array(ModelPanelSchema).min(1).max(2) }),
  z.strictObject({
    kind: z.literal("timeline"),
    ticks: z.array(z.strictObject({ at: z.number().nonnegative().max(1440), label: z.string().min(1).max(12) })).min(2).max(6),
    jumps: z.array(z.strictObject({ from: z.number().nonnegative(), to: z.number().positive(), text: z.string().min(1).max(20) })).min(1).max(5),
  }),
]);

export const SkillItemSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase item id"),
    skill: id,
    topic: z.string().min(1),
    subskill: z.string().min(1),
    archetype: z.string().min(1).optional(),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    marks: z.number().positive().max(10),
    type: ItemTypeSchema,
    stem: z.string().min(1),
    passage: z.string().min(1).optional(),
    options: z.array(z.string().min(1)).min(2).max(6).optional(),
    answer: z.union([z.number().int(), z.string().min(1)]),
    accept: z.array(z.string().min(1)).optional(),
    tolerance: z.number().nonnegative().optional(),
    unit: z.string().min(1).optional(),
    working: z.array(z.string().min(1)).min(1).optional(),
    distractors: z.record(z.string().regex(/^[1-6]$/), z.string().min(1)).optional(),
    hints: z.array(z.string().min(1)).max(3).optional(),
    keywords: z.array(z.string().min(1)).optional(),
    marking: z.array(z.string().min(1)).optional(),
    figure: packPath("figures").optional(),
    figure_spec: z.unknown().optional(),
    model: WorkedModelSchema.optional(),
    card: z
      .strictObject({
        pinyin: z.string().optional(),
        meaning: z.string().optional(),
        lesson: z.number().int().positive().optional(),
      })
      .optional(),
    source: z.strictObject({ kind: ItemSourceKindSchema, ref: z.string().min(1) }),
    status: ItemStatusSchema,
    reviewed_by: z.string().min(1).optional(),
    version_added: semver,
    demo: z.boolean().optional(),
    notes: z.string().min(1).optional(),
  })
  .superRefine((item, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message: `${item.id}: ${message}` });
    if (item.type === "mcq") {
      if (!item.options) issue("mcq needs options");
      else if (typeof item.answer !== "number" || item.answer < 1 || item.answer > item.options.length)
        issue("mcq answer must be a 1-based option number");
      for (const key of Object.keys(item.distractors ?? {})) {
        if (key === String(item.answer)) issue(`distractor note on the correct option ${key}`);
        if (item.options && Number(key) > item.options.length) issue(`distractor for missing option ${key}`);
      }
    } else {
      if (typeof item.answer !== "string") issue(`${item.type} answer must be text`);
      if (item.options && item.type !== "short") issue(`${item.type} items take no options`);
    }
    if (item.status === "reviewed" && item.figure_spec !== undefined && !item.figure)
      issue("an item whose figure is not rendered cannot be reviewed");
    if (item.model?.kind === "bars")
      for (const panel of item.model.panels)
        for (const m of panel.marks ?? []) if (m.bar >= panel.bars.length || m.from >= m.to) issue(`model mark "${m.text}" points outside its bars`);
    if (item.hints?.some((h) => typeof item.answer === "string" && item.answer.length > 3 && h.includes(item.answer)))
      issue("a hint gives the answer away");
  });

export const SkillItemListSchema = z.array(SkillItemSchema);

export type SkillManifestInput = z.input<typeof SkillManifestSchema>;

// Compile-time checks that the schemas produce the lib/types.ts shapes.
type Assignable<T, U extends T> = U;
export type _ManifestMatches = Assignable<SkillManifest, z.output<typeof SkillManifestSchema>>;
export type _ItemMatches = Assignable<SkillItem, z.output<typeof SkillItemSchema>>;
export type _TopicMatches = Assignable<SkillTopic, z.output<typeof SkillTopicSchema>>;
export type _ArchetypeMatches = Assignable<Archetype, z.output<typeof ArchetypeSchema>>;
