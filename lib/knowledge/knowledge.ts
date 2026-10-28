// The knowledge agent (SKILL_ENGINE.md §6; skill: .agents/skills/past-paper-scout). An admin uploads papers or
// notes; Muse Spark (Standard) reads each PDF and returns what a tutor needs from it: the paper's level, subject
// and year, the question patterns with their marks (archetypes), the traps the paper sets, and the marking cues.
// Routing to a pack is deterministic (level + subject → p3-science, or a new pack). An admin approves or rejects
// every entry, then publishes: the pack's next minor version, which Kix reads when it tutors and helps with homework.
//
// Rights (AGENTS.md rule 10): a school paper kept for private reference yields patterns and statistics only. The
// prompt asks for no question text, and this file drops any items from such uploads whatever the model returns.
import { z } from "zod";
import { packFor, type Level } from "../papers/scout.ts";

export const RIGHTS = ["school-private", "own", "licensed"] as const;
export type Rights = (typeof RIGHTS)[number];
export const RIGHTS_LABEL: Record<Rights, string> = {
  "school-private": "A school or exam paper, for private reference: patterns only, never shown to children",
  own: "Our own material",
  licensed: "Licensed to us",
};

export const LEVELS = ["P1", "P2", "P3", "P4", "P5", "P6", "Sec 1", "Sec 2", "Sec 3", "Sec 4", "unknown"] as const;
export const SUBJECTS = ["maths", "science", "english", "chinese", "higher-chinese", "tamil", "malay", "other"] as const;
export const TIERS = ["standard", "foundation", "g1", "g2", "g3"] as const;
export type PaperLevel = (typeof LEVELS)[number];
export type PaperSubject = (typeof SUBJECTS)[number];
export type Tier = (typeof TIERS)[number];
export const TIER_LABEL: Record<Tier, string> = { standard: "Standard", foundation: "Foundation", g1: "G1", g2: "G2", g3: "G3" };

/** What a PDF is (founder, 29 Oct): a question paper now, its answer sheet later, or both in one, or notes. */
export const DOC_KINDS = ["question-paper", "answer-sheet", "both", "notes"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_LABEL: Record<DocKind, string> = { "question-paper": "Question paper", "answer-sheet": "Answer sheet", both: "Questions and answers", notes: "Notes" };

/** One question of a paper, by number: its pattern in Muse's own words, never its wording (rule 10). */
export const questionSchema = z.strictObject({
  /** "Q13", "13(a)", "B4". */
  no: z.string().max(12),
  topic: z.string().max(60),
  pattern: z.string().max(160),
  marks: z.number().int().min(0).max(20),
  /** The answer printed on this document (an answer sheet, or a paper with its answers). */
  keyAnswer: z.string().max(200).nullable(),
  /** Muse's own answer, worked out from the question itself when the question is on this document. */
  workedAnswer: z.string().max(200).nullable(),
});
export type PaperQuestion = z.infer<typeof questionSchema>;

export const extractionSchema = z.strictObject({
  paper: z.strictObject({
    level: z.enum(LEVELS),
    subject: z.enum(SUBJECTS),
    /** PSLE Standard or Foundation, or a secondary subject level; null when the paper doesn't say. */
    tier: z.enum(TIERS).nullable(),
    year: z.number().int().min(2000).max(2100).nullable(),
    /** WA1, SA2, EOY, Prelim… */
    examType: z.string().max(30).nullable(),
    school: z.string().max(80).nullable(),
    pages: z.number().int().min(0).max(200),
    questionCount: z.number().int().min(0).max(300),
    /** Total marks, when the paper shows them. */
    totalMarks: z.number().int().min(0).max(500).nullable(),
  }),
  /** What the document is and how to match it with its other half (school, year and exam are in `paper`). */
  document: z.strictObject({
    kind: z.enum(DOC_KINDS),
    /** "1", "2", "Booklet B"; null when the paper has no number. */
    paperNumber: z.string().max(20).nullable(),
  }),
  /** Every question by number, with the answers this document shows and Muse's own. Never question text. */
  questions: z.array(questionSchema).max(60),
  /** Question patterns, never question text: "before-and-after ratio, total unchanged, 4 marks". */
  archetypes: z
    .array(
      z.strictObject({
        topic: z.string().max(60),
        pattern: z.string().max(160),
        marks: z.number().int().min(0).max(20),
        /** How many questions in this paper follow the pattern. */
        count: z.number().int().min(1).max(60),
        difficulty: z.number().int().min(1).max(4),
        format: z.enum(["mcq", "short-answer", "open-ended", "structured", "other"]),
        sourcePages: z.array(z.number().int().min(1).max(200)).max(10),
      }),
    )
    .max(40),
  /** Mistakes the paper is built to catch (from its distractors or answer key). */
  traps: z.array(z.strictObject({ topic: z.string().max(60), trap: z.string().max(200) })).max(15),
  /** What the answer key rewards: keywords, units, steps. */
  markingCues: z.array(z.strictObject({ topic: z.string().max(60), cue: z.string().max(200) })).max(15),
  /** Our own or licensed material only: full items for review. Always empty for a school paper. */
  items: z
    .array(
      z.strictObject({
        topic: z.string().max(60),
        type: z.enum(["mcq", "short-answer", "open-ended"]),
        stem: z.string().max(600),
        options: z.array(z.string().max(160)).max(6).nullable(),
        answer: z.string().max(300),
        marks: z.number().int().min(0).max(10),
        difficulty: z.number().int().min(1).max(4),
      }),
    )
    .max(30),
  confidence: z.enum(["low", "medium", "high"]),
  /** Anything the reviewer should know: unreadable pages, missing answer key, handwriting. */
  notes: z.string().max(300).nullable(),
});
export type Extraction = z.infer<typeof extractionSchema>;

export function extractionPrompt(rights: Rights, packTopics: Record<string, string[]>): string {
  return [
    "You are the Content Curator for myKx, a Singapore learning app. Read the attached document and return what a tutor needs from it, as JSON.",
    "1. paper: the level, subject, year, exam type, school (if printed), pages, number of questions and total marks.",
    "2. archetypes: group the questions into patterns. Describe each pattern in your own words (e.g. \"before-and-after ratio where the total stays the same\"), with its marks, how many questions follow it, difficulty 1-4, format and the pages it's on. Never copy a question's wording, numbers or names.",
    "3. traps: the mistakes the paper is built to catch, in your own words. 4. markingCues: what the answer key rewards (keywords, units, steps).",
    rights === "school-private"
      ? "5. items: this is a school paper kept for private reference. Return items as an empty array. Never reproduce its questions."
      : "5. items: this is our own or licensed material. Return each question as an item (stem, options, answer, marks, difficulty) so a reviewer can approve it.",
    "Tag topics with the pack topic ids below when one fits; otherwise a short plain topic name.",
    `Pack topics: ${JSON.stringify(packTopics)}`,
    "If pages are unreadable or the answer key is missing, say so in notes and lower confidence. Don't guess numbers you can't read.",
  ].join("\n");
}

/** Applies the rights rule whatever the model returned, and fixes the route deterministically. */
export function settle(e: Extraction, rights: Rights, existingPacks: readonly string[]): { extraction: Extraction; pack: string | null; packIsNew: boolean } {
  const extraction = rights === "school-private" ? { ...e, items: [] } : e;
  const level = e.paper.level === "unknown" ? null : (e.paper.level as Level);
  const route = packFor(level, e.paper.subject === "other" ? null : e.paper.subject, existingPacks);
  return { extraction, pack: route?.pack ?? null, packIsNew: route?.isNew ?? false };
}

/**
 * What the review session needs on top of the Curator's prompt (founder, 29 Oct): what the document is, its tier,
 * and every question by number with the answers it shows and Muse's own. Appended after the prompt in read.ts (kept
 * apart from extractionPrompt, whose text is the editable agent's default).
 */
export const EXTRACTION_SESSION_RULES = [
  "Also, for the review session:",
  "- document: what this PDF is. question-paper (questions only), answer-sheet (answers or a marking scheme only), both (questions with their answers), or notes. paperNumber: the paper or booklet number if printed (\"1\", \"2\", \"Booklet B\"). For an answer sheet, paper describes the paper it answers, and it has no archetypes.",
  "- paper.tier: standard or foundation for PSLE, g1/g2/g3 for a secondary subject level, null if not shown.",
  "- questions: one row per question number as printed (Q1, 13(a), B4): topic, the pattern in your own words (never the question's wording, numbers or names), marks, keyAnswer = the answer printed on THIS document (null if none), workedAnswer = your own answer, worked out yourself from the question when the question is on this document (null for an answer sheet). Short answers only: a number with its unit, an option number, or a few words.",
].join("\n");

/** Level + subject → the pack (an existing one, or a new pack's id); null when either is unknown. */
export function routeFor(level: PaperLevel | null | undefined, subject: PaperSubject | null | undefined, existingPacks: readonly string[]) {
  return packFor(level && level !== "unknown" ? (level as Level) : null, subject && subject !== "other" ? subject : null, existingPacks);
}

export type ReviewMark = "approved" | "rejected";
/** Review keys: `a:3` (archetype 3), `t:0` (trap), `c:1` (cue), `i:2` (item). */
export type Review = Record<string, ReviewMark>;

export interface KnowledgeUpload {
  id: string;
  uploadedBy: string;
  fileName: string;
  bytes: number;
  rights: Rights;
  sourceUrl: string | null;
  status: "ready" | "failed";
  pack: string | null;
  packIsNew: boolean;
  extraction: Extraction | null;
  review: Review;
  /** The pack version this upload was published in, once it is. */
  publishedIn: string | null;
  error: string | null;
  createdAt: string;
  /** The review session it belongs to (null for uploads from before sessions, 29 Oct). */
  sessionId: string | null;
  /** The admin's side of the review: overrides, pairing, edits, Muse's cross-checks and their resolutions. */
  state: UploadState;
}

/** Level, subject and tier as the admin set them; absent fields follow Muse's reading ("changed by you" when set). */
export interface PaperOverrides {
  level?: Exclude<PaperLevel, "unknown">;
  subject?: Exclude<PaperSubject, "other">;
  tier?: Tier | null;
}

export const CHECK_STATUSES = ["ok", "mismatch", "spelling", "unusual", "waiting"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];
export const CHECK_LABEL: Record<CheckStatus, string> = { ok: "Checks out", mismatch: "Mismatch", spelling: "Spelling", unusual: "Unusual", waiting: "Waiting" };

/** Muse's cross-check of one answer: `q:<no>` (a paper's question) or `i:<n>` (an item). */
export interface CrossCheck {
  key: string;
  status: CheckStatus;
  /** Muse's own answer, when it differs or was worked. */
  museAnswer: string | null;
  /** The corrected text, for a spelling mistake. */
  fix: string | null;
  note: string | null;
}

/** How an admin settled a check: the key is right after all, Muse's answer replaces it, or the spelling fix is used. */
export type Resolution = "key-right" | "use-muse" | "use-fix";

/** The entries an admin edited, added or removed (removing is a reject, so indexes never move). */
export type Edits = Partial<Pick<Extraction, "archetypes" | "traps" | "markingCues" | "items" | "questions">>;

export interface UploadState {
  overrides?: PaperOverrides;
  /** The admin's pairing: the other half's upload id, or null for "not paired" (stops automatic pairing). */
  pairWith?: string | null;
  edits?: Edits;
  checks?: CrossCheck[];
  checkedAt?: string;
  resolved?: Record<string, Resolution>;
}

/** One of Kix's own new questions, written from a session's approved patterns (never from a paper's wording). */
export interface KixItem {
  topic: string;
  pattern: string;
  type: "mcq" | "short";
  stem: string;
  options: string[] | null;
  answer: string;
  working: string[];
  hints: string[];
  marks: number;
  difficulty: number;
  mark?: ReviewMark;
  check?: CrossCheck;
  resolved?: Resolution;
}

/** A review session (founder, 29 Oct): several PDFs reviewed together, added at any time. */
export interface KnowledgeSession {
  id: string;
  title: string;
  createdBy: string;
  createdAt: string;
  /** Kix's own questions per target pack. */
  kixItems: Record<string, KixItem[]>;
  /** What publishing made: a skill version of each pack (feature D). */
  published: { pack: string; version: string; versionId: string | null; status: "published" | "draft"; at: string }[];
}

export interface SkillUpdate {
  id: string;
  pack: string;
  version: string;
  publishedBy: string;
  publishedAt: string;
  /** "From 3 papers: 2025 EOY (Nanyang, Henry Park)…" */
  summary: string;
  archetypes: { topic: string; pattern: string; marks: number; count: number; difficulty: number; format: string }[];
  traps: { topic: string; trap: string }[];
  markingCues: { topic: string; cue: string }[];
  items: Extraction["items"];
}

/** The next minor version: from the pack's own version for an existing pack (1.0.0 → 1.1.0), 0.1.0 for a new one. */
export function nextVersion(base: string | null, previous: readonly SkillUpdate[]): string {
  const latest = [...previous.map((u) => u.version), ...(base ? [base] : [])].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
  if (!latest) return "0.1.0";
  const [major, minor] = latest.split(".").map(Number);
  return `${major}.${minor + 1}.0`;
}

/** Builds a pack update from the approved entries of its unpublished uploads; null when nothing is approved. */
export function buildUpdate(pack: string, uploads: readonly KnowledgeUpload[], version: string, by: string, at: string, id: string): SkillUpdate | null {
  const mine = uploads.filter((u) => u.pack === pack && u.status === "ready" && !u.publishedIn && u.extraction);
  const archetypes = new Map<string, SkillUpdate["archetypes"][number]>();
  const traps: SkillUpdate["traps"] = [];
  const markingCues: SkillUpdate["markingCues"] = [];
  const items: SkillUpdate["items"] = [];
  for (const u of mine) {
    const e = u.extraction!;
    e.archetypes.forEach((a, i) => {
      if (u.review[`a:${i}`] !== "approved") return;
      const key = `${a.topic.toLowerCase()}|${a.pattern.toLowerCase()}`;
      const had = archetypes.get(key);
      archetypes.set(key, had ? { ...had, count: had.count + a.count, marks: Math.max(had.marks, a.marks) } : { topic: a.topic, pattern: a.pattern, marks: a.marks, count: a.count, difficulty: a.difficulty, format: a.format });
    });
    e.traps.forEach((t, i) => u.review[`t:${i}`] === "approved" && traps.push(t));
    e.markingCues.forEach((c, i) => u.review[`c:${i}`] === "approved" && markingCues.push(c));
    if (u.rights !== "school-private") e.items.forEach((it, i) => u.review[`i:${i}`] === "approved" && items.push(it));
  }
  if (!archetypes.size && !traps.length && !markingCues.length && !items.length) return null;
  const papers = mine.map((u) => [u.extraction!.paper.year, u.extraction!.paper.examType, u.extraction!.paper.school].filter(Boolean).join(" ")).filter(Boolean);
  return {
    id,
    pack,
    version,
    publishedBy: by,
    publishedAt: at,
    summary: `From ${mine.length} ${mine.length === 1 ? "upload" : "uploads"}${papers.length ? `: ${papers.slice(0, 5).join(", ")}${papers.length > 5 ? "…" : ""}` : ""}`,
    archetypes: [...archetypes.values()].sort((a, b) => b.count - a.count),
    traps,
    markingCues,
    items,
  };
}

/** What Kix reads from a pack's published updates when it tutors or helps with homework. */
export function updateNotes(updates: readonly SkillUpdate[]): string {
  if (!updates.length) return "";
  const latest = [...updates].sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  const lines: string[] = [];
  for (const u of latest.slice(0, 3)) {
    lines.push(`### ${u.pack} v${u.version}: latest exam patterns (${u.summary})`);
    for (const a of u.archetypes.slice(0, 12)) lines.push(`- ${a.topic}: ${a.pattern} (${a.marks} marks, seen ${a.count}×)`);
    for (const t of u.traps.slice(0, 6)) lines.push(`- Trap (${t.topic}): ${t.trap}`);
    for (const c of u.markingCues.slice(0, 6)) lines.push(`- Marking (${c.topic}): ${c.cue}`);
  }
  return lines.join("\n");
}
