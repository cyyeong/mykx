// Shared domain types. Type-only module (no runtime code), safe to import from
// the app, scripts (Node type stripping) and tests.
//
// Skill packs: docs/prd/SKILL_ENGINE.md §4. Packs live in content/skills/<id>/
// (SKILL.md, skill.json, references/*.md, items/*.json, figures/*). The zod
// schemas that validate these shapes are in lib/skills/schema.ts.

// ─── Skill packs ────────────────────────────────────────────────────────────

export type SkillSubject = "science" | "maths" | "english" | "chinese";

/** The levels a pack can be for. Kids are P3, P6 or Sec 2 in the MVP; an admin may import a pack, or route a paper,
 *  for another level, and it waits in the catalogue until a kid at that level exists. */
export type SkillLevel = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "Sec 1" | "Sec 2" | "Sec 3" | "Sec 4";

/** A paper's tier: PSLE Standard or Foundation, or a secondary subject level (G1 to G3). */
export type SkillTier = "standard" | "foundation" | "g1" | "g2" | "g3";

export type SkillStatus = "draft" | "published" | "retired";

/** How an agent may use a skill: preloaded, loadable through tool_search, or never. */
export type AgentSkillMode = "auto" | "on_demand" | "off";

export type SkillAgent = "tutor" | "vibe" | "parent" | "curator";

/** Trusted myKx tools a skill namespace exposes (SKILL_ENGINE §5). */
export type SkillToolName = "read_reference" | "find_items" | "check_answer";

/** One examinable topic, with its share of the exam and its subskill tags. */
export interface SkillTopic {
  /** Dotted id, e.g. "cycles.animal". Items and the learner record use it. */
  id: string;
  title: string;
  /** Share of exam marks, 0–1 (from the source skill's blueprint or syllabus map). */
  weight: number;
  /** Subskill tags, unique within the topic, e.g. "stage_features". */
  subskills: string[];
  /** The source skill's tag for this topic, kept for traceability. */
  source_tag?: string;
}

/**
 * A question pattern that recurs in real exams, derived from school papers
 * without copying them: no question text, school names or paper codes.
 */
export interface Archetype {
  /** e.g. "ALC-3" or "MD6". */
  id: string;
  topic: string;
  /** Generic description of the pattern ("duration graph: time after hatching"). */
  pattern: string;
  /** Approximate share of exam marks carried by this pattern, 0–1. */
  exam_weight: number;
  subskill?: string;
  /** Marks a question of this pattern carries in reviewed papers (added by the knowledge agent). */
  marks?: number;
  /** How many questions in reviewed papers followed it (added by the knowledge agent). */
  seen?: number;
}

/** A reference file an agent reads section by section (## headings are sections). */
export interface SkillReference {
  /** Path inside the pack, e.g. "references/content-cycles.md". */
  file: string;
  title: string;
  /** The `## ` headings, in order; `read_reference("<file>#<section>")` takes one. */
  sections: string[];
}

export interface SkillSource {
  kind: ItemSourceKind;
  note: string;
}

export interface SkillManifest {
  id: string;
  /** Semver, e.g. "1.0.0". Published items join the next minor version. */
  version: string;
  status: SkillStatus;
  title: string;
  /** One line for catalogues and tool_search. */
  description: string;
  subject: SkillSubject;
  level: SkillLevel;
  tier?: SkillTier;
  syllabus: string;
  /** BCP 47 language of the content, e.g. "en" or "zh-Hans". */
  language: string;
  agents: Record<SkillAgent, AgentSkillMode>;
  topics: SkillTopic[];
  archetypes: Archetype[];
  references: SkillReference[];
  tools: SkillToolName[];
  sources: SkillSource[];
  licence: string;
  /** Third-party attributions for bundled assets (icons, fonts). */
  attributions?: string[];
  /** Source-skill files deliberately left out of the pack (names only). */
  excluded: string[];
  /** Source-skill scripts: kept in the private archive, never executed. */
  legacy_scripts: { note: "kept privately; never executed"; files: string[] };
}

// ─── Items ──────────────────────────────────────────────────────────────────

/**
 * - `mcq`: `options` plus a 1-based option number as `answer`.
 * - `short`: exact or numeric answer (`accept`, `tolerance`, `unit`).
 * - `open`: CER-style model answer; marked by self-check, never changes mastery.
 * - `card`: flashcard or word card (front = `stem`, back = `answer`).
 */
export type ItemType = "mcq" | "short" | "open" | "card";

export type ItemStatus = "draft" | "reviewed" | "retired";

export type ItemSourceKind = "own" | "licensed" | "generated";

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface ItemSource {
  kind: ItemSourceKind;
  /** Where the item came from, e.g. "diagnostic_01#A9" or "demo". Never a school paper. */
  ref: string;
}

/**
 * The model a Singapore primary answer sheet draws for a word problem (the bar-model method, MOE), or a time line.
 * Data only: a trusted component draws it (components/papers/WorkedModel.tsx). Widths are in "units" along a bar.
 */
export interface ModelSegment {
  /** Width in units. */
  w: number;
  /** Written inside the segment ("1 u", "$4", "?"). */
  text?: string;
  /** unit: a plain box; extra: a shaded add-on ($4 more); ghost: dashed, gone or not there (spent, given away). */
  tone?: "unit" | "extra" | "ghost";
}
export interface ModelBar {
  label: string;
  parts: ModelSegment[];
}
/** A bracket over (or under) a stretch of one bar, from and to in units. */
export interface ModelMark {
  bar: number;
  from: number;
  to: number;
  text: string;
  side?: "above" | "below";
}
export interface ModelPanel {
  /** "Before", "After", "In the end"… */
  title?: string;
  bars: ModelBar[];
  marks?: ModelMark[];
  /** A brace on the right over every bar (or bars from…to), with the total. */
  total?: { text: string; from?: number; to?: number };
}
export type WorkedModel =
  | { kind: "bars"; panels: ModelPanel[] }
  | {
      kind: "timeline";
      /** Times on the line, in minutes from the first one, with their labels ("13 45"). */
      ticks: { at: number; label: string }[];
      /** Jumps drawn as arcs above the line ("1 h 25 min"). */
      jumps: { from: number; to: number; text: string }[];
    };

export interface SkillItem {
  /** Unique across all packs, e.g. "p3sci-lc-004". */
  id: string;
  /** Pack id. */
  skill: string;
  topic: string;
  subskill: string;
  archetype?: string;
  difficulty: Difficulty;
  marks: number;
  type: ItemType;
  /** Plain text; may contain **bold** and Markdown tables. */
  stem: string;
  /** Reading passage or poster text the stem refers to, when there is one. */
  passage?: string;
  options?: string[];
  /** mcq: 1-based option number. short: the exact answer. open: model answer. card: back of the card. */
  answer: number | string;
  /** Other answers that also score (short and open items). */
  accept?: string[];
  /** Numeric tolerance for short answers. */
  tolerance?: number;
  unit?: string;
  /** Worked solution, one step per entry. */
  working?: string[];
  /** Why a learner might pick each wrong option, keyed by option number ("1"–"4"). */
  distractors?: Record<string, string>;
  /** Escalating nudges: first gentle, then stronger. Never the answer itself. */
  hints?: string[];
  /** Words a marker looks for (open items). */
  keywords?: string[];
  /** Marking points, one per mark (open items). */
  marking?: string[];
  /** Pack-relative path, e.g. "figures/frog-stages.svg". */
  figure?: string;
  /**
   * The source skill's figure description (a diagram-builder spec), kept so a
   * trusted SVG tool can render it later. Items that rely on one stay `draft`.
   */
  figure_spec?: unknown;
  /** The model drawn in the answer guide (bar model or time line), for questions schools teach with one. */
  model?: WorkedModel;
  /** Extra fields for word cards. */
  card?: { pinyin?: string; meaning?: string; lesson?: number };
  source: ItemSource;
  status: ItemStatus;
  reviewed_by?: string;
  version_added: string;
  /** One of the twelve demo-path items (founder approves before the demo). */
  demo?: boolean;
  /** Reviewer notes (why an item is still a draft, what to check). */
  notes?: string;
}
