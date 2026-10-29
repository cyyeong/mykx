// Per-skill mapping for scripts/import-skill.ts: which source files become which
// pack files, the scrub edits each needs, topics with exam weights, archetypes
// derived from the private school-paper banks (patterns and statistics only),
// and how each source question format maps to the unified item schema.
import { basename } from "node:path";
import type {
  AgentSkillMode,
  Archetype,
  Difficulty,
  ItemType,
  SkillAgent,
  SkillItem,
  SkillLevel,
  SkillReference,
  SkillSource,
  SkillSubject,
  SkillTopic,
} from "../lib/types.ts";
import {
  type Edit,
  type NameScrub,
  type Raw,
  classifyOpen,
  clampDifficulty,
  generalisePattern,
  itemId,
  letterKeysToNumbers,
  mdTable,
  optionNumber,
  sectionBody,
} from "./import-skill-lib.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Source {
  root: string;
  read(path: string): string;
  json(path: string): Raw;
  exists(path: string): boolean;
  /** File names in a source folder. */
  list(dir: string): string[];
  /** Script files in the source (names only; never run). */
  scripts(): string[];
}

export interface RefSpec {
  from: string;
  /** File name under references/. */
  to: string;
  title: string;
  /** Headings (prefix match) whose sections are removed. */
  drop?: string[];
  /** Headings whose bodies are replaced. */
  replace?: Record<string, string>;
  /** Exact edits on the raw source text, applied first; each must match. */
  edits?: Edit[];
  /** Edits after the scrub. */
  post?: Edit[];
  dropColumns?: string[];
  /** Rewrite he/him/his (or she/her) as "the learner"/"their": coaching text about one child. */
  pronoun?: "he" | "she";
}

export interface ItemSetSpec {
  from: string;
  /** Slug for ids and the items/<set>.json file name. */
  set: string;
}

export interface ItemDraft {
  id: string;
  qid: string;
  sourceFile: string;
  topic: string;
  subskill: string;
  archetype?: string;
  difficulty: Difficulty;
  marks: number;
  type: ItemType;
  stem: string;
  passage?: string;
  options?: string[];
  answer: number | string;
  accept?: string[];
  tolerance?: number;
  unit?: string;
  working?: (string | undefined | false)[] | string[];
  distractors?: Record<string, string>;
  hints?: string[];
  keywords?: string[];
  marking?: string[];
  /** Source path of a rendered figure to copy into figures/. */
  figureSrc?: string;
  figure_spec?: unknown;
  card?: SkillItem["card"];
  forceDraft?: boolean;
  notes?: string;
}

export interface PackConfig {
  id: string;
  sourceName: string;
  prefix: string;
  title: string;
  description: string;
  subject: SkillSubject;
  level: SkillLevel;
  syllabus: string;
  language: string;
  agents: Record<SkillAgent, AgentSkillMode>;
  licence: string;
  attributions?: string[];
  sources: SkillSource[];
  pronoun: "he" | "she";
  names: NameScrub;
  topics: SkillTopic[];
  /** Source topic tag → topic id. */
  tagMap: Record<string, string>;
  subskillMap?: Record<string, string>;
  archetypes(src: Source): Archetype[];
  /** Source item archetype slug → manifest archetype id. */
  archetypeAlias?: Record<string, string>;
  references: RefSpec[];
  skillMd(src: Source, refs: SkillReference[]): string;
  itemSets: ItemSetSpec[];
  mapItems(set: ItemSetSpec, src: Source): ItemDraft[];
  post?: Edit[];
  excluded: string[];
}

// ─── Shared pieces ──────────────────────────────────────────────────────────

const AGENTS_DEFAULT: Record<SkillAgent, AgentSkillMode> = { tutor: "auto", vibe: "on_demand", parent: "on_demand", curator: "auto" };

const SOURCE_OWN: SkillSource = {
  kind: "own",
  note: "Method, references and practice sets written with the founder's own tutor skill (each set was worked and checked before use), scrubbed of learner details by scripts/import-skill.ts.",
};
const SOURCE_DERIVED: SkillSource = {
  kind: "own",
  note: "Topic weights and archetypes are statistics and patterns derived from school papers kept as private reference; no question text, school names or paper codes are included.",
};
const SOURCE_DEMO: SkillSource = {
  kind: "generated",
  note: "Demo items (items/demo.json) drafted fresh by Claude Code following this pack's question-generation rules; pending founder review.",
};

/** Learner names in story items are replaced with fictional ones (the importer has already swapped the real names for the stand-ins in lib/skills/private-names.ts). */
const NAMES: NameScrub = {
  names: ["Jordan", "Abby", "Leonard"],
  // Brand names are not used in item text either (AGENTS.md hard rule 2).
  itemNames: { Jordan: "Marcus", Abby: "Mei", Leonard: "Ryan", Aiden: "Ethan", Lego: "toy brick" },
};


function frontmatter(id: string, description: string): string {
  return `---\nname: ${id}\ndescription: ${JSON.stringify(description)}\n---\n`;
}

/** The part of every SKILL.md that says how the pack runs inside myKx. */
function inMykx(genRef = "references/question-generation.md"): string {
  return `## Running inside myKx

- **Progress is in the learner record, not in this pack.** Mastery by subskill, the review schedule and rewards are computed by tested app code. Read them with \`learner_summary()\`; never estimate, change or promise marks. \`check_answer(item_id, answer)\` gives a correct/incorrect signal so you can respond; the app records the attempt.
- **What Kix knows about this learner** (interests, how they ask for help, language slips, upcoming exams, memorable moments) is in Kix's Notebook: read a page with \`notebook_read(page)\`. Nothing about any particular child belongs in this pack.
- **References** are read one section at a time: \`read_reference("<file>#<section>")\`, using a file and section listed below or in \`skill.json\`.
- **Practice items** come from \`find_items(topic, subskill?, difficulty?, n)\`: reviewed items only, without their answers. Use the topic and subskill tags in \`skill.json\` exactly.
- **New questions** follow \`${genRef}\` and the archetypes in \`skill.json\`; they are drafts until an admin reviews them, and they never count toward mastery before that.
- **Pictures:** use an item's figure or a trusted diagram tool. Never ASCII art, never "imagine a diagram".
- **Never run scripts.** The source skill's paper builders, trackers and diagram drawers are kept privately and are never executed.`;
}

function referenceTable(refs: SkillReference[], when: Record<string, string>): string {
  const rows = refs.map((r) => `| \`${r.file}\` | ${when[r.file.replace("references/", "")] ?? r.title} |`);
  return `## References\n\n| File | Read it when |\n|---|---|\n${rows.join("\n")}`;
}

function stemText(parts: Raw, specs: unknown[]): string {
  const list = Array.isArray(parts) ? parts : parts == null ? [] : [parts];
  const out: string[] = [];
  for (const p of list) {
    if (typeof p === "string") out.push(p);
    else if (p?.table) out.push(mdTable(p.table));
    else if (p?.figure) specs.push(p.figure);
    else if (p?.figures) specs.push(p);
  }
  return out.join("\n\n");
}

function joinAnswer(a: Raw): string {
  if (Array.isArray(a)) return a.map(String).join(" ");
  return String(a ?? "").trim();
}

function cerWorking(cer: Raw): string[] {
  if (!cer) return [];
  return [cer.claim && `Claim: ${cer.claim}`, cer.evidence && `Evidence: ${cer.evidence}`, cer.reasoning && `Reasoning: ${cer.reasoning}`].filter(Boolean);
}

function tableOptions(t: { header?: string[]; rows: string[][] }): string[] {
  const header = t.header ?? [];
  const skipFirst = header[0] === "" || t.rows.every((r) => /^\(?\d\)?$/.test(String(r[0]).trim()));
  return t.rows.map((r) =>
    r
      .map((c, i) => (skipFirst && i === 0 ? null : header[i] ? `${header[i]}: ${c}` : String(c)))
      .filter((c) => c !== null)
      .join(" · "),
  );
}

// ─── Format: P3 Science papers (booklet_a / booklet_b) ──────────────────────

function mapBooklets(set: ItemSetSpec, src: Source, prefix: string): ItemDraft[] {
  const d = src.json(set.from);
  const file = basename(set.from);
  const out: ItemDraft[] = [];
  for (const q of d.booklet_a?.questions ?? []) {
    const specs: unknown[] = [];
    let stem = stemText(q.stem, specs);
    if (q.statements) stem += "\n\n" + q.statements.join("\n");
    let options: string[];
    let optionSpecs: unknown;
    if (Array.isArray(q.options)) options = q.options.map(String);
    else if (q.options?.table) options = tableOptions(q.options.table);
    else {
      options = q.options.figures.map((_: unknown, i: number) => `Diagram ${i + 1}`);
      optionSpecs = q.options.figures;
    }
    out.push({
      id: itemId(prefix, set.set, q.id),
      qid: q.id,
      sourceFile: file,
      topic: q.topic,
      subskill: q.subskill,
      archetype: q.archetype,
      difficulty: clampDifficulty(q.difficulty, 2),
      marks: Number(q.marks ?? 2),
      type: "mcq",
      stem,
      options,
      answer: Number(q.answer),
      working: [q.why, q.trap && `Watch out: ${q.trap}`],
      distractors: q.distractors,
      figure_spec: specs.length || optionSpecs ? { stem: specs.length ? specs : undefined, options: optionSpecs } : undefined,
    });
  }
  for (const q of d.booklet_b?.questions ?? []) {
    const qSpecs: unknown[] = [];
    const base = stemText(q.stem, qSpecs);
    let context = base;
    for (const p of q.parts) {
      const specs = [...qSpecs];
      if (p.pre) context += "\n\n" + stemText(p.pre, specs);
      let stem = `${context}\n\n(${p.label}) ${p.text}`;
      if (p.table) stem += "\n\n" + mdTable(p.table);
      if (p.fill) stem += `\n\n${p.fill}`;
      if (p.prompts) stem += "\n\n" + p.prompts.join("\n");
      if (p.figure) specs.push(p.figure);
      const answer = joinAnswer(p.answer);
      const marks = Number(p.marks ?? 1);
      let type: ItemType = classifyOpen(answer, marks, Boolean(p.cer) || Boolean(p.table) || Boolean(p.box));
      let options: string[] | undefined;
      let answerOut: number | string = answer;
      if (p.circle) {
        const n = optionNumber(answer.replace(/[*.]/g, "").trim(), p.circle);
        if (n) {
          type = "mcq";
          options = p.circle;
          answerOut = n;
        }
      }
      out.push({
        id: itemId(prefix, set.set, `${q.id}${p.label}`),
        qid: `${q.id}(${p.label})`,
        sourceFile: file,
        topic: q.topic,
        subskill: p.subskill ?? q.subskill,
        difficulty: clampDifficulty(p.difficulty ?? q.difficulty, marks >= 2 ? 3 : 2),
        marks,
        type,
        stem,
        options,
        answer: answerOut,
        accept: p.accept ? [String(p.accept)] : undefined,
        working: [...cerWorking(p.cer), p.common_error && `Common error: ${p.common_error}`],
        keywords: p.keywords,
        marking: p.reject ? [`Reject: ${p.reject}`] : undefined,
        figure_spec: specs.length ? { stem: specs } : undefined,
      });
    }
  }
  return out;
}

// ─── Format: worksheet sections (P3 Maths sets, Sec 2 set) ───────────────────

function mapSections(set: ItemSetSpec, src: Source, prefix: string): ItemDraft[] {
  const d = src.json(set.from);
  const file = basename(set.from);
  const out: ItemDraft[] = [];
  const fig = (p: string) => p.replace(/^figs\//, "assets/figs/");
  const figureOf = (q: Raw) =>
    typeof q.figure === "string" ? fig(q.figure) : Array.isArray(q.figures) ? q.figures.map(fig).join("+") : undefined;
  for (const section of d.sections) {
    for (const q of section.questions) {
      const base = {
        sourceFile: file,
        topic: q.topic,
        subskill: q.subskill,
        archetype: q.archetype,
        figureSrc: figureOf(q),
      };
      const stem = [q.stem, q.figure_caption ? `(${q.figure_caption})` : ""].filter(Boolean).join(" ");
      if (q.parts) {
        q.parts.forEach((p: Raw, i: number) => {
          const label = p.label ?? String.fromCharCode(97 + i);
          const answer = joinAnswer(p.answer);
          const marks = Number(p.marks ?? 1);
          const drawing = p.no_answer_line || /\bdraw/i.test(p.text);
          out.push({
            ...base,
            id: itemId(prefix, set.set, `${q.id}${label}`),
            qid: `${q.id}(${label})`,
            subskill: p.subskill ?? q.subskill,
            difficulty: clampDifficulty(p.difficulty ?? q.difficulty, 3),
            marks,
            type: drawing ? "open" : classifyOpen(answer, Array.isArray(p.answer) && p.answer.length > 1 ? 2 : 1, false),
            stem: `${stem}\n\n(${label}) ${p.text}`,
            answer,
            unit: p.unit || undefined,
            working: [...(Array.isArray(p.working) ? p.working : []), p.common_error && `Common error: ${p.common_error}`],
            keywords: p.keywords,
            marking: p.marking ? [String(p.marking)] : undefined,
          });
        });
        continue;
      }
      const isMcq = Array.isArray(q.options) && q.options.length >= 2 && (q.type ?? section.type) !== "short";
      const answer = isMcq ? optionNumber(q.answer, q.options) : null;
      if (isMcq && answer === null) throw new Error(`${file} ${q.id}: cannot read MCQ answer ${q.answer}`);
      const answerText = joinAnswer(q.answer);
      out.push({
        ...base,
        id: itemId(prefix, set.set, q.id),
        qid: q.id,
        difficulty: clampDifficulty(q.difficulty, 2),
        marks: Number(q.marks ?? 1),
        type: isMcq ? "mcq" : q.no_answer_line ? "open" : classifyOpen(answerText, 1, false),
        stem,
        options: isMcq ? q.options.map(String) : undefined,
        answer: isMcq ? (answer as number) : answerText,
        unit: q.unit || undefined,
        working: [
          ...(Array.isArray(q.working) ? q.working : q.why ? [q.why] : []),
          q.trap && `Watch out: ${q.trap}`,
          q.common_error && `Common error: ${q.common_error}`,
        ],
        distractors: isMcq ? letterKeysToNumbers(q.distractors) : undefined,
        marking: q.marking ? [String(q.marking)] : undefined,
      });
    }
  }
  return out;
}

// ─── Archetypes from a "### Topic" + "- **Name** … (codes)" bank ───────────

const CODE_TOKEN = /\b(?:NH|AT|TN|AJ|AP)\d{1,2}[a-z]?(?:[–-]\d{1,2})?\b/g;

function boldBankArchetypes(
  text: string,
  topics: SkillTopic[],
  headingToTopic: Record<string, { topic: string; code: string }>,
  glosses: Record<string, string> = {},
): Archetype[] {
  const out: Archetype[] = [];
  const byTopic: Record<string, { name: string; codes: number }[]> = {};
  let current: { topic: string; code: string } | null = null;
  for (const line of text.split("\n")) {
    const h = /^###\s+(.*)$/.exec(line);
    if (h) {
      current = headingToTopic[h[1].trim()] ?? null;
      if (!current) throw new Error(`archetype bank: unmapped heading "${h[1]}"`);
      continue;
    }
    if (!current || !/^\s*-\s+\*\*/.test(line)) continue;
    // Each bold name owns the codes up to the next bold name.
    for (const m of line.matchAll(/\*\*([^*]+)\*\*([^*]*)/g)) {
      const name = m[1].trim();
      const codes = (m[2].match(CODE_TOKEN) ?? []).length || 1;
      (byTopic[current.topic + "|" + current.code] ??= []).push({ name: name[0].toUpperCase() + name.slice(1), codes });
    }
  }
  for (const [key, list] of Object.entries(byTopic)) {
    const [topicId, code] = key.split("|");
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) throw new Error(`archetype bank: unknown topic ${topicId}`);
    const total = list.reduce((s, a) => s + a.codes, 0);
    list.forEach((a, i) => {
      const pattern = (glosses[a.name] ?? a.name).replace(/\s*\/\s*/g, " / ");
      out.push({ id: `${code}-${i + 1}`, topic: topicId, pattern, exam_weight: round(topic.weight * (a.codes / total)) });
    });
  }
  return out;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

// ─── P3 Science ─────────────────────────────────────────────────────────────

const P3SCI_TOPICS: SkillTopic[] = [
  { id: "diversity.living", title: "Diversity of living and non-living things", weight: 0.09, source_tag: "living_nonliving", subskills: ["characteristics", "needs", "lnl_identify", "needs_experiment"] },
  { id: "diversity.classification", title: "Classification of living things", weight: 0.2, source_tag: "classification", subskills: ["plant_fungi_groups", "fungi_bacteria", "animal_groups", "insect_or_not", "chart_heading"] },
  { id: "diversity.materials", title: "Diversity of materials", weight: 0.21, source_tag: "materials", subskills: ["material_types", "strength", "flexibility", "waterproof", "absorbency", "transparency", "float_sink", "property_to_use", "fair_test"] },
  { id: "cycles.plant", title: "Life cycle of plants", weight: 0.07, source_tag: "lifecycle_plants", subskills: ["plant_stages", "germination", "plant_cycle_reasoning"] },
  { id: "cycles.animal", title: "Life cycle of animals", weight: 0.16, source_tag: "lifecycle_animals", subskills: ["three_stage", "four_stage", "cycle_diagram", "stage_features", "duration_graph", "mosquito_control"] },
  { id: "interactions.magnets", title: "Properties of magnets", weight: 0.19, source_tag: "magnet_properties", subskills: ["poles", "attract_repel", "pole_puzzle", "magnetic_materials", "magnet_vs_magnetic", "north_south", "strength_test"] },
  { id: "interactions.making_magnets", title: "Making and using magnets", weight: 0.07, source_tag: "magnet_making_using", subskills: ["stroke_method", "electrical_method", "makeable_materials", "uses"] },
];

const tagMapOf = (topics: SkillTopic[]) => Object.fromEntries(topics.filter((t) => t.source_tag).map((t) => [t.source_tag as string, t.id]));

const P3SCI: PackConfig = {
  id: "p3-science",
  sourceName: "p3-science-tutor",
  prefix: "p3sci",
  title: "P3 Science",
  description:
    "Primary 3 Science (Singapore MOE 2023 syllabus): living things, classification, materials, life cycles of plants and animals, magnets. Adaptive missions, CER answering, exam-style practice.",
  subject: "science",
  level: "P3",
  syllabus: "MOE 2023 Primary Science (P3 strand: Diversity, Cycles, Interactions)",
  language: "en",
  agents: AGENTS_DEFAULT,
  licence: "Content CC BY-NC 4.0 (myKx); items original.",
  sources: [SOURCE_OWN, SOURCE_DERIVED, SOURCE_DEMO],
  pronoun: "he",
  names: NAMES,
  topics: P3SCI_TOPICS,
  tagMap: tagMapOf(P3SCI_TOPICS),
  archetypes: (src) =>
    boldBankArchetypes(
      sectionBody(src.read("references/past-papers-verified.md"), "C. Archetype bank", "p3-science archetypes"),
      P3SCI_TOPICS,
      {
        "Living & non-living": { topic: "diversity.living", code: "LNL" },
        Classification: { topic: "diversity.classification", code: "CLS" },
        Materials: { topic: "diversity.materials", code: "MAT" },
        "Life cycle of plants": { topic: "cycles.plant", code: "PLC" },
        "Life cycle of animals": { topic: "cycles.animal", code: "ALC" },
        "Properties of magnets": { topic: "interactions.magnets", code: "MAG" },
        "Making & using magnets": { topic: "interactions.making_magnets", code: "MMU" },
      },
      {
        "Characteristic from scenario": "Name the characteristic of living things that a scenario shows",
        "Living-thing evidence": "Living-thing evidence from observations of two set-ups",
        "Fungi conditions": "Conditions for mould (fungi) to grow: rank or choose set-ups",
        Absorbency: "Absorbency test: rank materials by water soaked up",
        Strength: "Strength test: load held before breaking",
        Flexibility: "Flexibility test: read what the bending distance means",
        "Which material is it": "Which material is it, from how it behaves",
        "Statements about stages": "True statements about the stages of a plant",
        "Harmful stage": "Which stage is harmful to crops (the feeding larva)",
        Moulting: "Moulting: which stage sheds its skin",
        "Duration graph": "Duration graph: time after hatching, stage on day N, longest stage",
        "Feeding table → which stage": "Feeding table: which stage feeds and which does not",
        "Magnetic or not": "Magnetic or not: everyday objects and materials",
        Electromagnet: "Electromagnet: what makes it stronger, predict from a table, which set-ups to compare",
        Uses: "Uses of magnets in everyday objects",
      },
    ),
  archetypeAlias: {
    "after-hatching-sum": "ALC-4",
    "choose-two-setups-fair-test": "PLC-2",
    "count-body-parts-and-legs": "CLS-5",
    "float-sink-choose-use": "MAT-3",
    "floating-rings": "MAG-4",
    "flowchart-place-animals": "CLS-3",
    "light-sensor-graph": "MAT-2",
    "pick-correct-cycle-arrows": "ALC-1",
    "strongest-stroke-magnet": "MMU-1",
    "tick-table-identify-group": "CLS-1",
    "tick-table-most-suitable": "MAT-1",
  },
  references: [
    {
      from: "references/syllabus-map.md",
      to: "syllabus-map.md",
      title: "P3 Science syllabus map",
      edits: [
        [/Jordan's end-of-year exam covers \*\*exactly these seven sub-topics and nothing else\*\*\.\nEvery lesson, question and paper must sit inside them\. Teaching outside the scope\nspends his limited focus on marks that do not exist\./, "The P3 end-of-year exam covers **exactly these seven sub-topics and nothing else**.\nEvery lesson, question and paper must sit inside them. Teaching outside the scope\nspends a learner's limited attention on marks that do not exist."],
        [/\\\*Tallied from five verified 2025 P3 EOY papers \(360 marks\)\./, "\\*Tallied from five recent school end-of-year papers (360 marks), kept as private reference."],
        [/Use these tags exactly — `scripts\/tracker\.py tags` prints them\. Untagged or\nmisspelt tags make the statistics useless\./, "Use these tags exactly; they are the `subskills` in `skill.json`. Untagged or\nmisspelt tags make the statistics useless."],
        [/If Jordan asks out of curiosity/, "If the learner asks out of curiosity"],
        [/ — only raise them if Jordan's notes do\./, " — only raise them if the learner's school notes do."],
      ],
      replace: {
        "Exam format": `There is no national exam at P3; each school sets its own end-of-year paper. The common formats:

| Format | Booklet A (MCQ, 2 marks each) | Booklet B (open-ended) | Total | Time |
|---|---|---|---|---|
| Most common | 24 Q = 48 | 9–10 Q = 32 | 80 | 1 h 30 |
| Variant | 22 Q = 44 | 9 Q = 36 | 80 | 1 h 30 |
| Shorter | 18 Q = 36 | 8 Q = 24 | 60 | 1 h 10 – 1 h 15 |

- Default to the most common format (24 MCQ + Booklet B = 80 marks, 1 h 30) unless the learner's profile says otherwise.
- MCQs have four options **(1)–(4)** and are shaded on an Optical Answer Sheet.
- Open-ended parts are worth 1–2 marks each, shown in brackets **[ ]**.
- Typical OEQ answers expected: a one-line fact, a fill-in table, a circled word, a drawn life cycle, or a 2-mark "Do you agree? Explain" in CER form.`,
      },
    },
    { from: "references/content-diversity.md", to: "content-diversity.md", title: "Diversity: living things, classification, materials" },
    { from: "references/content-cycles.md", to: "content-cycles.md", title: "Cycles: life cycles of plants and animals" },
    { from: "references/content-magnets.md", to: "content-magnets.md", title: "Interactions: magnets" },
    {
      from: "references/answering-cer.md",
      to: "answering-cer.md",
      title: "Answering technique: CER, templates, MCQ routine, keywords",
      edits: [
        [/ — the mark scheme prints a ready-made log line\./, "."],
        [/Hand signal for Jordan:/, "Hand signal:"],
      ],
    },
    {
      from: "references/coaching-playbook.md",
      to: "coaching-playbook.md",
      title: "Coaching playbook: keeping a young learner switched on",
      pronoun: "he",
      edits: [
        // Patterns that would quote a child's traits match by shape instead of spelling them out.
        [/^\w+ is about nine and [^\n]*\n[^\n]*not a flaw\./m, "Children around nine drift unless the material is interesting and fun. That\nis normal for the age, not a flaw."],
        [/Theme skins: ask Jordan at the first session what he loves \(a game, animals,\nspace, football, dinosaurs\)\./, "Theme skins: use what the learner loves (a game, animals, space, football,\ndinosaurs; Kix's Notebook has it)."],
        [/\| \*\*Teach the Alien\*\* \| Jordan explains/, "| **Teach the Alien** | The learner explains"],
        [/3 quick recall questions from \*\*due\*\* sub-skills \(tracker\/card\)/, "3 quick recall questions from **due** sub-skills (from `learner_summary()`)"],
        [/Stars earned, level progress, badge progress, update the progress card/, "Stars earned and level progress (the app keeps the record)"],
        [/Ask the parent for the exam date at the first session\. If it is within 14 days,\nswitch to crunch mode \(`tracker\.py plan` prints a dated calendar\):/, "The exam date is in the learner's profile. If it is within 14 days, switch to\ncrunch mode:"],
        [/- Start-of-skill questions for the parent \(ask once, then store in the card notes\):\n  exam date, school \(paper length\), recent test marks or weak topics the teacher\n  mentioned, Jordan's interests, how long he can usually focus\./, "- The parent sets up the learner's profile once: exam date, paper length, weak\n  topics the teacher mentioned, interests, how long a session usually lasts."],
        [/- Paper missions: parent prints the PDF, Jordan does it with a timer, parent marks\n  with the mark scheme and pastes the filled log line back into chat\./, "- Paper missions: the parent prints a practice set, the learner does it with a\n  timer, and the parent enters the marks."],
        [/ Then the progress card\./, ""],
        [/the tracker's\n  boxes schedule this\./, "the app's review\n  schedule does this."],
      ],
    },
    {
      from: "references/question-generation.md",
      to: "question-generation.md",
      title: "Generating questions and papers",
      drop: ["1. Pipeline", "4. JSON spec", "5. Figure catalogue", "6. A single figure"],
      edits: [[/ \(\w+ default\)/, ""], [/\| Ai Tong \/ Tao Nan format \|/, "| shorter school format |"], [/`assets\/diagnostic_01\.json`/g, "the diagnostic set"], [/`assets\/eoy_mock_80\.json`/g, "the 80-mark mock"]],
      post: [[/- \[ \] Tags are valid; every Booklet B part/, "- [ ] Tags are valid (`skill.json`); every Booklet B part"]],
    },
    {
      from: "assets/exam_eve_sheet.md",
      to: "exam-eve-sheet.md",
      title: "Exam-eve keyword sheet",
      edits: [[/- You've trained for this, Agent Jordan\. Go get those stars! ★/, "- You've trained for this. Go get those stars! ★"]],
    },
  ],
  skillMd: (src, refs) => {
    const s = src.read("SKILL.md");
    const sec = (h: string) => sectionBody(s, h, "p3-science SKILL.md");
    return [
      frontmatter("p3-science", "Primary 3 Science tutor (Singapore MOE 2023 syllabus, school end-of-year exam): living and non-living things, classification, materials, life cycles of plants and animals, magnets. Load for any P3 science question, practice, CER answer or revision plan."),
      "# P3 Science",
      `Adaptive, game-like coaching for Primary 3 Science in Singapore (MOE 2023 syllabus), building towards the school end-of-year exam. Two things shape everything below:

1. **Scope is fixed: seven sub-topics only.** Diversity: *living and non-living things · classification of living things · diversity of materials*. Cycles: *life cycle of plants · life cycle of animals*. Interactions: *properties of magnets · making and using magnets*. Anything else (digestive system, light and shadows, heat, matter, plant transport) is not in the P3 exam: answer curiosity in one sentence and move on.
2. **Attention is the scarce resource.** Short missions, one question at a time, choices, games, real objects, visible progress. A boring session is a failed session, however correct it was.

Read \`references/syllabus-map.md\` before writing or choosing any question: it has the subskill tags, the official learning outcomes, the depth limits and the exam format.`,
      "## Session shape\n\n" +
        "1. **Warm restart (2–3 min):** three quick recall questions on due subskills (from `learner_summary()`), no notes. Whatever breaks becomes the first mission.\n" +
        "2. **Name the finish line:** \"Today: 2 missions + boss round, 20 minutes ⭐\".\n" +
        "3. **Missions** follow the adaptive loop below; brain break every 8–10 minutes.\n" +
        "4. **Boss round:** 3 mixed questions, the last one an easy win.\n" +
        "5. **Close:** stars and progress come from the app; give the parent three lines: practised · improved · next.\n\n" +
        "**Level Check (first session):** 14 quick items, two per sub-topic (one R1 recall, one R2 apply), in a game frame (\"7 worlds, 2 gates each\"). Mix topics; never two from the same world in a row.",
      "## The adaptive loop\n\n" + sec("The adaptive loop"),
      "## Teaching rules\n\n" + sec("Teaching rules"),
      "## Answering technique: CER\n\n" + sec("Answering technique"),
      "## Marking\n\n" + sec("Marking his work"),
      "## Exam countdown\n\n" + sec("Exam countdown"),
      inMykx(),
      referenceTable(refs, {
        "syllabus-map.md": "before choosing or writing any question: tags, outcomes, depth limits, exam format",
        "content-diversity.md": "teaching living things, classification, materials",
        "content-cycles.md": "teaching plant and animal life cycles",
        "content-magnets.md": "teaching magnets",
        "answering-cer.md": "any explain / agree / most-suitable question; marking; MCQ technique",
        "coaching-playbook.md": "session design, games, feedback, focus rescue, countdown, working with the parent",
        "question-generation.md": "writing new questions: synthesis recipe, quality checklist, paper blueprints",
        "exam-eve-sheet.md": "the night before the exam: one-page keyword sheet",
      }),
      "## Never\n\n" + sec("Never"),
    ].join("\n\n");
  },
  post: [
    [/pick sub-skill \(tracker priority\)/, "pick subskill (priority from learner_summary)"],
    [/inflated marks break the\ntracker/, "inflated marks break the\nlearner record"],
    [/\*\*Log immediately\*\* \(Python\):\n?/, "**Log immediately:** the app records every attempt with its subskill and error type.\n"],
    [/Use exact tags\. Without Python, update the card lines by hand\n\(scored\/marks, box \+1 on ≥ 75 %, box → 0 on a miss\)\./, "Use the exact tags in `skill.json`."],
    [/If the exam is ≤ 14 days away, prints a dated plan:/, "If the exam is ≤ 14 days away (see the learner's profile), switch to a dated plan:"],
    [/- Skip logging or the progress card — an unlogged session didn't happen\.\n/, ""],
    [/- Label or diagnose the learner; "[^"]+" is a design input, not a judgement\./, "- Label or diagnose a learner. Short attention at this age is a design input, not a judgement."],
  ],
  itemSets: [
    { from: "assets/diagnostic_01.json", set: "diagnostic-01" },
    { from: "assets/mission_magnets_01.json", set: "mission-magnets-01" },
    { from: "assets/eoy_mock_80.json", set: "eoy-mock-80" },
  ],
  mapItems: (set, src) => mapBooklets(set, src, "p3sci"),
  excluded: ["references/past-papers-verified.md", "PORTABLE.md"],
};

// ─── P3 Maths ───────────────────────────────────────────────────────────────

const P3MATH_TOPICS: SkillTopic[] = [
  { id: "number.whole_numbers", title: "Numbers up to 10 000", weight: 0.07, source_tag: "whole_numbers", subskills: ["place_value", "numerals_words", "compare_order", "number_patterns", "digit_value"] },
  { id: "number.add_subtract", title: "Addition and subtraction", weight: 0.15, source_tag: "add_subtract", subskills: ["algorithm_4digit", "missing_number", "missing_digit", "fewer_more_than", "two_step", "part_whole_model", "sum_difference_model", "working_backwards"] },
  { id: "number.multiply_divide", title: "Multiplication and division", weight: 0.2, source_tag: "multiply_divide", subskills: ["tables_6_9", "multiply_3d_by_1d", "divide_3d_by_1d", "division_remainder", "equal_groups", "two_step_mul_div", "comparison_model_times", "comparison_model_extra", "before_after", "simultaneous_compare"] },
  { id: "number.money", title: "Money", weight: 0.1, source_tag: "money", subskills: ["add_money", "subtract_money", "change", "multiply_price", "best_buy_grouping"] },
  { id: "number.fractions", title: "Fractions", weight: 0.08, source_tag: "fractions", subskills: ["equivalent_fractions", "simplest_form", "compare_order_unlike", "number_line", "add_related", "subtract_related", "subtract_from_whole"] },
  { id: "measurement.length_mass_volume", title: "Length, mass and volume", weight: 0.09, source_tag: "measurement", subskills: ["convert_length", "convert_mass", "convert_volume", "compound_units", "read_scale", "measure_word_problem", "routes_compare"] },
  { id: "measurement.time", title: "Time", weight: 0.08, source_tag: "time", subskills: ["convert_h_min", "tell_time_24h", "duration", "end_time", "start_time", "across_midnight", "two_step_time"] },
  { id: "geometry.area_perimeter", title: "Area and perimeter", weight: 0.07, source_tag: "area_perimeter", subskills: ["area_counting_squares", "area_rectangle_square", "perimeter_rectangle_square", "perimeter_rectilinear", "area_vs_perimeter", "wire_reshaped"] },
  { id: "geometry.angles_lines", title: "Angles; perpendicular and parallel lines", weight: 0.07, source_tag: "angles_lines", subskills: ["right_acute_obtuse", "count_angles_in_figure", "identify_parallel", "identify_perpendicular", "draw_parallel", "draw_perpendicular"] },
  { id: "statistics.bar_graphs", title: "Bar graphs", weight: 0.08, source_tag: "bar_graphs", subskills: ["read_scale", "read_minor_gridlines", "difference_between_bars", "double_bar_compare", "total_from_graph", "graph_to_money"] },
];

/** "AP" collides with a school paper code, so area-and-perimeter archetypes become "AR". */
const p3mathArchetypeId = (id: string) => id.replace(/^AP(\d)/, "AR$1");

const P3MATH_PRESENTATION = `\`\`\`
468 + 395 = 863                  ← one number sentence per line
1250 − 863 = 387
He sold 387 plates on Sunday.    ← statement with the noun/unit
\`\`\``;

const P3MATH: PackConfig = {
  id: "p3-maths",
  sourceName: "p3-maths-tutor",
  prefix: "p3math",
  title: "P3 Maths",
  description:
    "Primary 3 Mathematics (Singapore MOE 2021 syllabus): whole numbers, the four operations, money, fractions, measurement, time, area and perimeter, angles and lines, bar graphs. Model method, short visual sessions, exam-format practice.",
  subject: "maths",
  level: "P3",
  syllabus: "MOE 2021 Primary Mathematics (P3)",
  language: "en",
  agents: AGENTS_DEFAULT,
  licence: "Content CC BY-NC 4.0 (myKx); items and figures original.",
  sources: [SOURCE_OWN, SOURCE_DERIVED],
  pronoun: "he",
  names: NAMES,
  topics: P3MATH_TOPICS,
  tagMap: tagMapOf(P3MATH_TOPICS),
  archetypes: (src) => {
    const body = sectionBody(src.read("references/exam-blueprint.md"), "3. Question archetypes", "p3-maths archetypes");
    const out: Archetype[] = [];
    let topic: SkillTopic | undefined;
    const rows: { id: string; topic: SkillTopic; text: string }[] = [];
    for (const line of body.split("\n")) {
      const h = /^###\s+(\S+)/.exec(line);
      if (h) topic = P3MATH_TOPICS.find((t) => t.source_tag === h[1]);
      const m = /^-\s+\*\*([A-Z]{2}\d+)\*\*\s+\([\d–-]+\)\s+(.*)$/.exec(line);
      if (m && topic) rows.push({ id: p3mathArchetypeId(m[1]), topic, text: m[2] });
    }
    for (const r of rows) {
      const n = rows.filter((x) => x.topic === r.topic).length;
      out.push({ id: r.id, topic: r.topic.id, pattern: P3MATH_PATTERNS[r.id] ?? generalisePattern(r.text), exam_weight: round(r.topic.weight / n) });
    }
    return out;
  },
  archetypeAlias: Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`AP${n}`, `AR${n}`])),
  references: [
    {
      from: "references/syllabus-map.md",
      to: "syllabus-map.md",
      title: "P3 Maths syllabus map",
      dropColumns: ["typical question"],
      edits: [
        [/the 2026 school briefings \(\w+: topics by term; EYE = 70% of the year\)\./, "school briefings (topics by term; the end-of-year exam is usually most of the year's grade)."],
        [/Use the \*\*tag\*\* \(topic \/ sub-skill\) exactly as written when logging with\n`tracker\.py`\./, "Use the **tag** (topic / sub-skill) exactly as written; they are the topic\n`source_tag` and `subskills` in `skill.json`."],
        [/\(one 2025 paper slipped in 56 030 —\ntreat 5-digit reading as a bonus, not core\)/, "(a 5-digit number occasionally slips into a\npaper — treat 5-digit reading as a bonus, not core)"],
        [/"34 fewer than", "107 fewer than Mary"/, '"34 fewer than", "45 fewer than Mary"'],
        [/"had some money… in the end had \$1921; at first\?"/, '"had some money… in the end had $X; at first?"'],
      ],
    },
    {
      from: "references/exam-blueprint.md",
      to: "exam-blueprint.md",
      title: "P3 end-of-year paper: format, marking and traps",
      pronoun: "he",
      edits: [
        [/Built from three real 2025 end-of-year papers \(RGPS, ACS Primary, ACS Junior\)\nand the 2026 \w+ parent briefing\. Use this to set papers that feel like the\nreal thing and to teach \w+ what the marker is looking for\./, "Built from recent school end-of-year papers (kept as private reference) and a\nschool parent briefing. Use this to set papers that feel like the real thing and\nto teach what the marker is looking for."],
        [/No "=" chains like 137 − 34 = 103 \+ 137 = 240/, 'No "=" chains like 12 + 5 = 17 − 3 = 14'],
        [/1\. \*\*"fewer than" direction\.\*\* "Raj has 107 fewer than Mary" means Mary has\n   \*more\*: Mary = 312 \+ 107\. Half the class subtracts\./, '1. **"fewer than" direction.** "Raj has 45 fewer than Mary" means Mary has\n   *more*: Mary = Raj + 45. Half the class subtracts.'],
        [/8\. \*\*Least amount in best-buy\*\* — taking the bundle for every item \(12 ÷ 4 = 3\n   bundles = \$21 for 9 doughnuts\) instead of 2 bundles \+ 1 single \(\$16\)\./, "8. **Least amount in best-buy** — rounding up to whole bundles (buying items\n   nobody asked for) instead of the cheapest exact mix of bundles and singles."],
        [/```\n   137 − 34 = 103[\s\S]*?```/, P3MATH_PRESENTATION],
      ],
      replace: {
        "1. Paper format": `School papers vary a little; the common shape is **50 marks, 1 h 15 min – 1 h 30 min, no calculator**, in three sections:

| Section | What | Typical marks |
|---|---|---|
| A (MCQ) | 10 questions, the first few 1 mark, the rest 2 marks | 15–17 |
| B (short answer) | 10–15 questions, 1–2 marks, answer in a box or on a line | 15–20 |
| C (problem sums) | 5 questions in parts, 3–4 marks each | 15–20 |

Order of difficulty inside each section is roughly increasing; the last two
MCQs and the last short-answer questions are the 2-mark "thinking" items.
Set practice papers to 50 marks so scores are directly comparable.

**Time budget:** Section A 20 min, B 30 min, C 30 min, 10 min check. One mark ≈ 1.5 minutes. If a 2-mark MCQ has eaten 4 minutes, circle it, move on, come back.

**Answer conventions to copy exactly**
- MCQ: shade/write the option number (1, 2, 3, 4) — not the value.
- Short answer: the unit is often pre-printed ("Answer: ______ m") — then write only the number. If it is not printed, write it.
- Area in cm², perimeter in cm; money with two decimal places ($6.00 is fine, $6 is accepted; $16.0 is not); time as "2 h 20 min" or "6.50 p.m." or "21 54" (24-hour, no colon, a space).
- Fractions in simplest form unless the question says otherwise.`,
        "3. Question archetypes": "The recurring question shapes, with ids and exam weights, are the `archetypes` in `skill.json`. Synthesise new questions by keeping the archetype and changing the surface (numbers, context, which quantity is unknown). Difficulty: 1 easy, 2 medium, 3 hard.",
      },
    },
    {
      from: "references/heuristics-models.md",
      to: "model-method.md",
      title: "The P3 toolkit: model method, time line and the thinking routine",
      pronoun: "he",
      // The source worked every model through a school-paper question; the fresh examples below replace them.
      replace: {
        "1. Part-whole model": `Use when a whole is split into parts and one part is missing.

\`\`\`
|------ Friday ------|---- Saturday ----|--- ? ---|
|<------------------- 1250 plates ------------------->|
\`\`\`
468 + 395 = 863 (Friday and Saturday)
1250 − 863 = 387. **He sold 387 plates on Sunday.**

One number sentence per line, then a statement with the noun.`,
        "2. Comparison model": `Use for *more than / fewer than / times as many*. Always draw the longer bar
first and line up the left edges.

### 2a. More / fewer (additive)
"Ben has 45 fewer stickers than Siti" ⇒ Siti's bar is longer: Siti = Ben + 45.
\`\`\`
Ben   |------- 230 -------|
Siti  |------- 230 -------|-- 45 --|
\`\`\`
*Trap:* "fewer than Siti" ⇒ Siti has more. Circle the name after the comparison word.

### 2b. Times as many (units)
Give the smallest amount 1 unit; "3 times as many" is 3 units. If one bar is
"1 unit and 12 more", take every extra away from the total first, then share
what is left equally into units.
\`\`\`
Blue   |--u--|--u--|
Red    |--u--|
Green  |--u--|-- 12 --|
\`\`\`
4 units + 12 = 92 → 4 units = 80 → 1 unit = **20** red.

### 2c. Sum and difference
Take the difference away from the sum and two equal bars are left:
*(sum − difference) ÷ 2 = the smaller number.* Teach this shape; it generalises
and the model shows why.

### 2d. Two purchases differing in one item
Line the two purchases up. Whatever is the same cancels, so the difference in
cost pays for the difference in items: 3 pens + 2 rulers = $11 and 3 pens +
5 rulers = $17 → 3 rulers = $6 → 1 ruler = **$2**.`,
        "3. Before–after model": `Use when a quantity changes and the *new* relationship is given.

Draw the **after** bar first ("now she has 4 times as many as her brother"),
then undo the change to get the before: after = 4 × 25 = 100; she had bought
18, so before = 100 − 18 = **82**.

Equal at first, then one gains and the other loses: the gap between them is
the gain plus the loss. If afterwards one is 3 times the other, that gap is
2 units.`,
        "4. Time line": `Draw a horizontal line, mark the known times, jump **to the next whole hour
first**, then the rest. Never subtract times as decimals.

\`\`\`
3.40 p.m. --20 min--> 4.00 p.m. --2 h--> 6.00 p.m. --15 min--> 6.15 p.m.
\`\`\`
Duration = 20 min + 2 h + 15 min = **2 h 35 min**.

Going backwards works the same way: from the end time, jump back to the
o'clock, then the rest. Across midnight, always break the jump at 00 00.`,
        "5. Equal-groups and best-buy": `Compare the price per item first. Take as many full bundles as you need
without going over, then top up with singles; buying extra items is not
"least" unless the question allows it. With "buy n, get m free", count the
items each price really buys (e.g. 6 + 2 free = 8 per bundle) before scaling.`,
        "7. Area and perimeter": `Perimeter = the **fence** around (add every side, cm). Area = the **carpet**
inside (length × breadth, cm²). Two figures can have the same fence and
different carpets: 6 × 6 has area 36 cm² and perimeter 24 cm; 3 × 9 has area
27 cm² and perimeter 24 cm.

**Wire problems.** The wire *is* the perimeter: bend it into a new shape and
the perimeter stays the same (rectangle → perimeter → square side → area).

**Shapes made of identical rectangles.** Label *every* outside edge first,
using the rectangles' length and breadth, then add.

**Counting squares.** Whole squares count 1, half-squares (diagonal cut) count ½.`,
      },
      edits: [
        [/These are the \*recommended\* ways Singapore schools expect P3 pupils to solve\nand present problems\. Every worked example below is from one of the three\n2025 end-of-year papers, so the shapes are exactly what the marker expects\.\nWhen checking an answer key or marking Jordan's work, "correct" means this\nmethod, not just this number\./, "These are the *recommended* ways Singapore schools expect P3 pupils to solve\nand present problems: the shapes the marker expects. When checking an answer\nkey or marking work, \"correct\" means this method, not just this number."],
        [/For an \w+ learner the routine is a \*physical\* checklist — four boxes drawn\nin the margin that he ticks\.[^\n]*\n[^\n]*head\./, "For a learner who finds self-checking hard, the routine is a *physical*\nchecklist — four boxes drawn in the margin to tick. It moves the\nself-monitoring out of the head and onto the page."],
        [/- "Inside the figure" means \*every\* corner, marked or not\. ACS\(P\) Q9's arrow\n  has 5 acute corners \(2 on the notched tail, 2 at the back of the head, 1 at\n  the tip\); the published key's "4" undercounts\./, "- \"Inside the figure\" means *every* corner, marked or not — including the\n  unmarked corners of a notched shape. Keys often undercount these."],
      ],
    },
    {
      from: "references/coaching-*.md",
      to: "coaching-playbook.md",
      title: "Coaching playbook: short, visual, game-like sessions that stick",
      pronoun: "he",
      edits: [
        [/Not a diagnosis\. Practical adjustments for a Primary 3 pupil whose parent says\n[^\n]*\n?[^\n]*needs things to stick\./, "Not a diagnosis. Practical adjustments for Primary 3 pupils who drift unless\nthe work is interesting, and who need things to stick."],
        [/These are not decorations; for this child they are the delivery mechanism\./, "These are not decorations; for many children they are the delivery mechanism."],
        [/about Pokémon \/ football \/ whatever he likes/, "about football / a favourite game / whatever he likes"],
        [/### Spaced review — `tracker\.py due`/, "### Spaced review"],
        [/\(tracker tells you\n  which\)/, "(the learner record shows\n  which)"],
        [/tracker priority order/, "priority order from `learner_summary()`"],
        [/## 6\. Feedback wording that works with this child/, "## 6. Feedback wording that works"],
      ],
    },
    {
      from: "references/question-generation.md",
      to: "question-generation.md",
      title: "Writing P3 maths questions",
      pronoun: "he",
      drop: ["Pipeline", "mathdraw.py", "JSON spec"],
      edits: [
        [/1\. \*\*Every diagram is a real vector figure\*\* from `scripts\/mathdraw\.py`\./, "1. **Every diagram is a real vector figure.**"],
        [/2\. \*\*Every answer is computed, not recalled\.\*\* Solve the question in Python\n   \(or in the figure script, as `make_figs_diagnostic\.py` does for the angle\n   count\) before it goes into the JSON\. The published 2025 keys had seven\n   errors; yours should have none\./, "2. **Every answer is computed, not recalled.** Work every answer out\n   independently (and check geometry such as angle counts) before it goes into\n   an item. Published answer keys contain errors; yours should have none."],
        [/Use\n   Jordan's interests for contexts\./, "Use\n   the learner's interests for contexts."],
        [/and use his name once or twice\nper paper\./, "and use the learner's name once or\ntwice per paper."],
        [/A targeted set is 6–10 questions, 10–15 marks, on 2–3 sub-skills the tracker\nranks at the top \(worked example: `assets\/set_time_01\.json` with\n`make_figs_time\.py` — clock faces in the paper, time lines in the mark scheme\), plus 2 interleaved questions from settled sub-skills\./, "A targeted set is 6–10 questions, 10–15 marks, on the 2–3 sub-skills that rank\nhighest in `learner_summary()` (clock faces in the paper, time lines in the\nworking), plus 2 interleaved questions from settled sub-skills."],
        [/Same\npipeline, smaller JSON\. Name it `set_<topic>_<nn>\.json` and keep it; a set he\nscored 60% on/, "Keep it;\na set scored 60% on"],
        [/`distractors` — the mark scheme prints it and it tells you what to log\./, "`distractors` — it tells you what to log."],
        [/## QA checklist before delivering a PDF/, "## QA checklist before delivering a set"],
        [/- \[ \] Rendered a page to PNG and looked at every figure/, "- [ ] Looked at every figure"],
        [/- \[ \] Every answer recomputed in code; mark scheme working matches\./, "- [ ] Every answer recomputed; the working matches."],
        [/- \[ \] Section C stems stay on the same page as part \(a\) \(the builder does\n      this; check after adding large figures\)\./, "- [ ] Section C stems stay with part (a)."],
        [/- \[ \] Marks per section add up; the cover score table matches\./, "- [ ] Marks per section add up."],
      ],
    },
  ],
  skillMd: (src, refs) => {
    const s = src.read("SKILL.md");
    const sec = (h: string) => sectionBody(s, h, "p3-maths SKILL.md");
    return [
      frontmatter("p3-maths", "Primary 3 Mathematics tutor (Singapore MOE 2021 syllabus, school end-of-year exam): numbers to 10 000, four operations, money, fractions, measurement, time, area and perimeter, angles and lines, bar graphs, the model method. Load for any P3 maths question, practice, marking or revision plan."),
      "# P3 Maths",
      `Coaching for Primary 3 Mathematics in Singapore (MOE 2021 syllabus), building towards the school end-of-year paper: usually 50 marks, no calculator, MCQ, short answer and problem sums solved with the **model method**.

**Two facts shape every decision here.** Young learners drift unless the work is interesting, short and visual; and what is learnt on Monday is gone by Friday unless it is pulled back out. So: 20-minute sessions, one idea at a time, pictures before words, games as the delivery mechanism, and spaced review from the learner record.

**When the exam is close** (P3 end-of-year papers usually run late October to early November; the date is in the learner's profile): with ≤ 10 days to go, follow the "last 10 days" plan in \`references/coaching-playbook.md\`: secure, don't explore.`,
      "## What is examinable\n\n" + sec("What is examinable"),
      "## Session shape\n\n" +
        "1. **Warm restart, 3 minutes.** Three quick questions from subskills that `learner_summary()` lists as due — a table fact, a conversion, one short problem. Out loud, no notes, scored as a streak (\"3 for 3!\").\n" +
        '2. **Name the target and the finish time.** "Today: comparison models with an extra. Fifteen minutes. Then you\'re done." A visible finish line is not optional.\n' +
        "3. **Then teach** — one idea, with a picture.\n\n" +
        "If the learner arrives with homework or one question, do that first, then end with the exit ticket. With no history yet, the first sessions are the diagnostic: 5–6 questions at a time across all ten topics.",
      "## The adaptive loop\n\n" + sec("The adaptive loop"),
      "## Teaching rules\n\n" + sec("Teaching rules"),
      "## The presentation that scores\n\n" + sec("The presentation that scores"),
      `## Generating practice questions

**Diagrams must be real figures — never ASCII art, never a text description standing in for a figure.** Bar graphs, number lines, grids with lines, shapes on 1 cm grids, rectangles with dimensions, angle figures, beakers, clocks, route maps and price posters all need a picture.

**Work out every answer independently before it goes into an item**, and re-check geometry (angle counts, parallel steps on a grid) from the figure itself. Published answer keys contain errors; yours should have none.

**Synthesise variants, don't copy.** Take an archetype from \`skill.json\` (e.g. "wire bent into a rectangle, then a square"), change the numbers and context, change which quantity is unknown. Stay inside the depth limits in \`references/syllabus-map.md\`.

A targeted set is 6–10 questions on the top 2–3 subskills from \`learner_summary()\` (one D1, D2, D3 each) plus two interleaved older ones. A full mock is 50 marks in the three-section format. Spread the MCQ answer positions so no pattern can be guessed. Details: \`references/question-generation.md\`.`,
      `## After a mock: the Fix-It set

When a mock is marked:

1. Every row of the paper is recorded (right ones at full marks, wrong ones at 0, per part). Ask for the learner's actual answers so each wrong row gets an error type.
2. The learner record ranks the gaps; the priority order is the level order.
3. Group the wrong questions by subskill into 4–5 **levels**, one per sitting (~15 min each). Each level: a Remember box with the memory hook, then a ladder easy → medium → a ★ Boss question that is a new-surface twin of the question the learner missed. Use a scaffolded part (a) ("if each pen cost $2 less…") before the full model step.`,
      "## Marking\n\n" + sec("Marking his work"),
      inMykx(),
      referenceTable(refs, {
        "syllabus-map.md": "before teaching or writing questions on any topic: subskill tags and depth limits",
        "exam-blueprint.md": "paper format, marking (M1/A1), presentation, the ten traps",
        "model-method.md": "bar models, time lines, best-buy and fraction moves, the UnPAC + NTUC routine",
        "coaching-playbook.md": "session shape, focus and game tactics, memory hooks, the last-10-days plan",
        "question-generation.md": "writing new questions: numbers, language, distractors, targeted sets, QA checklist",
      }),
      "## What not to do\n\n" + sec("What not to do"),
    ].join("\n\n");
  },
  post: [
    [/```\n137 − 34 = 103[\s\S]*?```/, P3MATH_PRESENTATION],
    [/let the tracker choose\nthe next sub-skill/, "let the learner record\nchoose the next sub-skill"],
    [/Format: `qid,topic,subskill,marks_available,marks_scored\[,error_type\]`, rows\nseparated by `;`\. Use the exact tags from `references\/syllabus-map\.md`\./, "Use the exact tags in `skill.json`."],
    [/\*\*Let the tracker choose what is next\.\*\*[\s\S]*?for the next diagnostic\./, "**Let the learner record choose what is next.** `learner_summary()` ranks\nsubskills by *exam weight × gap to 80% mastery*, so the next 20 minutes go\nwhere they recover the most marks — not where the learner last felt bad.\nMastery is recency-weighted and shrunk toward 50% on small samples, so two\nlucky marks do not read as mastery."],
    [/The learner will draw when the learner will not write\. `references\/heuristics-models\.md` has\n  the exact model for every archetype in the 2025 papers\./, "Learners will draw when they will not write. `references/model-method.md`\n  has the model for every common archetype."],
    [/\n\nWhen the parent asks you to check a school or assessment-book answer key,[\s\S]*?audit\./, "\n\nWhen the parent asks you to check a school or assessment-book answer key,\nre-solve every question with the recommended method and re-read every\ndiagram; do not trust the key."],
    [/`tracker.py`/g, "the learner record"],
    [/coaching-(?!playbook)[a-z]+\.md/g, "coaching-playbook.md"],
  ],
  itemSets: [
    { from: "assets/set_diagnostic_01.json", set: "diagnostic-01" },
    { from: "assets/set_time_01.json", set: "time-01" },
    { from: "assets/set_mock_02.json", set: "mock-02" },
    { from: "assets/set_clinic_01.json", set: "fix-it-01" },
  ],
  mapItems: (set, src) => mapSections(set, src, "p3math"),
  excluded: ["assets/question_bank.json", "references/question-bank-2025.md", "PORTABLE.md"],
};

// ─── Sec 2 G3 Science ───────────────────────────────────────────────────────

const ED = "experimental_design";
const S2SCI_TOPICS: SkillTopic[] = [
  { id: "chemistry.chemical_changes", title: "Chemical changes", weight: 0.14, source_tag: "chemical_changes", subskills: ["physical_vs_chemical", "word_equations", "conservation_of_mass", "reaction_types", "acids_alkalis_ph", "indicators", "acid_reactions", "gas_tests", ED] },
  { id: "biology.environment", title: "Interactions with the environment", weight: 0.1, source_tag: "interactions_with_environment", subskills: ["human_impact", "deforestation_effects", "habitat_factors", "adaptations", "ecosystem_hierarchy", "organism_interactions", "food_chains_webs", "energy_flow", ED] },
  { id: "physics.forces_energy", title: "Forces and energy transfer", weight: 0.15, source_tag: "forces_and_energy_transfer", subskills: ["force_effects", "contact_noncontact", "friction", "mass_vs_weight", "pressure", "work_done", "energy_types", "conservation_of_energy", ED] },
  { id: "physics.heat", title: "Transfer of heat and its effects", weight: 0.14, source_tag: "heat_transfer", subskills: ["temperature_units", "expansion_contraction", "expansion_applications", "conduction", "convection", "radiation", "radiation_factors", "insulation_applications", ED] },
  { id: "physics.electrical", title: "Electrical systems", weight: 0.15, source_tag: "electrical_systems", subskills: ["circuit_symbols", "current_in_series", "parallel_independence", "meter_connection", "potential_difference", "resistance_current_relationship", "effective_resistance", "current_effects", "power_and_energy", "cost_calculation", "hazards_and_safety", "fuse_and_breaker", "energy_conservation_home", ED] },
  { id: "biology.digestion", title: "Human digestive system", weight: 0.11, source_tag: "human_digestive_system", subskills: ["nutrients", "why_digest", "physical_vs_chemical_digestion", "enzymes", "organ_functions", "enzyme_products", "absorption", "villi", "use_of_products", ED] },
  { id: "biology.transport", title: "Transport systems in living things", weight: 0.11, source_tag: "transport_in_living_things", subskills: ["diffusion", "osmosis", "osmosis_in_plants", "blood_components", "blood_vessels", "plant_transport", "gas_exchange", ED] },
  { id: "biology.reproduction", title: "Human sexual reproductive system", weight: 0.1, source_tag: "human_reproductive_system", subskills: ["asexual_vs_sexual", "puberty", "male_organs", "female_organs", "fertilisation", "implantation", "heredity", "menstrual_cycle", "birth_control", "stis", ED] },
];

const S2SCI: PackConfig = {
  id: "s2-science",
  sourceName: "sec2-g3-science-tutor",
  prefix: "s2sci",
  title: "Sec 2 G3 Science",
  description:
    "Secondary 2 G3 Science (Singapore MOE 2021 lower secondary syllabus): chemical changes, environment, forces and energy, heat, electrical systems, digestion, transport, reproduction. Misconception-first teaching, State-Cause-Link answers, exam-format practice with real circuit diagrams.",
  subject: "science",
  level: "Sec 2",
  syllabus: "MOE 2021 Lower Secondary Science, G2/G3 course (updated 2024)",
  language: "en",
  agents: AGENTS_DEFAULT,
  licence: "Content CC BY-NC 4.0 (myKx); items and figures original.",
  sources: [SOURCE_OWN, SOURCE_DERIVED, SOURCE_DEMO],
  pronoun: "he",
  names: NAMES,
  topics: S2SCI_TOPICS,
  tagMap: tagMapOf(S2SCI_TOPICS),
  subskillMap: { safety_fuse: "fuse_and_breaker" },
  archetypes: (src) => {
    const body = sectionBody(src.read("references/exam-blueprint.md"), "Recurring question archetypes", "s2-science archetypes");
    const rows: { id: string; topic: SkillTopic; pattern: string }[] = [];
    let topic: SkillTopic | undefined;
    for (const line of body.split("\n")) {
      const h = /^###\s+(\S+)/.exec(line);
      if (h) {
        topic = S2SCI_TOPICS.find((t) => t.source_tag === h[1]);
        if (!topic) throw new Error(`s2-science archetypes: unknown topic ${h[1]}`);
        continue;
      }
      if (!topic) continue;
      const tableRow = /^\|\s*`([a-z0-9-]+)`\s*\|\s*(.+?)\s*\|$/i.exec(line);
      if (tableRow) rows.push({ id: tableRow[1], topic, pattern: tableRow[2] });
      else for (const m of line.matchAll(/`([A-Za-z0-9-]+)`/g)) rows.push({ id: m[1], topic, pattern: m[1].replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) });
    }
    return rows.map((r) => ({ id: r.id, topic: r.topic.id, pattern: r.pattern, exam_weight: round(r.topic.weight / rows.filter((x) => x.topic === r.topic).length) }));
  },
  archetypeAlias: {
    "household-bill-calculation": "kwh-bill-calculation",
    "kwh-unit-reasoning": "kwh-bill-calculation",
    "series-network-with-meters": "series-vs-parallel-effective-resistance",
  },
  references: [
    {
      from: "references/syllabus-map.md",
      to: "syllabus-map.md",
      title: "Sec 2 G3 Science syllabus map",
      pronoun: "he",
      edits: [
        [/Source: the school's own summary notes, aligned to MOE/, "Source: school summary notes, aligned to MOE"],
        [/\*\*Use the exact `topic` and `subskill` tags below when logging to\n`tracker\.py`\.\*\*/, "**Use the exact `topic` and `subskill` tags below (they are in `skill.json`).**"],
        [/Teaching above them\nburns focus he does not have;/, "Teaching above them\nburns attention the learner cannot spare;"],
        [/## 5\. `electrical_systems` — his weak topic/, "## 5. `electrical_systems`"],
      ],
    },
    {
      from: "references/exam-blueprint.md",
      to: "exam-blueprint.md",
      title: "Exam blueprint: format, command words, answer templates, archetypes",
      pronoun: "he",
      edits: [
        [/taken from real 2024–2025 G3 end-of-year papers:/, "based on recent G3 end-of-year papers:"],
        [/\*\*Confirm the real format\*\* as soon as the school publishes its exam-format\nsheet, and update `EXAM_WEIGHT` in `scripts\/tracker\.py` if the topic split\ndiffers from the default\./, "**Confirm the real format** as soon as the school publishes its exam-format\nsheet (the parent records it in the learner's profile) if the topic split\ndiffers from the default."],
      ],
    },
    {
      from: "references/electrical-systems.md",
      to: "electrical-systems.md",
      title: "Electrical systems: misconceptions, ladder, model answers",
      pronoun: "he",
      edits: [
        [/This is where Leonard is losing the most, and it is a good place to start/, "Electrical systems is where many Sec 2 students lose the most marks, and it is a good place to start"],
        [/10\. Mixed set: `assets\/set_electrical_01\.json`/, "10. Mixed set: the pack's electrical practice set (`items/set-electrical-01.json`)"],
        [/the results feed straight into `tracker\.py` and tell you which rungs still\nneed work\./, "the results feed the learner record and show which rungs still need work."],
      ],
    },
    {
      from: "references/coaching-*.md",
      to: "coaching-playbook.md",
      title: "Coaching for focus and retention",
      pronoun: "he",
      edits: [
        [/Not a medical document and not a diagnosis\. Practical tutoring adjustments for\na student who has told you [^\n]*\./, "Not a medical document and not a diagnosis. Practical tutoring adjustments for\nany student who finds it hard to stay focused and to retain what was learnt."],
        [/`tracker\.py due` runs Leitner boxes at 1, 3, 7, 16 and 35 days, resetting to\nday 1 on a failure\./, "The learner record schedules reviews at 1, 3, 7, 16 and 35 days, resetting\nto day 1 on a failure."],
        [/Show him the mastery bars from `tracker\.py report`/, "Show him the mastery bars from the learner record"],
        [/- `tracker\.py report` is readable without any science knowledge\./, "- The parent view is readable without any science knowledge."],
        [/The profile file, not his memory, holds what he\nknows\./, "The learner record, not his memory, holds what he\nknows."],
      ],
      post: [
        [/\bthe tracker\b/g, "the learner record"],
        [/\*\*Their attention is a budget, not a character trait\.\*\*/, "**A learner's attention is a budget, not a character trait.**"],
      ],
    },
    {
      from: "references/question-generation.md",
      to: "question-generation.md",
      title: "Generating questions with real diagrams",
      pronoun: "he",
      drop: ["Workflow", "scidraw API", "Question JSON schema"],
      edits: [
        [/Every figure is a real vector drawing, produced by `scripts\/scidraw\.py`,\nexported as PNG \(300 dpi, for the PDF\) and SVG \(for editing\), and embedded\nin the paper\./, "Every figure is a real vector drawing (SVG) using standard circuit symbols."],
        [/- use `scidraw\.flow\(\)` for a labelled flow chart/, "- use a labelled flow chart"],
        [/1\. \*\*Pick the archetype\*\* that targets the sub-skill the tracker flagged\./, "1. **Pick the archetype** that targets the sub-skill `learner_summary()` flagged."],
        [/6\. \*\*Tag it\*\* with topic, subskill, archetype and difficulty so the result\n   feeds the tracker\./, "6. **Tag it** with topic, subskill, archetype and difficulty so the result\n   feeds the learner record."],
        [/- \[ \] Topic-coverage table at the end of the mark scheme looks sane\n- \[ \] Both PDFs delivered, mark scheme flagged as "do not give him this yet"/, "- [ ] Topic coverage across the set looks sane\n- [ ] Answers and mark schemes are never shown to the learner before an attempt"],
      ],
    },
  ],
  skillMd: (src, refs) => {
    const s = src.read("SKILL.md");
    const sec = (h: string) => sectionBody(s, h, "s2-science SKILL.md");
    return [
      frontmatter("s2-science", "Secondary 2 G3 Science tutor (Singapore MOE 2021 lower secondary syllabus): chemical changes, environment, forces and energy, heat, electrical systems, digestion, transport, reproduction. Load for any Sec 2 science question, practice, marking or revision plan."),
      "# Sec 2 G3 Science",
      `One-to-one coaching for Secondary 2 Science at **G3** level (Singapore MOE 2021 Lower Secondary syllabus). This cohort sits the Singapore-Cambridge SEC rather than the O-Level later, so build durable understanding rather than paper-format cramming.

**Two facts shape every decision.** Attention is limited and memory fades: sessions are short, one thing happens at a time, and nothing important is allowed to live only in the learner's head — it lives in the learner record. **Electrical Systems** is where most marks are lost and where to start unless the learner record says otherwise.

## The syllabus

Eight chapters, all examinable in the end-of-year paper:

1. Chemical Changes · 2. Interactions with the Environment · 3. Forces & Energy Transfer · 4. Transfer of Heat and its Effects · 5. **Electrical Systems** · 6. Human Digestive System · 7. Transport Systems in Living Things · 8. Human Sexual Reproductive System

Subskill tags, learning outcomes and the **depth limits** (what is *not* required, such as V = IR) are in \`references/syllabus-map.md\`. Read it before teaching or writing questions for any topic.`,
      "## Session shape\n\n" +
        '1. **Ninety-second warm restart.** 2–3 questions from subskills `learner_summary()` lists as due. No notes, answers said out loud. This single habit does more for retention than any amount of re-reading.\n' +
        '2. **Name the target.** One sentence: "Today: current in series circuits. Twenty minutes. Then you\'re done." A visible finish line is not optional.\n' +
        "3. **Then teach.** If the learner arrives with homework or a specific question, answer that first, and still close with the exit ticket.",
      "## The adaptive loop\n\n" + sec("The adaptive loop"),
      "## Teaching rules\n\n" + sec("Teaching rules"),
      "## Answering technique\n\n" + sec("Answering technique"),
      `## Generating practice questions

**Diagrams must be real vector figures. Never ASCII art, never a text description standing in for a diagram.** A Sec 2 science paper is a visual document; practising on text-only questions trains the wrong skill.

**Synthesise variants, don't copy.** Take an archetype from \`skill.json\` (for instance "open one branch of a parallel circuit"), then change the surface: swap lamps for resistors, move the switch, invert the question from "what happens" to "explain why it doesn't happen", change the numbers. The archetype is what repeats across papers; the surface is what makes it a new question. Keep every question inside the depth limits.

**When a good diagram is not possible** — anatomical drawings of the reproductive or digestive system, for example — do not draw a bad one. Use a labelled flow chart or a table. Real papers use flow charts for these topics anyway. Details: \`references/question-generation.md\`.`,
      "## Marking\n\n" + sec("Marking his work"),
      inMykx(),
      referenceTable(refs, {
        "syllabus-map.md": "before teaching or writing questions on any topic: subskill tags and depth limits",
        "exam-blueprint.md": "paper format, command words, answer templates, archetypes, difficulty",
        "electrical-systems.md": "teaching electrical systems: misconceptions, diagnostic ladder, model answers, kWh",
        "coaching-playbook.md": "session design, memory techniques, feedback wording, the bad day",
        "question-generation.md": "writing new questions: the diagram rule, re-skinning archetypes, QA checklist",
      }),
      "## What not to do\n\n" + sec("What not to do"),
    ].join("\n\n");
  },
  post: [
    [/coaching-(?!playbook)[a-z]+\.md/g, "coaching-playbook.md"],
    [/Format: `qid,topic,subskill,marks_available,marks_scored\[,error_type\]`,\nentries separated by `;`\. Use the exact topic and sub-skill tags from\n`references\/syllabus-map\.md` or the statistics become meaningless\./, "Use the exact topic and subskill tags in `skill.json` or the statistics become meaningless."],
    [/\*\*Let the tracker choose what is next\.\*\*[\s\S]*?not a hunch\./, "**Let the learner record choose what is next.** `learner_summary()` ranks\nsubskills by *exam weight × gap to 80% mastery*, so the next twenty minutes\ngo where they recover the most marks — not where the learner last felt bad.\nMastery is recency-weighted and shrunk toward 0.5 on small samples, so two\nlucky marks do not register as mastery and a topic learnt months ago decays\nback into the queue."],
    [/\*\*Log immediately\*\*, while the session is live:\n*/, "**Log immediately**, while the session is live: the app records each attempt with its subskill and error type.\n"],
    [/Memory hooks, session structure, focus tactics and the wording of feedback\nare in `references\/coaching-playbook\.md`\. Read it before the first session\./, "Memory hooks, session structure, focus tactics and the wording of feedback\nare in `references/coaching-playbook.md`."],
    [/A visible finish line is not optional\nfor an \w+ learner\./, "A visible finish line is not optional."],
  ],
  itemSets: [{ from: "assets/set_electrical_01.json", set: "set-electrical-01" }],
  mapItems: (set, src) => mapSections(set, src, "s2sci"),
  excluded: ["PORTABLE.md"],
};

// ─── P6 (PSLE) Maths ────────────────────────────────────────────────────────

const P6MATH_TOPICS: SkillTopic[] = [
  { id: "number.fractions", title: "Fractions", weight: 0.138, source_tag: "FR", subskills: ["fraction_operations", "fraction_of_quantity", "remainder_concept", "fraction_word_problems", "fraction_of_figure"] },
  { id: "geometry.angles", title: "Angles and geometry", weight: 0.134, source_tag: "ANG", subskills: ["angle_facts", "isosceles_equilateral", "quadrilateral_properties", "angle_reasoning", "parallel_perpendicular", "symmetry", "draw_on_grid"] },
  { id: "number.whole_numbers", title: "Whole numbers", weight: 0.132, source_tag: "WN", subskills: ["place_value_numerals", "rounding", "factors_multiples", "order_of_operations", "number_patterns", "whole_number_word_problems"] },
  { id: "statistics.data", title: "Data: tables, bar and line graphs, pie charts", weight: 0.098, source_tag: "DATA", subskills: ["read_tables_graphs", "pie_charts", "line_graphs", "true_false_npt"] },
  { id: "number.percentage", title: "Percentage", weight: 0.07, source_tag: "PCT", subskills: ["percentage_of", "percentage_change", "find_original", "discount_gst", "percentage_word_problems"] },
  { id: "measurement.volume", title: "Volume of cubes, cuboids and liquids", weight: 0.066, source_tag: "VOL", subskills: ["cuboid_volume", "liquid_in_tanks", "tank_rates"] },
  { id: "geometry.circles", title: "Circles", weight: 0.066, source_tag: "CIRC", subskills: ["circumference", "circle_area", "composite_circles"] },
  { id: "algebra.expressions", title: "Algebra", weight: 0.046, source_tag: "ALG", subskills: ["form_expression", "simplify_evaluate", "simple_equations"] },
  { id: "geometry.area_perimeter", title: "Area and perimeter", weight: 0.044, source_tag: "AREA", subskills: ["triangle_area", "composite_area", "perimeter"] },
  { id: "number.decimals", title: "Decimals", weight: 0.042, source_tag: "DEC", subskills: ["decimal_operations", "compare_order_decimals", "decimal_fraction_conversion", "rounding_decimals"] },
  { id: "measurement.rate", title: "Rate and charges tables", weight: 0.042, source_tag: "RATE", subskills: ["unit_rate", "charges_tables", "best_buy"] },
  { id: "number.ratio", title: "Ratio", weight: 0.036, source_tag: "RATIO", subskills: ["ratio_basics", "equivalent_ratio", "repeated_identity", "ba_total_unchanged", "ba_difference_unchanged", "ba_one_unchanged", "ba_both_change", "ratio_word_problems"] },
  { id: "measurement.units_time", title: "Measurement: units, time, estimation", weight: 0.034, source_tag: "MEAS", subskills: ["unit_conversion", "time_schedules", "estimation"] },
  { id: "geometry.solids", title: "Nets and solid figures", weight: 0.032, source_tag: "SOLID", subskills: ["nets", "unit_cubes", "views"] },
  { id: "statistics.average", title: "Average", weight: 0.02, source_tag: "AVG", subskills: ["average_total", "combined_average", "missing_item"] },
];

const P6MATH_TAG_SUBSKILL: Record<string, string> = {
  "BA-ONE": "ba_one_unchanged",
  "BA-TOTAL": "ba_total_unchanged",
  "BA-DIFF": "ba_difference_unchanged",
  "BA-BOTH": "ba_both_change",
  "REP-ID": "repeated_identity",
};

/** Archetypes from the private prelim bank: one per (topic, heuristic) plus one "core" per topic. Subtopic labels only. */
function p6mathArchetypes(src: Source): Archetype[] {
  const meaning: Record<string, string> = {};
  for (const line of sectionBody(src.read("references/topic_stats.md"), "Cross-topic heuristics", "p6-maths stats").split("\n")) {
    const m = /^\|\s*([A-Z-]+)\s*\|\s*\d+\s*\|\s*[\d.]+\s*\|\s*(.+?)\s*\|$/.exec(line);
    if (m) meaning[m[1]] = m[2].replace(/\s*\([^)]*\)/g, "").split(" — ")[0];
  }
  const groups = new Map<string, { topic: SkillTopic; tag: string; marks: number; subs: string[] }>();
  let topic: SkillTopic | undefined;
  for (const line of src.read("references/question_bank.md").split("\n")) {
    const h = /^## ([A-Z]+) — /.exec(line);
    if (h) {
      topic = P6MATH_TOPICS.find((t) => t.source_tag === h[1]);
      if (!topic) throw new Error(`p6-maths bank: unknown topic ${h[1]}`);
      continue;
    }
    if (!topic || !/^\| [A-Z]/.test(line) || line.startsWith("| Src")) continue;
    const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const [, , marks, sub, tags] = cells;
    const tag = (tags ?? "").split(",")[0].trim() || "CORE";
    const key = `${topic.source_tag}-${tag}`;
    const g = groups.get(key) ?? { topic, tag, marks: 0, subs: [] };
    g.marks += Number(marks) || 0;
    const clean = sub.replace(/\b\d[\d ]*\b/g, "").replace(/\s{2,}/g, " ").trim();
    if (!/\d/.test(sub) && clean && !g.subs.includes(clean)) g.subs.push(clean);
    groups.set(key, g);
  }
  return [...groups.entries()].map(([key, g]) => {
    const list = g.subs.slice(0, 6).join("; ");
    const head = g.tag === "CORE" ? `Core ${g.topic.title.toLowerCase()} items` : (meaning[g.tag] ?? g.tag);
    const pattern = `${head[0].toUpperCase()}${head.slice(1)}${list ? `: ${list}` : ""}`.slice(0, 240);
    const subskill = g.topic.id === "number.ratio" ? P6MATH_TAG_SUBSKILL[g.tag] : undefined;
    return { id: key, topic: g.topic.id, pattern, exam_weight: round(g.marks / 500), ...(subskill ? { subskill } : {}) };
  });
}

const P6MATH_BA_EXAMPLES = {
  type1: `Example: Ravi and Siti had stickers in the ratio 5 : 3. Each of them gave away 12 stickers. The ratio became 3 : 1. How many stickers did Ravi have at first?

\`\`\`
            |  Ravi  |  Siti  |  Difference
  Before    |  5u    |  3u    |  2u
  Change    |  −12   |  −12   |  0
  After     |  3p    |  1p    |  2p
\`\`\`
The difference is 2 units before and 2 parts after, so 1 unit = 1 part. 5u − 12 = 3u → 2u = 12 → 1u = 6. Ravi at first: 5u = **30 stickers**. (Check: 30 − 12 = 18, 18 − 12 = 6, 18 : 6 = 3 : 1 ✓)`,
  type2: `Example: Ali had $\\frac{3}{5}$ as many marbles as Ben. After Ben gave Ali 14 marbles, they had the same number. How many marbles did Ben have at first?
\`\`\`
            |  Ali  |  Ben  |  Total
  Before    |  3u   |  5u   |  8u
  After     |  1p   |  1p   |  2p    ×4 →  4u | 4u | 8u
\`\`\`
Ben: 5u → 4u, so he gave 1u = 14. Ben at first: 5 × 14 = **70 marbles**.`,
  type3: `Example: The ratio of red beads to blue beads in a box was 4 : 7. Some red beads were added and the ratio became 3 : 4. There are 84 blue beads. How many red beads were added?
Blue unchanged → make it the same number of units: 4 : 7 = 16 : 28 and 3 : 4 = 21 : 28. 28 units = 84 → 1 unit = 3. Red went from 16 to 21 units: 5 units = **15 red beads** added.`,
  type4: `Example: At first, $\\frac{3}{4}$ of the pens in a box were blue and the rest were red. After 20 blue pens and 16 red pens were added, $\\frac{2}{3}$ of the pens were blue. How many blue pens were there at first?
Before: blue 3u, red 1u. After: blue 2p, red 1p.
Red: 1u + 16 = 1p, so 2p = 2u + 32. Blue: 3u + 20 = 2p = 2u + 32 → 1u = 12 → blue at first = 3 × 12 = **36**.`,
};

const P6MATH: PackConfig = {
  id: "p6-maths",
  sourceName: "psle-math-tutor",
  prefix: "p6math",
  title: "P6 Maths (PSLE)",
  description:
    "Primary 6 / PSLE Mathematics (Singapore MOE 2021 syllabus, 2026 exam format): fractions, ratio and before-after problems, percentage, angles, circles, volume, data, algebra. Name-the-method heuristics, low-pressure sessions, statistically targeted practice.",
  subject: "maths",
  level: "P6",
  syllabus: "MOE 2021 Primary Mathematics syllabus (Standard; updated Oct 2025), examined at PSLE from 2026 (SEAB 0008)",
  language: "en",
  agents: AGENTS_DEFAULT,
  licence: "Content CC BY-NC 4.0 (myKx).",
  sources: [SOURCE_OWN, SOURCE_DERIVED, SOURCE_DEMO],
  pronoun: "she",
  names: NAMES,
  topics: P6MATH_TOPICS,
  tagMap: tagMapOf(P6MATH_TOPICS),
  archetypes: p6mathArchetypes,
  references: [
    {
      from: "references/exam_2026.md",
      to: "exam-format.md",
      title: "PSLE Mathematics: format, scope, time budgeting",
      pronoun: "she",
      replace: { "Dates": "The national timetable (SEAB) sets the two paper dates; the learner's own exam dates are in their profile. Both papers are on the same morning with a break between." },
      edits: [[/## Time budgeting to teach Abby/, "## Time budgeting to teach"], [/## Marking realities worth telling her/, "## Marking realities worth telling the learner"]],
    },
    {
      from: "references/heuristics.md",
      to: "heuristics.md",
      title: "Problem-solving heuristics: which method?",
      pronoun: "she",
      edits: [
        [/The most important section for Abby is \*\*Before-and-After\*\* — read it in full the first time\./, "The most-missed section is **Before-and-After** — read it in full the first time."],
        [/## 2\. Before-and-After \(Abby's target\)/, "## 2. Before-and-After"],
        [/Example \(from the tips book\): adults : children[\s\S]*?\*\*180 people\*\*\./, P6MATH_BA_EXAMPLES.type1],
        [/Example: Jonah had[\s\S]*?\*\*12 stamps\.\*\*/, P6MATH_BA_EXAMPLES.type2],
        [/\("Judy gave 26 stickers to Lindy"\)/, "(\"Judy gave some of her stickers to Lindy\")"],
        [/\("Julie ate \$\\frac\{2\}\{3\}\$ of \*her\* sweets" — Irene's never change\.\)/, "(\"Mei ate $\\frac{2}{3}$ of Mei's own sweets\" — Tom's never change.)"],
        [/Example \(Red Swastika 2026 P1 Q24\):[^\n]*\n[^\n]*\n\nExample \(ACS Junior 2026 P2 Q11\):[^\n]*/, P6MATH_BA_EXAMPLES.type3],
        [/Example \(tips book\): 80% of Alisha's marbles[\s\S]*?red at first = 4 × 87 = \*\*348\*\*\./, P6MATH_BA_EXAMPLES.type4],
        [/### The decision card \(give this to Abby as a one-liner\)/, "### The decision card (a one-liner to learn by heart)"],
        [/### Common Abby-type errors to watch for/, "### Common errors to watch for"],
        [/## 15\. Logic check \(Hot Tip #78\)/, "## 15. Logic check"],
      ],
    },
    {
      from: "references/topic_playbooks.md",
      to: "topic-playbooks.md",
      title: "Topic playbooks: must-know, hooks, recipes, traps",
      pronoun: "she",
      edits: [
        [/\*\*Traps\*\* \(what Abby-type learners get wrong\), \*\*Seen in 2026 prelims\*\* \(so generated variants stay authentic\)\./, "**Traps** (what learners commonly get wrong)."],
        [/^\*\*Seen in 2026 prelims:\*\*.*$/gm, ""],
        [/"Greatest number of cakes" with a ratio and stock \(flour : sugar 5 : 4, 500 g flour per cake → 400 g sugar per cake; 2000 ÷ 500 = 4, 900 ÷ 400 = 2 r 100 → \*\*2\*\*, limited by sugar\)\./, "\"Greatest number of cakes\" with a ratio and stock (butter : sugar 3 : 2, 150 g butter per cake → 100 g sugar per cake; with 1 kg butter and 500 g sugar: 1000 ÷ 150 = 6 r 100, 500 ÷ 100 = 5 → **5**, limited by sugar)."],
        [/KFC — Keep, Flip, Change/, "Keep, Change, Flip"],
      ],
    },
    {
      from: "references/topic_stats.md",
      to: "topic-stats.md",
      title: "Topic statistics: where the marks are",
      pronoun: "she",
      edits: [
        [/# Topic statistics from the five 2026 P6 prelim papers\n\nSource: Red Swastika \(RS\), Tao Nan \(TN\), ACS Junior \(ACS\), Ai Tong \(AT\), Catholic High \(CH\) — 2026 Preliminary Examinations, all in the new 2026 PSLE format \(100 marks, 45 questions\)\. Every one of the 225 questions was classified by topic and heuristic in `assets\/question_db\.py` \(run it to regenerate these numbers\)\./, "# Topic statistics\n\nSource: five recent P6 school papers in the new PSLE format (100 marks, 45 questions), kept as private reference. Every one of the 225 questions was classified by topic and heuristic; only the counts are kept here."],
        [/## Priority tiers for Abby \(marks\/paper × how teachable in a week × her stated gaps\)/, "## Priority tiers (marks/paper × how teachable in a week)"],
        [/\(her stated gap; unlocks/, "(a very common gap; unlocks"],
      ],
    },
    {
      from: "references/tutoring_method.md",
      to: "tutoring-method.md",
      title: "Tutoring method: tone, session template, diagnostic, a 7-day plan",
      pronoun: "she",
      dropColumns: ["Date"],
      edits: [
        [/^# How to tutor \w+ \(method[^\n]*\n\n\w+ is a P6 pupil[^\n]*\n/, "# Tutoring method\n\nThe final weeks before the PSLE: maximum help without pressure. A learner's known weak spots (from the parent and from the learner record) are the starting hypothesis, not the whole picture: the first job is a gentle diagnostic.\n"],
        [/## Principles \(why each one matters for \*this\* learner\)/, "## Principles (and why each one matters)"],
        [/A \w+ learner cannot hold five new methods; she can hold one method with one memory hook, practised three times\./, "Nobody holds five new methods in the final weeks; a learner can hold one method with one memory hook, practised three times."],
        [/Small daily recall is how \w+ learners keep things\./, "Small daily recall is how learners keep things."],
        [/Keep a simple tracker \(scripts\/progress\.py\) and show her the topic moving from "learning" to "steady"\./, "Show the learner the topic moving from \"learning\" to \"steady\" in the learner record."],
        [/the KFC rule for dividing fractions/, "the Keep-Change-Flip rule for dividing fractions"],
        [/Use a diagram or worksheet PDF for every question that would have a figure in the real paper — never ASCII pictures\./, "Use a real diagram for every question that would have a figure in the real paper — never ASCII pictures."],
        [/Generate a \*\*10-question mixed diagnostic\*\* worksheet \(scripts\/make_worksheet\.py\) sampled/, "Give a **10-question mixed diagnostic** sampled"],
        [/Record in progress\.json\. Then choose Day-1's target as the highest-marks-per-paper topic among her misses — but if before-after ratio is among them, it goes first \(it's her stated priority and it unlocks Fractions\/Percentage too\)\./, "The app records it. Then choose Day 1's target as the highest-marks-per-paper topic among the misses; if before-after ratio is among them, it usually goes first (it unlocks Fractions/Percentage too)."],
        [/\| 7 \| Thu 24 Sep \(English exam day — keep it to 20 min, evening, no new content\) \|/, "| 7 | (the day before; keep it to 20 min, no new content) |"],
        [/## Question generation rules \(keep it authentic to the 2026 papers\)/, "## Question generation rules (keep it authentic to the current format)"],
        [/Model every generated question on a real 2026 prelim item from `question_bank\.md` \(same structure, new numbers\/context\)\./, "Model every generated question on an archetype in `skill.json` (same structure, new numbers/context)."],
        [/Any question whose real-paper version has a figure gets a real figure from `scripts\/diagrams\.py`, delivered inside a PDF from `scripts\/make_worksheet\.py`\./, "Any question whose real-paper version has a figure gets a real figure."],
        [/Every worksheet has an answer key with \*\*method steps\*\*, not just answers, so a parent can mark it\./, "Every set has an answer key with **method steps**, not just answers, so a parent can mark it."],
      ],
      replace: {
        "Logging": "The app records every attempt with its topic, heuristic and what went wrong. `learner_summary()` gives the current weakness ranking (weighted by marks per paper and recent accuracy); use it to choose the next target and the review topics.",
      },
    },
  ],
  skillMd: (src, refs) => {
    const s = src.read("SKILL.md");
    const sec = (h: string) => sectionBody(s, h, "p6-maths SKILL.md");
    return [
      frontmatter("p6-maths", "Primary 6 / PSLE Mathematics tutor (Singapore MOE 2021 syllabus, 2026 PSLE format): fractions, ratio and before-after, percentage, angles, circles, volume, data, algebra, problem-solving heuristics. Load for any P6 maths question, worksheet, marking or revision plan."),
      "# P6 Maths (PSLE)",
      `Tutoring for the last stretch before PSLE Mathematics (MOE 2021 syllabus; the 2026 format is in \`references/exam-format.md\`). Two people may be talking to Kix: a parent (planning, marking, asking about the exam) or the learner (learning).

Make **one thing stick per session** and leave the learner feeling capable. Common gaps at the start: before-and-after ratio, long three-quantity ratio, rounding — plus whatever the diagnostic and the learner record show.`,
      `## How a session runs

1. **Orient (silently).** Read \`references/tutoring-method.md\`. Check \`learner_summary()\` for days left, what was last done and the top non-steady topic. A first session is the 10-question diagnostic.
2. **Warm-up recall (2–3 min).** Ask the learner to say from memory the hooks already learnt (e.g. the four Before-After types, the seven angle facts). Fill any gap warmly, then move on — do not re-teach here.
3. **One target.** Take the top non-steady topic. Open \`references/topic-playbooks.md\` (and \`references/heuristics.md\` for word problems) for that topic only. Teach in the *I do → we do → you do* pattern: one fully worked example where you name the method first, one done together with the learner talking, one done alone.
4. **Questions.** Base them on the archetypes in \`skill.json\` — the same structure as a real PSLE item, new numbers and context, solved by you first so the answer is clean. Anything with a figure needs a real figure; never ASCII. In chat, one question per message, then wait.
5. **Respond to the answer.** Right → name what was done well (the method, not "clever"). Wrong → find the step (read / set-up / compute / answered-the-wrong-thing), give the label-first hint ("this is a Total Unchanged one — what does that tell us?"), and let the learner retry before showing the solution. One correction at a time.
6. **Mixed review (5 min).** Two quick items from earlier topics.
7. **Close.** The learner states today's one-line hook. Tell them, in one sentence, what tomorrow is. Give the parent a two-line summary: what moved, what to watch.

Keep sessions to 25–40 minutes. If the learner is tired or frustrated, shrink the target or stop — in the final week, a short good session beats a long hard one.`,
      `## Generating questions

- Model each question on an archetype in \`skill.json\`, in the section format it would appear in: MCQ with 4 options and distractors built from common wrong methods; 2-mark short answer with an answer line and unit; 3–5 mark structured with parts and mark tags.
- Choose numbers so 1 unit is a whole number and answers are PSLE-clean. Solve it end-to-end before showing it. If it gets ugly, change the numbers.
- Sizes: teaching set 3 questions; test/review set 5–6 with 2 review items; diagnostic 10 mixed items; a short timed set 6–8. No full 100-mark mocks in the last week unless asked.`,
      "## Teaching the most-missed area: before-and-after\n\n" + sec("Teaching her weakest area"),
      "## Talking to the learner\n\n" + sec("Talking to her"),
      inMykx("references/tutoring-method.md"),
      referenceTable(refs, {
        "exam-format.md": "format, timing, marks, syllabus scope (Speed is gone), time budgeting",
        "heuristics.md": "any word problem: the strategies, with the four Before-After types through the Before/Change/After table",
        "topic-playbooks.md": "teaching a topic: must-know facts, memory hooks, step recipes, traps",
        "topic-stats.md": "choosing what to work on: marks per topic, priority tiers, what a real paper looks like",
        "tutoring-method.md": "every session start: principles, tone, session template, diagnostic, the default 7-day plan",
      }),
    ].join("\n\n");
  },
  post: [
    [/references\/tutoring_method\.md/g, "references/tutoring-method.md"],
    [/references\/topic_playbooks\.md/g, "references/topic-playbooks.md"],
    [/`heuristics\.md` §2; `topic_playbooks\.md` §5/, "`references/heuristics.md` §2; `references/topic-playbooks.md` §5"],
    [/Full guidance is in `tutoring_method\.md` — follow it\./, "Full guidance is in `references/tutoring-method.md` — follow it."],
    [/`topic_stats\.md`/g, "`topic-stats.md`"],
    [/the only slip was Irene's units weren't equal yet/, "the only slip was that the second person's units weren't equal yet"],
  ],
  itemSets: [],
  mapItems: () => [],
  excluded: ["references/question_bank.md", "references/chatgpt_setup.md", "references/worksheet_cookbook.md"],
};

// ─── Format: P3 English specs (sections of MCQ, cloze, editing, comprehension) ─

function posterText(p: Raw): string {
  const lines: string[] = [];
  if (p.presenter) lines.push(p.presenter);
  if (p.title) lines.push(`**${p.title}**`);
  if (p.tagline) lines.push(p.tagline);
  if (p.badge) lines.push(String(p.badge).replace(/\|/g, " "));
  for (const f of p.facts ?? []) lines.push(`${f.label}: ${f.value}`);
  if (p.banner) lines.push(`**${p.banner}**`);
  for (const b of p.boxes ?? []) lines.push(`- **${b.title}** (${b.sub ?? ""}): ${String(b.body ?? "").replace(/\n/g, " ")}`.replace(" ()", ""));
  if (p.wide_box) lines.push(`**${p.wide_box.title}** ${String(p.wide_box.body ?? "").replace(/\n/g, " ")}`);
  for (const f of p.footer ?? []) lines.push(f);
  return lines.join("\n");
}

function mapEnglish(set: ItemSetSpec, src: Source, prefix: string): ItemDraft[] {
  const d = src.json(set.from);
  const file = basename(set.from);
  const out: ItemDraft[] = [];
  let n = 0;
  const split = (tag: string) => {
    const [topic, subskill] = tag.split(".");
    return { topic, subskill };
  };
  const anchors = (s: string) => s.replace(/\[\[\*?([^#\]]+)#[^\]]+\]\]/g, "**$1**").replace(/in line \{line:[^}]+\}/g, "(in bold in the passage)");
  const push = (it: Raw, draft: Omit<ItemDraft, "id" | "qid" | "sourceFile" | "topic" | "subskill" | "difficulty" | "marks"> & { marks?: number; difficulty?: Difficulty }) => {
    n += 1;
    const q = `Q${n}`;
    out.push({
      id: itemId(prefix, set.set, q),
      qid: q,
      sourceFile: file,
      ...split(it.tag),
      difficulty: draft.difficulty ?? 2,
      marks: draft.marks ?? Number(it.marks ?? 1),
      ...draft,
      working: [...(draft.working ?? []), it.why, it.trap && `Watch out: ${it.trap}`].filter(Boolean) as string[],
    });
  };
  for (const s of d.sections) {
    const items: Raw[] = s.items ?? [];
    if (s.type === "mcq" || s.type === "visual_text") {
      const poster = s.type === "visual_text" ? posterText(s.poster) : undefined;
      for (const it of items) push(it, { type: "mcq", stem: it.stem, passage: poster, options: it.options, answer: Number(it.answer), figure_spec: s.poster ? { poster: s.poster } : undefined });
    } else if (s.type === "cloze_box") {
      let i = 0;
      const passage = String(s.passage).replace(/\{\}/g, () => `___(${++i})___`);
      items.forEach((it, k) => {
        const answer = optionNumber(it.answer, s.words);
        if (!answer) throw new Error(`${file}: cloze answer ${it.answer} not in word box`);
        push(it, { type: "mcq", stem: `Choose the word from the box for blank (${k + 1}).`, passage, options: s.words, answer });
      });
    } else if (s.type === "cloze_bracket") {
      const pairs: string[][] = [];
      let i = 0;
      const passage = String(s.passage).replace(/\{([^}]+)\}/g, (_m, inner: string) => {
        pairs.push(inner.split("|").map((x) => x.trim()));
        return `(${++i}) [${inner.split("|").map((x) => x.trim()).join(" / ")}]`;
      });
      items.forEach((it, k) => {
        const answer = optionNumber(it.answer, pairs[k]);
        if (!answer) throw new Error(`${file}: bracket answer ${it.answer} not in ${pairs[k]}`);
        push(it, { type: "mcq", stem: `Choose the correct word for (${k + 1}).`, passage, options: pairs[k], answer });
      });
    } else if (s.type === "cloze_open") {
      let i = 0;
      const passage = String(s.passage).replace(/\{\}/g, () => `___(${++i})___`);
      items.forEach((it, k) => push(it, { type: "short", stem: `Fill in blank (${k + 1}) with ONE suitable word.`, passage, answer: it.answer, accept: it.accept?.length ? it.accept : undefined }));
    } else if (s.type === "editing") {
      const marks: string[] = [];
      let i = 0;
      const passage = String(s.passage).replace(/\{([gsp])(?::([^}]*))?\}/g, (_m, kind: string, word: string | undefined) => {
        i += 1;
        if (kind === "p") {
          marks.push(`A punctuation mark is missing at (${i}). Write the missing punctuation mark.`);
          return ` (${i})`;
        }
        marks.push(kind === "s" ? `The word "${word}" at (${i}) is spelt wrongly. Write it correctly.` : `The word "${word}" at (${i}) has a grammar mistake. Write the correct word.`);
        return `${word} (${i})`;
      });
      items.forEach((it, k) => push(it, { type: "short", stem: marks[k], passage, answer: it.answer, accept: it.accept }));
    } else if (s.type === "synthesis") {
      for (const it of items)
        push(it, { type: "short", stem: `Rewrite the sentences as ONE sentence using the word given. Keep the meaning the same.\n\n${it.given}\n\n(${it.word})`, answer: it.answer, accept: it.accept, marking: it.mark_note ? [it.mark_note] : undefined });
    } else if (s.type === "word_order") {
      for (const it of items)
        push(it, { type: "short", stem: `Arrange the words to make a correct sentence. Remember the capital letter and the full stop.\n\n${it.chunks.map((c: string) => `[${c}]`).join("  ")}`, answer: it.answer, accept: it.accept, marking: it.mark_note ? [it.mark_note] : undefined });
    } else if (s.type === "comprehension") {
      const passage = anchors(`**${s.title}**\n\n${(Array.isArray(s.passage) ? s.passage : [s.passage]).join("\n\n")}`);
      for (const it of items) {
        if (it.kind === "mcq") push(it, { type: "mcq", stem: anchors(it.stem), passage, options: it.options, answer: Number(it.answer) });
        else if (it.kind === "true_false")
          for (const row of it.rows) push({ ...row, tag: it.tag }, { type: "mcq", stem: `True or false? ${row.text}`, passage, options: ["True", "False"], answer: row.answer ? 1 : 2 });
        else if (it.kind === "box") push(it, { type: "short", stem: anchors(it.stem), passage, answer: it.answer, accept: it.accept?.length ? it.accept : undefined });
        else if (it.kind === "word_meaning") {
          const opts: string[] = [];
          String(it.sentence).replace(/\{([A-D]):([^}]+)\}/g, (_m, _l: string, w: string) => {
            opts.push(w);
            return w;
          });
          const sentence = String(it.sentence).replace(/\{([A-D]):([^}]+)\}/g, "$2 ($1)");
          push(it, { type: "mcq", stem: `${sentence}\n\nWhich word means "${it.target}"?`, passage, options: opts, answer: Number(optionNumber(it.answer, opts)) });
        } else if (it.kind === "sequence")
          push(it, {
            type: "short",
            stem: `Number the events in the order they happened (1 = first).\n\n${it.events.map((e: string, k: number) => `${String.fromCharCode(65 + k)}. ${e}`).join("\n")}`,
            passage,
            answer: it.answer.join(", "),
          });
        else if (it.kind === "open" || it.kind === "two_part")
          push(it, { type: "open", stem: anchors(it.stem), passage, answer: it.answers ? it.answers.join(" ") : it.answer, accept: it.accept, marks: Number(it.marks ?? 2), marking: it.mark_note ? [it.mark_note] : undefined, difficulty: 3 });
        else throw new Error(`${file}: unknown comprehension kind ${it.kind}`);
      }
    } else throw new Error(`${file}: unknown section type ${s.type}`);
  }
  return out;
}

// ─── P3 English ─────────────────────────────────────────────────────────────

const P3ENG_TOPICS: SkillTopic[] = [
  { id: "language.grammar", title: "Grammar", weight: 0.369, source_tag: "grammar", subskills: ["tense_simple_present", "tense_simple_past", "tense_continuous", "tense_future", "tense_perfect", "verb_form", "sva", "pronoun_subject_object", "pronoun_possessive", "pronoun_reflexive", "demonstratives", "quantifiers", "prepositions", "connectors", "question_tags", "wh_questions", "modals", "indefinites", "punctuation"] },
  { id: "language.vocab", title: "Vocabulary", weight: 0.142, source_tag: "vocab", subskills: ["context_clues", "similes", "phrasal_verbs", "collective_nouns", "confusables", "word_class"] },
  { id: "language.spelling", title: "Spelling", weight: 0.037, source_tag: "spelling", subskills: ["spelling"] },
  { id: "language.sentence", title: "Synthesis and word order", weight: 0.063, source_tag: "sentence", subskills: ["synthesis", "word_order"] },
  { id: "reading.visual", title: "Visual text", weight: 0.09, source_tag: "visual", subskills: ["vt_purpose", "vt_details", "vt_traps"] },
  { id: "reading.comprehension", title: "Comprehension", weight: 0.299, source_tag: "comprehension", subskills: ["comp_literal", "comp_true_false", "comp_sequence", "comp_vocab", "comp_referent", "comp_phrase", "comp_feelings", "comp_inference"] },
];

/** From the blueprint's "Archetypes that repeat" and section table (built from school tables of specifications and papers). */
const P3ENG_ARCHETYPES: [string, string, string, number][] = [
  ["GR-1", "language.grammar", "Interrupted past action: was/were + -ing before 'when' + a short past event", 0.012],
  ["GR-2", "language.grammar", "Happening now: is/are + -ing with a 'right now' clue", 0.012],
  ["GR-3", "language.grammar", "Habit with every day / usually / always: simple present, -s for one", 0.012],
  ["GR-4", "language.grammar", "Past time marker elsewhere in the sentence", 0.012],
  ["GR-5", "language.grammar", "Helper verb (has to / must / can / did / does) + base verb", 0.012],
  ["GR-6", "language.grammar", "Subject-verb agreement traps: each / every / one of the, plural with 'of', 'this helps'", 0.016],
  ["GR-7", "language.grammar", "Demonstratives with a near/far clue", 0.012],
  ["GR-8", "language.grammar", "Quantifiers with countable vs uncountable nouns", 0.012],
  ["GR-9", "language.grammar", "Reflexive pronoun matching the doer", 0.012],
  ["GR-10", "language.grammar", "Possessive pronoun standing alone", 0.012],
  ["GR-11", "language.grammar", "Question tags: flip positive/negative, mirror the helper and tense", 0.012],
  ["GR-12", "language.grammar", "Prepositions of movement", 0.012],
  ["GR-13", "language.grammar", "Connectors: and, but, so, because, although, while, before, after", 0.012],
  ["GR-14", "language.grammar", "Word-box grammar cloze, very often personal pronouns", 0.08],
  ["GR-15", "language.grammar", "Underline-the-word cloze, very often subject-verb agreement", 0.08],
  ["VO-1", "language.vocab", "Clue-twin: the sentence contains a phrase that means the blank", 0.03],
  ["VO-2", "language.vocab", "Movement verbs chosen from manner clues", 0.02],
  ["VO-3", "language.vocab", "Feeling words chosen from the situation", 0.02],
  ["VO-4", "language.vocab", "Similes: as ___ as a ___", 0.012],
  ["VO-5", "language.vocab", "Phrasal verbs: the little word carries the meaning", 0.012],
  ["VO-6", "language.vocab", "Collective nouns", 0.008],
  ["VO-7", "language.vocab", "Vocabulary or comprehension cloze (word box or open)", 0.09],
  ["SP-1", "language.spelling", "Editing: spelling (bold), grammar (underlined), punctuation (circle)", 0.08],
  ["SE-1", "language.sentence", "Synthesis: join two sentences with a given connector", 0.05],
  ["SE-2", "language.sentence", "Word order: arrange chunks into one sentence", 0.02],
  ["VT-1", "reading.visual", "Who organises the event ('presents')", 0.016],
  ["VT-2", "reading.visual", "Date, time and venue details", 0.02],
  ["VT-3", "reading.visual", "Conditions: age, price, 'by' date, early bird", 0.02],
  ["VT-4", "reading.visual", "Which contact for which purpose", 0.012],
  ["VT-5", "reading.visual", "Which statement is NOT true", 0.016],
  ["VT-6", "reading.visual", "Main purpose of the poster", 0.012],
  ["CO-1", "reading.comprehension", "Literal: find and lift a stated fact", 0.06],
  ["CO-2", "reading.comprehension", "True/false, sometimes with a reason", 0.06],
  ["CO-3", "reading.comprehension", "Sequencing events", 0.028],
  ["CO-4", "reading.comprehension", "Word meaning: choose between two words, or find a word that means…", 0.032],
  ["CO-5", "reading.comprehension", "Referent: what does it / they / them refer to", 0.028],
  ["CO-6", "reading.comprehension", "Phrase lift with an exact word count", 0.032],
  ["CO-7", "reading.comprehension", "Feeling + reason (2 marks)", 0.032],
  ["CO-8", "reading.comprehension", "Two things (2 marks): two different ideas", 0.02],
  ["CO-9", "reading.comprehension", "Inference: why, how do we know, lesson learnt, character trait", 0.048],
];

const P3ENG: PackConfig = {
  id: "p3-english",
  sourceName: "p3-english-tutor",
  prefix: "p3eng",
  title: "P3 English (Paper 2)",
  description:
    "Primary 3 English Paper 2, Language Use and Comprehension (Singapore MOE English Language Syllabus 2020): grammar, vocabulary, cloze, editing, synthesis, visual text and comprehension. Named answering routines, memory hooks, game-like practice.",
  subject: "english",
  level: "P3",
  syllabus: "MOE English Language Syllabus 2020 (STELLAR 2.0), P3 Paper 2",
  language: "en-SG",
  agents: AGENTS_DEFAULT,
  licence: "Content CC BY-NC 4.0 (myKx); items, passages and posters original.",
  sources: [SOURCE_OWN, SOURCE_DERIVED],
  pronoun: "he",
  names: NAMES,
  topics: P3ENG_TOPICS,
  tagMap: tagMapOf(P3ENG_TOPICS),
  archetypes: () => P3ENG_ARCHETYPES.map(([id, topic, pattern, exam_weight]) => ({ id, topic, pattern, exam_weight })),
  references: [
    {
      from: "references/exam-blueprint.md",
      to: "exam-blueprint.md",
      title: "P3 English Paper 2 blueprint",
      pronoun: "he",
      edits: [
        [/P3 papers are set by each school, not by SEAB, so formats differ a little\.\nThis blueprint is built from 2026 tables of specifications that schools\npublished \(Jurong West, Elias Park, Admiralty, Yuhua, Evergreen, Henry Park\)\nplus the four 2025 papers in `past-papers-2025\.md`\./, "P3 papers are set by each school, not by SEAB, so formats differ a little.\nThis blueprint is built from tables of specifications that schools published\nplus recent school papers (kept as private reference)."],
        [/\*\*First thing to ask the parent:\*\* which school, and is there a copy of the\nschool's own table of specifications or a recent WA paper\? If yes, match its\nsection list exactly and edit the weights in `scripts\/tracker\.py`\./, "**First thing to check:** does the learner's profile record the school's own\nsection list (from its table of specifications or a recent WA paper)? If yes,\nmatch it exactly."],
        [/\*\*Paper 2 between [^*]*\*\*\. So in late October, Paper 2 is\nusually the only English paper left\. Ask for the exact date and pass it to\n`tracker\.py init --exam-date`\./, "**Paper 2 in the last two weeks of October**. So in late October, Paper 2 is\nusually the only English paper left. The learner's exact date is in their profile."],
        [/\*\*Comprehension question types\*\* \(see the table in `past-papers-2025\.md`\):/, "**Comprehension question types**:"],
      ],
    },
    {
      from: "references/syllabus-map.md",
      to: "syllabus-map.md",
      title: "Skill tags for P3 Paper 2",
      edits: [[/These tags are the contract between the tutor, `build_paper\.py` and\n`tracker\.py`\. Use them \*\*exactly\*\*; a misspelt tag is rejected by the tracker,\nand invented tags make the statistics meaningless\./, "These tags are the contract between the tutor, the items and the learner\nrecord (topic `language.grammar` + subskill `sva` is written `grammar.sva`\nhere). Use them **exactly**; invented tags make the statistics meaningless."]],
    },
    {
      from: "references/teaching-toolkit.md",
      to: "teaching-toolkit.md",
      title: "Teaching toolkit: one card per skill",
      edits: [
        [/\("Jordan", "both boys", "the books"\)/, '("Marcus", "both boys", "the books")'],
        [/\(only Jordan needed help, so one receiver: him\)/, "(only Marcus needed help, so one receiver: him)"],
        [/Words seen in 2025 papers:/, "Words that often appear in P3 papers:"],
        [/The question types\nand real examples are in `past-papers-2025\.md`, section 7\./, "The question types are in `exam-blueprint.md`."],
        [/"Aiden ran over to help ___\."/, '"Ethan ran over to help ___."'],
      ],
      // Grammar examples keep their he/him; only the coaching instructions become learner-neutral.
      post: [
        [/Make him do the gesture/, "Have the learner do the gesture"],
        [/Have him sketch:/, "Have the learner sketch:"],
        [/and have him draw the symbol/, "and have the learner draw the symbol"],
        [/He acts one, you guess, then swap\./, "The learner acts one, you guess, then swap."],
        [/Hook: ask him to draw/, "Hook: ask the learner to draw"],
      ],
    },
    {
      from: "references/answer-strategies.md",
      to: "answer-strategies.md",
      title: "How to answer: a routine for every section",
      post: [[/Predicting first means he tests the options against his own answer\./, "Predicting first means the learner tests the options against their own answer."]],
    },
    {
      from: "references/coaching-playbook.md",
      to: "coaching-playbook.md",
      title: "Coaching playbook: keeping a young learner switched on",
      pronoun: "he",
      edits: [
        [/^\w+ focuses when the material is [^\n]*\nisn't\./m, "Most nine-year-olds focus when the material is interesting and fun, and drift\nwhen it isn't."],
        [/`tracker\.py due` brings skills back after 1, 2, 4, 7 days, squeezed before the exam\./, "The learner record brings skills back after 1, 2, 4, 7 days, squeezed before the exam."],
        [/2–3 due items from `tracker\.py due`, out loud\./, "2–3 due items from `learner_summary()`, out loud."],
        [/Never use copyrighted characters \(no Pokémon, Minecraft or Marvel/, "Never use copyrighted characters (nothing from real games, films or comics"],
        [/Use `tracker\.py plan`, which switches mode automatically\. As a guide:/, "The exam date is in the learner's profile. As a guide:"],
      ],
      replace: {
        "7. Parent mode": "Kix knows who it is talking to: the learner in the kid app, the parent in the parent view.\n\n* **Parent:** be efficient and adult. Give the plan, the report, the one biggest fix. Offer a script they can read aloud to the learner if helpful.\n* **Learner:** game mode, one question at a time, short sentences, warm and playful.",
      },
      post: [[/`tracker\.py [a-z]+`/g, "the learner record"], [/\bthe tracker\b/gi, "the learner record"]],
    },
    {
      from: "references/question-generation.md",
      to: "question-generation.md",
      title: "Writing new P3 English items",
      pronoun: "he",
      drop: ["4. Building the PDF", "5. Spec schema", "6. Poster (visual text) spec", "7. Illustration items", "8. Visual QA"],
      edits: [
        [/Take an \*\*archetype\*\* \(from `exam-blueprint\.md` or `past-papers-2025\.md`\),/, "Take an **archetype** (from `skill.json` or `exam-blueprint.md`),"],
        [/Example archetype: \*interrupted past action\* \(AT Q3\)\.\n\* Original surface: "My family and I ___ at the mall when we spotted a crying child\."\n\* New surface: "Jordan and his dad ___ football at the field when it started to pour\."/, 'Example archetype: *interrupted past action*.\n* One surface: "My cousins ___ in the pool when the thunder started."\n* New surface: "Marcus and his dad ___ football at the field when it started to pour."'],
        [/Target the tracker's weakest tags\./, "Target the weakest tags in `learner_summary()`."],
      ],
    },
  ],
  skillMd: (src, refs) => {
    const s = src.read("SKILL.md");
    const sec = (h: string) => sectionBody(s, h, "p3-english SKILL.md");
    return [
      frontmatter("p3-english", "Primary 3 English Paper 2 tutor (Language Use and Comprehension, Singapore): grammar MCQ, vocabulary, cloze, editing, synthesis and word order, visual text, comprehension. Load for any P3 English question, practice set, marking or revision plan."),
      "# P3 English (Paper 2)",
      `Adaptive one-to-one coaching for **Paper 2: Language Use and Comprehension** (50 marks, 1 h 15 min), usually the last English paper of the P3 year. Young learners drift unless the work is interesting, so everything here is short, game-like and visual.

**Scope: Paper 2 only.** Composition, listening and oral are out of scope. If asked about them, say so in one line and offer Paper 2 help instead. Prepare for the common format in \`references/exam-blueprint.md\`, **including visual text and synthesis**, unless the learner's profile records the school's own section list.`,
      `## The adaptive loop

**Diagnose → teach at the broken rung → practise (retrieve, mix) → mark with a reason → type the error → log → schedule review.**

- **Diagnose.** Inside a session, use the ladder in each teaching card: R1 recognise, R2 apply, R3 produce or explain. Teach at the first rung that breaks. A first diagnostic covers grammar, words and reading in three short quests (one per sitting).
- **Teach.** Open the skill's card in \`references/teaching-toolkit.md\`. Use its hook first (a gesture, a drawing, a chant), show one worked example, then give two. Two new ideas per session at most. Use the learner's interests in sentences.
- **Practise and answer technique.** Teach the matching routine from \`references/answer-strategies.md\` by name (Clue Hunt, Find the Boss, Big–Small–Trap, Q-L-A, Marks = Ideas). Technique is the fastest source of marks before an exam, especially in comprehension.
- **Mark, type and log.** For every wrong answer, pick one error type: \`rule, clue, vocab, misread, evidence, incomplete, spelling, careless, blank\`. The type decides the fix (see the table in \`references/syllabus-map.md\`); the app records it.`,
      "## Chat rules with the learner\n\n" + sec("Chat rules"),
      `## Practice sets

1. Decide the target: the top skills from \`learner_summary()\`, plus 40% mixed review. Sizes: a **mission** is 12–25 marks (20–30 minutes); a **half paper** about 25 marks; a **full mock** is 50 marks in the school's format.
2. **Synthesise new items from the archetypes; do not copy school passages or questions.** Posters for visual text use real pictures and layout, never ASCII.
3. Run the quality checklist in \`references/question-generation.md\` on every item. Each answer must be the only defensible one, and every explanation names the clue.`,
      `## Marking

For open comprehension answers, apply the item's marking note: one mark per idea, lifted from the passage, spelling of key words correct. Feedback: total, one line per wrong answer (the clue missed), then **the single biggest fix** from the error pattern. Ask about any handwriting you can't read rather than guessing.

## Exam countdown

By days left (from the learner's profile): **normal** (more than 7), **sprint** (3–7: technique and the high-frequency grammar trio, one timed half-paper), **exam-eve** (0–1: easy wins only, no new learning, early bed). Details in \`references/coaching-playbook.md\` §8; the exam-day ritual is in \`references/answer-strategies.md\` §11.`,
      inMykx(),
      referenceTable(refs, {
        "exam-blueprint.md": "Paper 2 format, sections, timing, archetypes, depth limits",
        "syllabus-map.md": "the exact skill tags and error types",
        "teaching-toolkit.md": "how to teach each skill: rule, memory hook, 3-rung ladder, traps",
        "answer-strategies.md": "named answering routines per section, comprehension answer frames, exam-day ritual",
        "coaching-playbook.md": "session design, games, chat style for a 9-year-old, drift recovery, sprint plans",
        "question-generation.md": "writing new items: synthesis, item rules, quality checklist",
      }),
      "## Ground rules\n\n" + sec("Ground rules"),
    ].join("\n\n");
  },
  post: [
    [/\* \*\*Accuracy first\.\*\*[\s\S]*?Never teach those printed answers\./, "* **Accuracy first.** Check each answer by reading every option into the\n  sentence. Published keys sometimes contain wrong answers; check every key yourself."],
    [/Show XP from\s+the learner record at the end\./, "Show the stars earned at the end."],
    [/Show XP from\s*\n?\s*at the end\./, "Show the stars earned at the end."],
    [/\(playbook §6\)/, "(`references/coaching-playbook.md` §6)"],
  ],
  itemSets: [
    { from: "assets/specs/placement_quest.json", set: "placement-quest" },
    { from: "assets/specs/mission_01_find_the_boss.json", set: "mission-01" },
    { from: "assets/specs/mission_02_space_detectives.json", set: "mission-02" },
  ],
  mapItems: (set, src) => mapEnglish(set, src, "p3eng"),
  excluded: ["references/past-papers-2025.md", "PORTABLE.md"],
};

// ─── P3 Chinese ─────────────────────────────────────────────────────────────

const P3CHI_TOPICS: SkillTopic[] = [
  { id: "words.catalogue", title: "Lesson words (识读字 / 识写字)", weight: 0, source_tag: "words", subskills: ["recognise", "write"] },
  { id: "paper2.bianzi", title: "辨字测验 character discrimination", weight: 0.05, source_tag: "辨字", subskills: ["char_choice"] },
  { id: "paper2.ciyu", title: "词语选择 vocabulary", weight: 0.04, source_tag: "词语选择", subskills: ["word_choice"] },
  { id: "paper2.kantu", title: "看图选词 picture to word", weight: 0.04, source_tag: "看图选词", subskills: ["picture_word"] },
  { id: "paper2.dapei", title: "词语搭配 collocation", weight: 0.05, source_tag: "词语搭配", subskills: ["collocation"] },
  { id: "paper2.zuju", title: "组句成段 sequencing", weight: 0.05, source_tag: "组句成段", subskills: ["sequencing"] },
  { id: "paper2.juzi", title: "扩写／仿写／组合句子 sentence work", weight: 0.1, source_tag: "句子", subskills: ["expand", "imitate", "combine"] },
  { id: "paper2.yuedu", title: "阅读理解 reading comprehension", weight: 0.12, source_tag: "阅读理解", subskills: ["rc_mcq", "rc_open"] },
  { id: "composition.kantu", title: "作文 看图写段 picture composition", weight: 0.15, source_tag: "作文", subskills: ["picture_composition"] },
  { id: "oral", title: "口试 oral", weight: 0.3, source_tag: "口试", subskills: ["reading_aloud", "picture_talk", "conversation"] },
  { id: "listening", title: "听力 listening", weight: 0.1, source_tag: "听力", subskills: ["listening"] },
];

const P3CHI_SKILL: Record<string, [string, string]> = {
  辨字: ["paper2.bianzi", "char_choice"],
  词语选择: ["paper2.ciyu", "word_choice"],
  看图选词: ["paper2.kantu", "picture_word"],
  词语搭配: ["paper2.dapei", "collocation"],
  组句成段: ["paper2.zuju", "sequencing"],
  扩写句子: ["paper2.juzi", "expand"],
  仿写句子: ["paper2.juzi", "imitate"],
  组合句子: ["paper2.juzi", "combine"],
  阅读理解MCQ: ["paper2.yuedu", "rc_mcq"],
  理解问答: ["paper2.yuedu", "rc_open"],
};

function chineseIcon(src: Source, id: string): string {
  const manifest = src.json("assets/icons/manifest.json");
  const file = manifest[id]?.file;
  if (!file) throw new Error(`p3-chinese: no icon ${id}`);
  return `assets/icons/${file}`;
}

function mapChinese(set: ItemSetSpec, src: Source, prefix: string): ItemDraft[] {
  const file = basename(set.from);
  const out: ItemDraft[] = [];
  if (set.from === "assets/wordlist.json") {
    for (const lesson of src.json(set.from).lessons) {
      lesson.characters.forEach((c: Raw, i: number) => {
        out.push({
          id: itemId(prefix, set.set, `l${lesson.lesson}-${String(i + 1).padStart(2, "0")}`),
          qid: `L${lesson.lesson}/${c.char}`,
          sourceFile: file,
          topic: "words.catalogue",
          subskill: c.write ? "write" : "recognise",
          difficulty: 1,
          marks: 1,
          type: "card",
          stem: c.char,
          answer: `${c.pinyin} — ${c.gloss}`,
          card: { pinyin: c.pinyin, meaning: c.gloss, lesson: lesson.lesson },
        });
      });
    }
    return out;
  }
  const d = src.json(set.from);
  for (const s of d.sections) {
    if (s.type === "flashcards" || s.type === "dictation") {
      (s.items as Raw[]).forEach((it, i) => {
        out.push({
          id: itemId(prefix, set.set, `${s.type}-${i + 1}`),
          qid: `${s.type}#${i + 1}`,
          sourceFile: file,
          topic: "words.catalogue",
          subskill: s.type === "dictation" ? "write" : "recognise",
          difficulty: 1,
          marks: 1,
          type: "card",
          stem: s.type === "dictation" ? `${it.pinyin}` : it.word,
          answer: s.type === "dictation" ? it.word : `${it.pinyin ? `${it.pinyin} — ` : ""}${it.meaning}`,
          card: { pinyin: it.pinyin || undefined, meaning: it.meaning },
          figureSrc: it.icon ? chineseIcon(src, it.icon) : undefined,
        });
      });
      continue;
    }
    for (const q of s.questions ?? []) {
      const map = P3CHI_SKILL[q.skill];
      if (!map) throw new Error(`${file} ${q.id}: unknown skill ${q.skill}`);
      const base = {
        id: itemId(prefix, set.set, q.id),
        qid: q.id,
        sourceFile: file,
        topic: map[0],
        subskill: map[1],
        difficulty: 2 as Difficulty,
        working: [q.explain],
      };
      const passage = s.passage ? [s.note_header, s.passage, s.note_footer].filter(Boolean).join("\n\n") : undefined;
      const options: string[] | undefined = q.options ?? (s.type === "collocation" ? s.bank : undefined);
      if (options) {
        const answer = optionNumber(q.answer, options);
        if (!answer) throw new Error(`${file} ${q.id}: bad answer`);
        const distractors: Record<string, string> = {};
        for (const [word, why] of Object.entries((q.why_wrong ?? {}) as Record<string, string>)) {
          const k = options.indexOf(word);
          if (k >= 0) distractors[String(k + 1)] = why;
        }
        const visual = q.visual;
        out.push({
          ...base,
          marks: Number(q.marks ?? 1),
          type: "mcq",
          stem: [s.instruction, q.stem].filter(Boolean).join("\n\n"),
          passage,
          options,
          answer,
          distractors: Object.keys(distractors).length ? distractors : undefined,
          figureSrc: visual?.icon ? chineseIcon(src, visual.icon) : undefined,
          figure_spec: visual && !visual.icon ? visual : undefined,
        });
      } else if (s.type === "sequence") {
        out.push({
          ...base,
          marks: 5,
          type: "short",
          stem: `${s.instruction}\n\n${q.sentences.map((t: string, k: number) => `(${String.fromCharCode(65 + k)}) ${t}`).join("\n")}${q.fixed ? `\n\n（第一句和最后一句已经给了：${Object.entries(q.fixed).map(([k, v]) => `(${String.fromCharCode(65 + Number(k))}) = ${v}`).join("，")}）` : ""}`,
          answer: q.answer.join(", "),
          marking: ["Write the position (1–7) of each sentence, in the order (A)…(G)."],
        });
      } else {
        const prompt = Array.isArray(q.prompt) ? q.prompt.join("\n") : q.prompt;
        out.push({
          ...base,
          marks: Number(q.marks ?? 2),
          type: "open",
          stem: [q.instruction ?? s.instruction, prompt ?? q.stem].filter(Boolean).join("\n\n"),
          passage,
          answer: String(q.answer),
          marking: q.marking,
        });
      }
    }
  }
  return out;
}

function p3chiArchetypes(src: Source): Archetype[] {
  const body = sectionBody(src.read("references/question-bank.md"), "6. Archetype notes", "p3-chinese archetypes");
  const sectionTopic: Record<string, string> = {
    辨字: "paper2.bianzi",
    词语选择: "paper2.ciyu",
    看图选词: "paper2.kantu",
    词语搭配: "paper2.dapei",
    组句成段: "paper2.zuju",
    扩写: "paper2.juzi",
    组合: "paper2.juzi",
    仿写: "paper2.juzi",
    阅读理解一: "paper2.yuedu",
    理解问答: "paper2.yuedu",
    作文: "composition.kantu",
  };
  const rows: { topic: string; pattern: string; section: string }[] = [];
  for (const line of body.split("\n")) {
    const m = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/.exec(line);
    if (!m || !sectionTopic[m[1]]) continue;
    const overrides: Record<string, string> = {
      理解问答: "a family, helping-at-home or holiday passage; describe (copy), why (因为…), 从哪里可以看出 (quote), what next (opinion)",
      作文: "4 pictures: a problem, a consequence, help or a realisation, a resolution; a personal-responsibility theme",
    };
    const pattern = overrides[m[1]] ?? m[2].replace(/\s*[(（][^)）]*[)）]/g, "").split(/[:：]/)[0].replace(/\s+/g, " ").trim();
    rows.push({ topic: sectionTopic[m[1]], pattern: `${m[1]}: ${pattern}`, section: m[1] });
  }
  return rows.map((r, i) => {
    const topic = P3CHI_TOPICS.find((t) => t.id === r.topic) as SkillTopic;
    const n = rows.filter((x) => x.topic === r.topic).length;
    return { id: `ZH-${i + 1}`, topic: r.topic, pattern: r.pattern.slice(0, 240), exam_weight: round(topic.weight / n) };
  });
}

const P3CHI: PackConfig = {
  id: "p3-chinese",
  sourceName: "p3-chinese-tutor-jordan",
  prefix: "p3chi",
  title: "P3 Chinese",
  description:
    "Primary 3 Chinese (Singapore MOE 2024 syllabus, 欢乐伙伴): the 15-lesson word catalogue with pinyin and meanings, Paper 2 technique section by section, oral and composition. English-first explanations around Chinese content, picture word cards.",
  subject: "chinese",
  level: "P3",
  syllabus: "MOE 小学华文课程标准 2024 (P3, 欢乐伙伴)",
  language: "zh-Hans",
  agents: AGENTS_DEFAULT,
  licence: "Content CC BY-NC 4.0 (myKx); word icons Twemoji CC-BY 4.0.",
  attributions: ["Twemoji graphics by Twitter, Inc. and other contributors, CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/); rasterised to 320 px, otherwise unchanged."],
  sources: [SOURCE_OWN, SOURCE_DERIVED],
  pronoun: "he",
  names: NAMES,
  topics: P3CHI_TOPICS,
  tagMap: Object.fromEntries(P3CHI_TOPICS.map((t) => [t.id, t.id])),
  archetypes: p3chiArchetypes,
  references: [
    {
      from: "references/exam-blueprint.md",
      to: "exam-blueprint.md",
      title: "Exam blueprint: P3 Chinese end-of-year",
      pronoun: "he",
      edits: [
        [/Sources: three 2025 EOY papers \(Henry Park, ACS\(P\), ACS\(J\)\), the CHIJ Katong P3 EOY\ntable of specifications, St Gabriel's 2026 P3 assessment plan, and the MOE \*小学华文课程标准 2024\*\.\nJensen's cohort \(P1 in 2024\) is the first P3 on the 2024 syllabus; the paper format did\nnot change from 2025,/, "Sources: recent school end-of-year papers, tables of specifications and assessment plans\n(kept as private reference), and the MOE *小学华文课程标准 2024*. The 2026 P3 cohort (P1 in\n2024) is the first P3 on the 2024 syllabus; the paper format did not change,"],
      ],
    },
    {
      from: "references/word-catalogue.md",
      to: "word-catalogue.md",
      title: "Word catalogue: Lessons 1–15",
      edits: [
        [/Pinyin, glosses and the drill compounds for L1–9 and L14–15 were added by the tutor; compounds for\nL10–13 are the school's own list\. Machine-readable copy: `assets\/wordlist\.json` \(used by `tracker\.py quiz`\)\./, "Pinyin, glosses and the drill compounds for L1–9 and L14–15 were added by the tutor; compounds for\nL10–13 follow a school list. Every character is also a word card in `items/word-cards.json`."],
      ],
    },
    {
      from: "references/coaching-playbook.md",
      to: "coaching-playbook.md",
      title: "Coaching playbook: engaged, short, and it sticks",
      pronoun: "he",
      edits: [
        [/^\w+ is Primary 3, [^\n]* the moment material feels like a/m, "Many P3 learners think in English and drift the moment material feels like a"],
        [/\*\*Sentence Lego\*\*/, "**Sentence Blocks**"],
        [/5 words due from the tracker, said aloud, no notes/, "5 words due (from `learner_summary()`), said aloud, no notes"],
        [/tracker log, print the progress card for next time/, "the app logs it; give the parent summary"],
      ],
      post: [
        [/\s?\(`tracker\.py log … ,meaning`\)/, ""],
        [/Then the progress card \(`tracker\.py card`\) — it travels to any assistant\./, ""],
        [/Then the progress card — it travels to any assistant\./, ""],
        [/`tracker\.py [a-z]+`/g, "the learner record"],
        [/\bthe tracker\b/g, "the learner record"],
      ],
    },
    {
      from: "references/question-generation.md",
      to: "question-generation.md",
      title: "Writing new P3 Chinese items",
      pronoun: "he",
      drop: ["2. Spec format", "3. Visuals", "4. Typical requests"],
      edits: [
        [/^# Generating practice papers\n[\s\S]*?(?=\n## 1\. )/, "# Generating practice papers\n"],
        [/1\. \*\*Start from his tracker, not from a paper\.\*\*[^\n]*/, "1. **Start from the learner record, not from a paper.** `learner_summary()` says which sections carry the most recoverable marks, and which lessons and error types need work. A practice set this week should over-weight those."],
        [/from `question-bank\.md` §6 — e\.g\./, "from the archetypes in `skill.json` — e.g."],
        [/come from `assets\/wordlist\.json`/, "come from the word catalogue (`references/word-catalogue.md`)"],
      ],
    },
  ],
  skillMd: (src, refs) => {
    const s = src.read("SKILL.md");
    const sec = (h: string) => sectionBody(s, h, "p3-chinese SKILL.md");
    return [
      frontmatter("p3-chinese", "Primary 3 Chinese tutor (Singapore MOE 2024 syllabus, 欢乐伙伴): the Lessons 1–15 word catalogue (识读字, 识写字, pinyin, meanings), Paper 2 sections (辨字, 词语, 看图选词, 搭配, 组句成段, 句子, 阅读理解), oral and composition. Load for any P3 Chinese practice, 听写, word cards or revision."),
      "# P3 Chinese",
      `Coaching for Primary 3 Chinese in Singapore (MOE 2024 syllabus), building towards the school end-of-year exam. Many learners think in English, find small print hard, and lose interest fast unless the work is fun and short. Build for that: English explanations around Chinese content, pictures and games, 5–7 minute blocks, a visible finish line, and the learner record so nothing depends on anyone's memory.

**Scope is the 15-lesson list** in \`references/word-catalogue.md\` (253 识读字 / 192 识写字), also available as word cards. It differs from the old 2015 textbook list — do not drift to that. The exam format is in \`references/exam-blueprint.md\`: Oral 30 · Listening 10 · Composition 15 · Paper 2 45 (8 sections).`,
      `## Every session

\`\`\`
5 due words aloud (2 min)  →  name the target + finish time  →
block A: diagnose → teach ONE idea → test now  →  1-min switch  →
block B: a different section  →  end on a win  →  parent summary
\`\`\`

- \`learner_summary()\` first: it ranks sections by exam marks × gap to 80%, untested sections first.
- Word drills use the word cards (\`find_items("words.catalogue", …)\`): due ones first, then new; for 听写 the card shows pinyin and the learner writes the word.
- First session (or no history): a 10-minute diagnostic, one question per Paper 2 section plus 6 words. A number per section, not an impression.`,
      "## How to teach\n\n" + sec("How to teach him"),
      "## Where the marks are, and the technique for each\n\n" + sec("Where the marks are"),
      `## Generating practice material

Every picture question must have a real picture (the pack's word icons, or a trusted image).

1. Decide the target from \`learner_summary()\` (sections, lessons, error types).
2. **Synthesise, don't copy.** Take an archetype from \`skill.json\` and change the surface — a different catalogue word, a new sentence, plausible distractors (same sound / same component / same category). Passages may use P1–P2 characters; give pinyin for harder ones.
3. Large print: never below 14 pt for the learner. Details: \`references/question-generation.md\`.`,
      "## Marking\n\n" + sec("Marking his work"),
      inMykx(),
      referenceTable(refs, {
        "exam-blueprint.md": "before teaching or writing questions for any section: format, technique, templates, marking",
        "word-catalogue.md": "choosing words to drill or to build questions from (per lesson, pinyin, gloss, compounds)",
        "coaching-playbook.md": "session shape, games, memory techniques, error types, feedback wording",
        "question-generation.md": "how to synthesise new questions from archetypes",
      }),
      "## What not to do\n\n" + sec("What not to do"),
    ].join("\n\n");
  },
  post: [
    [/- Don't skip the log or the card — the next session depends on them, in any assistant\.\n?/, ""],
    [/- Don't describe a picture in words or draw ASCII — build the PDF\./, "- Don't describe a picture in words or draw ASCII — use a real picture."],
  ],
  itemSets: [
    { from: "assets/wordlist.json", set: "word-cards" },
    { from: "assets/specs/cards_L10_L11.json", set: "cards-l10-l11" },
    { from: "assets/specs/mock01_paper2.json", set: "mock-01-paper2" },
  ],
  mapItems: (set, src) => mapChinese(set, src, "p3chi"),
  excluded: ["references/question-bank.md", "PORTABLE.md", "assets/fonts/P3Kai-Regular.ttf", "assets/fonts/P3Sans-Bold.ttf", "assets/specs/oral01.json", "assets/specs/compo01_paper1.json"],
};

// ─── P6 (PSLE) Science ──────────────────────────────────────────────────────

const P6SCI_TOPICS: SkillTopic[] = [
  { id: "interactions.environment", title: "Interactions within the environment", weight: 0.161, source_tag: "INT-ENV", subskills: ["food_chains_webs", "populations", "adaptations", "human_impact", "experimental_skills", "survival_factors"] },
  { id: "interactions.forces", title: "Forces and magnets", weight: 0.133, source_tag: "INT-FORCE", subskills: ["identify_forces", "friction", "springs", "gravity", "magnets", "experimental_skills"] },
  { id: "systems.electrical", title: "Electrical system", weight: 0.093, source_tag: "SYS-ELEC", subskills: ["circuits_from_observations", "series_parallel", "conductors_testers", "draw_circuit", "electrical_safety", "experimental_skills"] },
  { id: "systems.human", title: "Human systems", weight: 0.079, source_tag: "SYS-HUMAN", subskills: ["digestive", "respiratory_circulatory", "systems_together", "experimental_skills", "body_systems"] },
  { id: "cycles.reproduction", title: "Reproduction in plants and humans", weight: 0.073, source_tag: "CYC-REPRO", subskills: ["pollination_fertilisation", "flower_parts", "seed_dispersal", "germination", "human_reproduction", "experimental_skills", "spores_and_seeds", "cells_and_inheritance"] },
  { id: "cycles.water", title: "Water and changes of state", weight: 0.066, source_tag: "CYC-WATER", subskills: ["temperature_time_graphs", "condensation", "evaporation", "water_cycle", "experimental_skills", "water_pollution"] },
  { id: "energy.conversion", title: "Energy forms and conversion", weight: 0.065, source_tag: "ENE-CONV", subskills: ["energy_chains", "gpe_ke", "energy_graphs", "experimental_skills", "energy_sources"] },
  { id: "energy.photosynthesis", title: "Photosynthesis", weight: 0.062, source_tag: "ENE-PHOTO", subskills: ["photosynthesis_conditions", "gas_exchange", "experimental_skills", "energy_from_food"] },
  { id: "energy.heat", title: "Heat", weight: 0.058, source_tag: "ENE-HEAT", subskills: ["heat_flow", "conductors_insulators", "expansion_contraction", "heat_vs_temperature", "experimental_skills"] },
  { id: "cycles.matter", title: "Matter", weight: 0.051, source_tag: "CYC-MATTER", subskills: ["states_of_matter", "air_mass_volume", "experimental_skills", "measure_mass_volume"] },
  { id: "systems.plant", title: "Plant system", weight: 0.046, source_tag: "SYS-PLANT", subskills: ["plant_parts", "transport_tubes", "ringing", "experimental_skills"] },
  { id: "diversity.living", title: "Living things and classification", weight: 0.031, source_tag: "DIV-LIV", subskills: ["classification", "fungi_bacteria", "experimental_skills", "living_characteristics"] },
  { id: "energy.light", title: "Light", weight: 0.031, source_tag: "ENE-LIGHT", subskills: ["shadows", "reflection", "transparency", "experimental_skills"] },
  { id: "cycles.life", title: "Life cycles", weight: 0.024, source_tag: "CYC-LIFE", subskills: ["insect_cycles", "plant_growth", "duration_graphs"] },
  { id: "diversity.materials", title: "Materials", weight: 0.024, source_tag: "DIV-MAT", subskills: ["material_properties", "experimental_skills"] },
];

/** The example papers tag topics only; each item's subskill is chosen here. */
const P6SCI_SUBSKILL: Record<string, string> = {
  "example_paper.json#1": "circuits_from_observations",
  "example_paper.json#2": "series_parallel",
  "example_paper.json#3": "populations",
  "example_paper.json#4": "temperature_time_graphs",
  "example_paper.json#5": "springs",
  "example_paper.json#6": "photosynthesis_conditions",
  "example_paper.json#7": "flower_parts",
  "example_paper.json#8": "insect_cycles",
  "example_paper.json#31": "conductors_insulators",
  "example_paper.json#32": "food_chains_webs",
  "example_paper_2.json#1": "magnets",
  "example_paper_2.json#2": "magnets",
  "example_paper_2.json#3": "energy_graphs",
  "example_paper_2.json#4": "energy_chains",
  "example_paper_2.json#5": "populations",
  "example_paper_2.json#6": "adaptations",
  "example_paper_2.json#7": "series_parallel",
  "example_paper_2.json#8": "springs",
  "example_paper_2.json#31": "adaptations",
  "example_paper_2.json#32": "gpe_ke",
  "example_paper_2.json#33": "series_parallel",
};

function mapPsleScience(set: ItemSetSpec, src: Source, prefix: string): ItemDraft[] {
  const d = src.json(set.from);
  const file = basename(set.from);
  const out: ItemDraft[] = [];
  for (const q of d.questions) {
    const topic = P6SCI_TOPICS.find((t) => t.source_tag === q.topic);
    if (!topic) throw new Error(`${file} ${q.id}: unknown topic ${q.topic}`);
    const subskill = P6SCI_SUBSKILL[`${file}#${q.id}`] ?? topic.subskills[0];
    const stem = [q.stem, q.table ? mdTable(q.table) : "", q.after_figure ?? ""].filter(Boolean).join("\n\n");
    const spec = q.figure ? { stem: [q.figure] } : undefined;
    if (q.type === "mcq") {
      out.push({
        id: itemId(prefix, set.set, `q${q.id}`),
        qid: `Q${q.id}`,
        sourceFile: file,
        topic: topic.source_tag as string,
        subskill,
        difficulty: 3,
        marks: Number(q.marks ?? 2),
        type: "mcq",
        stem,
        options: q.options,
        answer: Number(q.answer),
        working: [q.explanation, q.trap && `Watch out: ${q.trap}`],
        figure_spec: spec,
      });
    } else {
      for (const p of q.parts) {
        out.push({
          id: itemId(prefix, set.set, `q${q.id}${p.label}`),
          qid: `Q${q.id}(${p.label})`,
          sourceFile: file,
          topic: topic.source_tag as string,
          subskill,
          difficulty: 3,
          marks: Number(p.marks ?? 1),
          type: "open",
          stem: `${stem}\n\n(${p.label}) ${p.text}${p.sub_table ? `\n\n${mdTable(p.sub_table)}` : ""}`,
          answer: joinAnswer(p.answer),
          marking: p.marking ? [String(p.marking)] : undefined,
          figure_spec: spec,
        });
      }
    }
  }
  return out;
}

function p6sciArchetypes(src: Source): Archetype[] {
  const body = sectionBody(src.read("references/topic_stats.md"), "Recurring sub-skills per topic", "p6-science archetypes");
  const codeTopic: Record<string, string> = Object.fromEntries(P6SCI_TOPICS.map((t) => [t.source_tag as string, t.id]));
  codeTopic["DIV"] = "diversity.living";
  codeTopic["ENE-PHOTO / SYS-PLANT"] = "energy.photosynthesis";
  const out: Archetype[] = [];
  for (const line of body.split("\n")) {
    const m = /^- \*\*([A-Z /-]+)\*\*:\s*(.+)$/.exec(line);
    if (!m) continue;
    const topicId = codeTopic[m[1].trim()];
    if (!topicId) throw new Error(`p6-science archetypes: unknown code ${m[1]}`);
    const topic = P6SCI_TOPICS.find((t) => t.id === topicId) as SkillTopic;
    const parts = m[2].replace(/\.$/, "").split(/;\s+/).map((p) => p.trim()).filter(Boolean);
    const code = m[1].split(" ")[0];
    parts.forEach((p, i) =>
      out.push({ id: `${code}-${i + 1}`, topic: topicId, pattern: (p[0].toUpperCase() + p.slice(1)).replace(/\*\*/g, "").slice(0, 240), exam_weight: round(topic.weight / parts.length) }),
    );
  }
  return out;
}

const P6SCI: PackConfig = {
  id: "p6-science",
  sourceName: "psle-science-tutor",
  prefix: "p6sci",
  title: "P6 Science (PSLE)",
  description:
    "Primary 6 / PSLE Science (Singapore MOE 2023 syllabus, 2026 format): all P3–P6 themes, with concept cards in the marker's words, the C.E.R. answer spine, misconceptions, experimental skills and statistically targeted practice.",
  subject: "science",
  level: "P6",
  syllabus: "MOE Primary Science syllabus 2023 (Standard; updated Jan 2026); PSLE Science 0009 (from 2026)",
  language: "en",
  agents: AGENTS_DEFAULT,
  licence: "Content CC BY-NC 4.0 (myKx).",
  sources: [SOURCE_OWN, SOURCE_DERIVED],
  pronoun: "she",
  names: NAMES,
  topics: P6SCI_TOPICS,
  tagMap: tagMapOf(P6SCI_TOPICS),
  archetypes: p6sciArchetypes,
  references: [
    {
      from: "references/syllabus_2026.md",
      to: "syllabus.md",
      title: "PSLE Science: syllabus, format and wording",
      pronoun: "she",
      edits: [
        [/Verified [^\n]* against SEAB's/, "Checked against SEAB's"],
        [/- \*\*Date:\*\* [^\n]*\(one sitting, 1 h 45 min\)\./, "- **One sitting, 1 h 45 min.** The learner's exam date is in their profile."],
        [/\(seen in every 2026 prelim: e\.g\. ACSJ Q22–23,\n  Tao Nan Q23–24, CHS Q12–13 and Q21–22\)/, "(seen in recent school papers)"],
        [/ \(e\.g\. [A-Z]\w+ [A-Z]\w+ Common Test Q4\)/, ""],
        [/## Marks per theme \(school planning documents, e\.g\. Tao Nan 2023 P6 curriculum sheet\)/, "## Marks per theme (school planning documents)"],
        [/These match the 2026 prelim corpus \(see topic_stats\.md\)\./, "These match the school-paper statistics (see `topic-stats.md`)."],
      ],
    },
    {
      from: "references/concept_cards.md",
      to: "concept-cards.md",
      title: "Concept cards: every fact, in the words the marker wants",
      pronoun: "she",
      edits: [
        // The last section copies a tuition centre's notes: dropped by shape, without naming the centre.
        [/\n## [^\n]*filled-in blanks[^\n]*\n[\s\S]*$/, "\n"],
        [/\(see syllabus_2026\.md\)\. Sources: MOE\/SEAB, six 2026 prelims and their answer keys, [^\n]*\n[^\n]*\(filled-in answers\), 2025 PSLE analyses\./, "(see `syllabus.md`). Sources: MOE/SEAB documents, recent school papers and their answer keys (private\nreference), and published analyses of recent PSLE papers."],
      ],
    },
    {
      from: "references/answer_techniques.md",
      to: "answer-techniques.md",
      title: "Answering techniques: how marks are won",
      pronoun: "she",
      drop: ["Marker comments captured"],
      edits: [
        [/Built from six 2026 prelim marking schemes \(Ai Tong and Tao Nan publish marker comments\), SEAB's\nassessment objectives, and the published analyses of the 2024–2025 PSLE papers\./, "Built from school marking schemes (private reference), SEAB's assessment objectives, and\npublished analyses of recent PSLE papers."],
        [/MCQ-specific traps seen repeatedly in 2026 prelims:/, "MCQ-specific traps seen repeatedly in school papers:"],
        [/\(otah\/banana leaf, bus with plants, cruise golf balls\)/, "(food parcels, plants on a bus, balls on a ship deck)"],
        [/## 4\. The misconception list \(each one has cost marks in a 2026 prelim\)/, "## 4. The misconception list (each one has cost marks in school papers)"],
      ],
    },
    {
      from: "references/memory_strategies.md",
      to: "memory-strategies.md",
      title: "Memory strategies (evidence-based, low pressure)",
      pronoun: "she",
      edits: [
        [/ \w+ should never be told she is "\w+"; she is told her\nbrain keeps what it \*uses\*\./, " A learner is never labelled; they are told the brain keeps\nwhat it *uses*."],
        [/## B\. Spacing schedule inside a 12-day window \(exam [^)]*\)/, "## B. Spacing schedule inside a 12-day window"],
        [/- The paper generator \(scripts\/make_paper\.py\) exists for this: real diagrams, not text\./, "- Use real diagrams, not text."],
        [/Keep an "Oops book" \(profile `error_log`\)/, "Keep an \"Oops book\" (the learner record's error log)"],
        [/4\. Mark the item in the profile as `learning`\./, "4. The app marks the item as `learning`."],
      ],
    },
    {
      from: "references/tutoring_protocol.md",
      to: "tutoring-protocol.md",
      title: "Tutoring protocol: diagnose, target, repair, retain",
      pronoun: "she",
      drop: ["4. Generating a printable paper", "5. Progress card"],
      dropColumns: ["Date"],
      replace: {
        "0. Who is in the chat?": "Kix knows whether it is talking to the **parent** (planning, reports, papers to print) or to the **learner** (a session). Tone shifts: crisp and data-led for the parent; warm, short sentences and one question at a time for the learner. With no history in the learner record, start with the diagnostic.",
      },
      edits: [
        [/## 2\. Session structure \(20–30 min, every day until [^)]*\)/, "## 2. Session structure (20–30 min a day)"],
        [/6\. \*\*Update the profile\*\* and print\/say the "progress card" \(see §5\)\./, "6. **Close:** the app updates the learner record; give the parent a two-line summary."],
        [/## 6\. Twelve-day plan \([^)]*\)/, "## 6. Twelve-day plan (the last 12 days before the exam)"],
        [/\(adapt to profile\)/, "(adapt to the learner record)"],
        [/"ask her why the cold Milo can sweats"/, "\"ask her why a cold drink can sweats\""],
        [/mix from topic_stats\.md/, "mix from `topic-stats.md`"],
      ],
    },
    {
      from: "references/topic_stats.md",
      to: "topic-stats.md",
      title: "Topic statistics: where the marks are",
      pronoun: "she",
      drop: ["Linked MCQ pairs found", "Cross-check with the actual 2025 PSLE paper"],
      edits: [
        [/# Topic statistics — six 2026 P6 Science Prelims \(ACSJ, Ai Tong, Catholic High, MGS, Red Swastika, Tao Nan\)/, "# Topic statistics\n\nFrom six recent P6 school papers in the new format, kept as private reference; only counts are kept here."],
        [/Blend of \(a\) six 2026 prelims and \(b\) 2025 PSLE\./, "Blend of the school-paper statistics and the most recent PSLE."],
        [/## Recurring sub-skills per topic \(what the six prelims actually asked\)/, "## Recurring sub-skills per topic (what recent school papers actually asked)"],
        [/≈18 marks\/paper in prelims, 11 in real PSLE/, "≈18 marks/paper in school papers, about 11 in the PSLE"],
      ],
    },
  ],
  skillMd: (src, refs) => {
    const s = src.read("SKILL.md");
    const sec = (h: string) => sectionBody(s, h, "p6-science SKILL.md");
    return [
      frontmatter("p6-science", "Primary 6 / PSLE Science tutor (Singapore MOE 2023 syllabus, SEAB 2026 format: 30 MCQ / 60 marks + structured / 40 marks): every P3–P6 theme, open-ended answering technique, misconceptions, experimental skills. Load for any P6 science question, practice, marking or revision plan."),
      "# P6 Science (PSLE)",
      `Science coaching for the PSLE under the **2023 MOE syllabus wording** and the **2026 SEAB format**: a patient, one-question-at-a-time coach for the learner, and a data-driven planner for the parent. When in doubt about scope or wording, read \`references/syllabus.md\` first.`,
      `## Load order (read only what the moment needs)

| Situation | Read |
|---|---|
| Any factual or format question about the exam or a topic | \`references/syllabus.md\`, then the topic's card in \`references/concept-cards.md\` |
| Starting or continuing a tutoring session | \`references/tutoring-protocol.md\` (§0–§3) and \`references/memory-strategies.md\` (§A, §I) |
| Choosing which topics and questions to give | \`references/topic-stats.md\` (tiers and recurring sub-skills) and the archetypes in \`skill.json\` |
| Marking or coaching a written answer | \`references/answer-techniques.md\` (§2 frames, §3 keywords, §4 misconceptions) |`,
      "## Non-negotiables\n\n" + sec("Non-negotiables"),
      "## Session flow\n\n" + sec("Session flow"),
      `## Writing questions

Pick an archetype by topic weight × weakness → change the story, keep the science → stem, figure or table, question line, four options (or parts with marks and ruled lines) → answer, explanation, trap or marking points. Any question the exam would show with a diagram needs a real diagram (never ASCII). Check it before sharing.`,
      inMykx("references/answer-techniques.md"),
      referenceTable(refs, {
        "syllabus.md": "format, scope (Cells is out), the 2023 vocabulary",
        "concept-cards.md": "teaching or checking any topic: must-know, watch-outs, mini-check",
        "answer-techniques.md": "marking and coaching answers: R.U.L.E., C.E.R. frames, keywords, misconceptions",
        "memory-strategies.md": "making facts stick: retrieval, spacing, interleaving, anchors, overload signs",
        "tutoring-protocol.md": "diagnostic, session structure, choosing questions, a 12-day plan, working with the parent",
        "topic-stats.md": "where the marks are: topic weights, tiers, recurring sub-skills",
      }),
    ].join("\n\n");
  },
  post: [
    [/`references\/syllabus_2026\.md`/g, "`references/syllabus.md`"],
    [/`references\/concept_cards\.md`/g, "`references/concept-cards.md`"],
    [/`references\/memory_strategies\.md`/g, "`references/memory-strategies.md`"],
    [/`references\/answer_techniques\.md`/g, "`references/answer-techniques.md`"],
    [/`references\/tutoring_protocol\.md`/g, "`references/tutoring-protocol.md`"],
    [/`references\/topic_stats\.md`/g, "`references/topic-stats.md`"],
    [/diagrams drawn with\s+\(never ASCII art\)\. Check the rendered page before sharing\./, "real diagrams (never ASCII art). Check every figure before sharing."],
    [/The learner is a learner: spaced re-asks/, "Spaced re-asks"],
    [/\(`memory_strategies\.md` §J\)/, "(`references/memory-strategies.md` §J)"],
    [/Variants of bank items with changed contexts\/numbers;/, "Variants of the archetypes with changed contexts/numbers;"],
    [/- Give the profile a mastery value 0–3 per topic\. Report/, "- Report"],
    [/7\. \*\*Track and hand back\.\*\*[^\n]*\n[^\n]*\n?/, "7. **Track honestly.** The app keeps the learner record; never estimate or change marks.\n"],
    [/ → progress card\./, "."],
    [/syllabus_2026\.md/g, "syllabus.md"],
    [/topic_stats\.md/g, "topic-stats.md"],
  ],
  itemSets: [
    { from: "scripts/example_paper.json", set: "practice-01" },
    { from: "scripts/example_paper_2.json", set: "practice-02" },
  ],
  mapItems: (set, src) => mapPsleScience(set, src, "p6sci"),
  // A file named after the child is listed by a placeholder, so the name never reaches the pack.
  excluded: ["references/question_bank.json", "assets/<learner>_profile.json", "assets/learner_profile_template.json", "chatgpt/CUSTOM_GPT_INSTRUCTIONS.md", "chatgpt/README.md", "scripts/README.md"],
};

/** Hand-written generic wording where the source line carries example surfaces. */
const P3MATH_PATTERNS: Record<string, string> = {
  WN3: "Order four 4-digit numbers that share digits",
  AS1: "Missing number in an addition or subtraction (use the inverse)",
  AS8: "Working backwards: undo a chain of gives and receives to find the start",
  MD1: "Table fact in a context (rows, groups)",
  MD4: "Multiply then divide (cartons × packets ÷ boxes)",
  MD5: "Before-after with 'times': bought more, now n times another amount",
  MD6: "Comparison model with an extra: one amount is a multiple, another is that plus a fixed extra",
  MD7: "Three-party comparison: one is a multiple, one is less by a fixed amount, total known",
  MD8: "Equal at first; one gains and one loses; then one is n times the other",
  MD9: "Two purchases that differ in one item: the difference isolates that item",
  MD10: "Working backwards with daily usage and an amount left over",
  MO3: "Which two items were bought, given the change",
  MO4: "Bundle vs single price: least cost for an exact number",
  MO5: "Free items with a bundle: count items per price, then scale",
  MO6: "How much more money is needed",
  FR7: "Two people eat parts of the same cake: total eaten",
  ME1: "Convert between units (kg and g, m and cm), converting before calculating",
  ME3: "Subtract repeated amounts from a total volume",
  ME4: "'n times as much as a cup': divide, then compare",
  ME6: "Container comparisons: more than one, less than another; find a sum",
  TI2: "End time from a start time plus a duration",
  TI3: "Duration between two 24-hour times",
  TI4: "Arrived, waited, then an event ended: find the event's length (two jumps on a time line)",
  TI6: "Across midnight: start time from an end time and a long duration",
  AR3: "Area and perimeter of two figures: 'same ___ but different ___'",
  AR5: "Wire bent into a rectangle, then into a square: perimeter → side → area",
  BG2: "True/false statements that need the minor gridlines",
  BG3: "Double bar graph: which day had n more of one than the other; totals",
  BG5: "From the graph to money: total items × price",
};


export const CONFIGS: PackConfig[] = [P3SCI, P3MATH, S2SCI, P6MATH, P3ENG, P3CHI, P6SCI];
