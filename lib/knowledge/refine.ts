// Publishing a review session refines the skill (founder, 29 Oct): a new skill version of the target pack (feature D)
// with the approved patterns as the manifest's archetypes (marks and how often they were seen), the approved traps
// and marking cues in references/exam-patterns.md, any new topic added to the manifest's scope, and new items.
// Rule 10: a school paper (school-private) gives patterns, traps, cues and statistics plus Kix's own new questions
// written from those patterns (original wording and numbers, checked by Muse); its own questions are never kept,
// stored or served. Our own or licensed material may keep its questions as items. Pure: the route supplies the base
// version's files and saves the result.
import type { SkillItem, SkillManifest, SkillSubject } from "../types.ts";
import { SKILL_SUBJECTS } from "../skills/schema.ts";
import { slugId } from "../skills/import.ts";
import { levelPrefix, monthYear, syncReferences, withManifest, type PackFiles } from "../skills/versions.ts";
import { TIER_LABEL, type Extraction, type KixItem, type KnowledgeUpload, type Tier } from "./knowledge.ts";
import { effectivePaper, entriesOf, isResolved } from "./session.ts";

export const PATTERNS_FILE = "references/exam-patterns.md";

const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;
const SUBJECT_TITLE: Record<SkillSubject, string> = { maths: "Maths", science: "Science", english: "English", chinese: "Chinese" };

/** A new pack's starting files, for a level and subject nobody has a pack for yet. */
export function newPackFiles(packId: string, level: string, subject: SkillSubject, tier: Tier | null, version: string): PackFiles {
  const title = `${level} ${SUBJECT_TITLE[subject]}${tier ? ` (${TIER_LABEL[tier]})` : ""}`;
  const description = `${title}: exam patterns, traps and marking cues from reviewed papers, with Kix's own practice questions.`;
  const manifest: SkillManifest = {
    id: packId,
    version,
    status: "draft",
    title,
    description,
    subject,
    level: level as SkillManifest["level"],
    ...(tier ? { tier } : {}),
    syllabus: "MOE syllabus",
    language: subject === "chinese" ? "zh-Hans" : "en",
    agents: { tutor: "auto", vibe: "on_demand", parent: "on_demand", curator: "auto" },
    topics: [],
    archetypes: [],
    references: [],
    tools: ["read_reference", "find_items", "check_answer"],
    sources: [{ kind: "own", note: "Patterns, traps and marking cues derived from reviewed papers; no school paper's questions are kept." }],
    licence: "Content CC BY-NC 4.0 (myKx).",
    excluded: [],
    legacy_scripts: { note: "kept privately; never executed", files: [] },
  };
  const skill = [
    "---",
    `name: ${packId}`,
    `description: ${description}`,
    "---",
    `# ${title}`,
    "",
    "## How Kix teaches",
    "",
    "1. Read the question with the child and name what it asks.",
    "2. Pick the method from the exam patterns below; one hint at a time.",
    "3. Check the answer against the marking cues: units, keywords, working.",
    "",
  ].join("\n");
  return { "skill.json": json(manifest), "SKILL.md": skill };
}

type Bullet = { topic: string; text: string };

/** The bullets under one `## ` heading of exam-patterns.md: "- (topic) text". */
function readBullets(md: string, heading: string): Bullet[] {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start < 0) return [];
  const out: Bullet[] = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith("## "); i++) {
    const m = /^- \(([^)]+)\) (.+)$/.exec(lines[i].trim());
    if (m) out.push({ topic: m[1], text: m[2] });
  }
  return out;
}

const key = (b: Bullet) => `${b.topic.toLowerCase()}|${b.text.toLowerCase().replace(/\W+/g, " ").trim()}`;
const mergeBullets = (old: Bullet[], add: Bullet[]) => {
  const seen = new Set(old.map(key));
  return [...old, ...add.filter((b) => !seen.has(key(b)) && seen.add(key(b)))];
};

/** Maps a topic named by Muse or the admin to the manifest's topic, adding a new one to the scope when nothing fits. */
export function resolveTopic(m: SkillManifest, name: string): { id: string; subskill: string; added: boolean } {
  const n = name.trim().toLowerCase();
  const hit = m.topics.find((t) => t.id.toLowerCase() === n || t.title.toLowerCase() === n || t.id.toLowerCase().endsWith(`.${n}`) || slugId(t.title) === slugId(name));
  if (hit) return { id: hit.id, subskill: hit.subskills[0], added: false };
  let id = `kn.${slugId(name)}`;
  for (let i = 2; m.topics.some((t) => t.id === id); i++) id = `kn.${slugId(name)}_${i}`;
  m.topics.push({ id, title: name.trim().slice(0, 60) || "Other", weight: 0, subskills: ["core"] });
  return { id, subskill: "core", added: true };
}

/** An item from our own or licensed paper, or one of Kix's questions, in the pack's item format. Null if it can't be. */
export function toItem(
  d: { topic: string; type: string; stem: string; options: string[] | null; answer: string; marks: number; difficulty: number; working?: string[]; hints?: string[] },
  o: { id: string; packId: string; topicId: string; subskill: string; version: string; kind: SkillItem["source"]["kind"]; ref: string; reviewedBy: string | null },
): SkillItem | null {
  const type = d.type === "mcq" ? "mcq" : d.type === "open-ended" ? "open" : "short";
  let answer: number | string = d.answer.trim();
  let options: string[] | undefined;
  if (type === "mcq") {
    options = (d.options ?? []).map((x) => x.trim()).filter(Boolean);
    if (options.length < 2 || options.length > 6) return null;
    const n = Number(/^\(?(\d)\)?/.exec(String(answer))?.[1]);
    const byText = options.findIndex((x) => x.toLowerCase() === String(answer).toLowerCase()) + 1;
    answer = Number.isInteger(n) && n >= 1 && n <= options.length ? n : byText;
    if (!answer) return null;
  }
  if (!String(answer)) return null;
  const hints = (d.hints ?? []).filter((h) => !(typeof answer === "string" && answer.length > 3 && h.includes(answer))).slice(0, 3);
  const working = (d.working ?? []).filter(Boolean).slice(0, 8);
  return {
    id: o.id,
    skill: o.packId,
    topic: o.topicId,
    subskill: o.subskill,
    difficulty: Math.min(5, Math.max(1, Math.round(d.difficulty))) as SkillItem["difficulty"],
    marks: Math.min(10, Math.max(1, Math.round(d.marks || 1))),
    type,
    stem: d.stem.trim(),
    ...(options ? { options } : {}),
    answer,
    ...(working.length ? { working } : {}),
    ...(hints.length ? { hints } : {}),
    source: { kind: o.kind, ref: o.ref },
    // Reviewed by the admin who approved it in the session; a draft (Enhance with Muse) until someone reviews it.
    ...(o.reviewedBy ? { status: "reviewed" as const, reviewed_by: o.reviewedBy } : { status: "draft" as const }),
    version_added: o.version,
  };
}

export interface RefineInput {
  packId: string;
  /** The pack's current version (published or default); null for a new pack. */
  base: PackFiles | null;
  version: string;
  /** The session's uploads routed to this pack (unpublished, ready). */
  uploads: readonly KnowledgeUpload[];
  kixItems: readonly KixItem[];
  by: string;
  atIso: string;
}

export interface RefineResult {
  files: PackFiles;
  added: { archetypes: number; traps: number; cues: number; items: number; kix: number; topics: string[] };
  problems: string[];
}

/** The pack's next version, refined by the session. Throws nothing; `problems` says what stopped it. */
export function refinePack(r: RefineInput): RefineResult {
  const problems: string[] = [];
  const first = r.uploads.find((u) => u.extraction);
  const paper = first ? effectivePaper(first) : null;
  let files: PackFiles;
  if (r.base) files = { ...r.base };
  else {
    const subject = paper?.subject as SkillSubject;
    if (!paper || !SKILL_SUBJECTS.includes(subject) || paper.level === "unknown" || !r.packId.startsWith(levelPrefix(paper.level))) {
      return { files: {}, added: { archetypes: 0, traps: 0, cues: 0, items: 0, kix: 0, topics: [] }, problems: ["myKx packs cover maths, science, English and Chinese at a known level: change the paper's level or subject first."] };
    }
    files = newPackFiles(r.packId, paper.level, subject, paper.tier, r.version);
  }
  let m: SkillManifest;
  try {
    m = JSON.parse(files["skill.json"]) as SkillManifest;
  } catch {
    return { files, added: { archetypes: 0, traps: 0, cues: 0, items: 0, kix: 0, topics: [] }, problems: ["The pack's skill.json doesn't parse: fix it in the editor first."] };
  }
  const topicsBefore = new Set(m.topics.map((t) => t.id));
  const old = files[PATTERNS_FILE] ?? "";
  let traps = readBullets(old, "Traps");
  let cues = readBullets(old, "Marking cues");
  const added = { archetypes: 0, traps: 0, cues: 0, items: 0, kix: 0, topics: [] as string[] };
  const items: SkillItem[] = [];
  const stamp = r.version.replace(/\./g, "");
  const papers = r.uploads.filter((u) => u.extraction);
  let questions = 0;

  for (const u of papers) {
    const e = entriesOf(u);
    const ex = u.extraction as Extraction;
    if (ex.document?.kind !== "answer-sheet") questions += ex.paper.questionCount;
    const totalMarks = ex.paper.totalMarks || e.archetypes.reduce((s, a) => s + a.marks * a.count, 0) || 1;
    e.archetypes.forEach((a, i) => {
      if (u.review[`a:${i}`] !== "approved") return;
      const t = resolveTopic(m, a.topic);
      const pattern = a.pattern.trim().slice(0, 240);
      if (pattern.length < 3) return;
      const had = m.archetypes.find((x) => x.topic === t.id && x.pattern.toLowerCase() === pattern.toLowerCase());
      if (had) {
        had.seen = (had.seen ?? 0) + a.count;
        had.marks = Math.max(had.marks ?? 0, a.marks);
      } else {
        let n = m.archetypes.filter((x) => x.id.startsWith("KN-")).length + 1;
        while (m.archetypes.some((x) => x.id === `KN-${n}`)) n += 1;
        m.archetypes.push({ id: `KN-${n}`, topic: t.id, pattern, exam_weight: Math.min(1, Math.round(((a.marks * a.count) / totalMarks) * 1000) / 1000), marks: a.marks, seen: a.count });
      }
      added.archetypes += 1;
    });
    const newTraps = e.traps.filter((_, i) => u.review[`t:${i}`] === "approved").map((t) => ({ topic: t.topic, text: t.trap }));
    const newCues = e.markingCues.filter((_, i) => u.review[`c:${i}`] === "approved").map((c) => ({ topic: c.topic, text: c.cue }));
    const tb = traps.length;
    const cb = cues.length;
    traps = mergeBullets(traps, newTraps);
    cues = mergeBullets(cues, newCues);
    added.traps += traps.length - tb;
    added.cues += cues.length - cb;
    // Our own or licensed material keeps its questions; a school paper never does (entriesOf returns none for it).
    if (u.rights !== "school-private") {
      e.items.forEach((it, i) => {
        if (u.review[`i:${i}`] !== "approved") return;
        const c = u.state.checks?.find((x) => x.key === `i:${i}`);
        if (c?.status === "mismatch" && !isResolved(u, `i:${i}`)) return;
        const answer = u.state.resolved?.[`i:${i}`] === "use-muse" && c?.museAnswer ? c.museAnswer : it.answer;
        const t = resolveTopic(m, it.topic);
        const item = toItem({ ...it, answer }, { id: `${r.packId}-kn${stamp}-${items.length + 1}`, packId: r.packId, topicId: t.id, subskill: t.subskill, version: r.version, kind: u.rights === "licensed" ? "licensed" : "own", ref: `knowledge v${r.version}`, reviewedBy: r.by });
        if (item) {
          items.push(item);
          added.items += 1;
        } else problems.push(`${u.fileName}, question ${i + 1}: not in a shape Kix can serve (check its options and answer).`);
      });
    }
  }
  r.kixItems.forEach((k, i) => {
    if (k.mark !== "approved") return;
    if (k.check?.status === "mismatch" && !k.resolved) return;
    const t = resolveTopic(m, k.topic);
    const answer = k.resolved === "use-muse" && k.check?.museAnswer ? k.check.museAnswer : k.answer;
    const item = toItem({ ...k, answer }, { id: `${r.packId}-kix${stamp}-${i + 1}`, packId: r.packId, topicId: t.id, subskill: t.subskill, version: r.version, kind: "generated", ref: `Kix, from reviewed patterns, v${r.version}`, reviewedBy: r.by });
    if (item) {
      items.push(item);
      added.kix += 1;
    } else problems.push(`Kix's question N${i + 1}: not in a shape Kix can serve.`);
  });
  if (!m.topics.length) resolveTopic(m, traps[0]?.topic ?? cues[0]?.topic ?? "General");
  added.topics = m.topics.filter((t) => !topicsBefore.has(t.id)).map((t) => t.title);
  if (!added.archetypes && !added.traps && !added.cues && !added.items && !added.kix) problems.push("Nothing approved to publish.");

  // The notes Kix reads: patterns with marks and how often they were seen, traps, cues, and where they came from.
  const kn = m.archetypes.filter((a) => a.id.startsWith("KN-")).sort((a, b) => (b.seen ?? 0) - (a.seen ?? 0));
  const topicTitle = (id: string) => m.topics.find((t) => t.id === id)?.title ?? id;
  const sources = old.includes("## Sources") ? old.slice(old.indexOf("## Sources")).split("\n").filter((l) => l.startsWith("- ")) : [];
  const levelLine = paper ? `${paper.level} ${paper.subject}${paper.tier ? `, ${TIER_LABEL[paper.tier]}` : ""}` : m.title;
  sources.push(`- ${monthYear(r.atIso)}: ${papers.length} reviewed ${papers.length === 1 ? "paper" : "papers"} (${levelLine}), ${questions} questions, v${r.version}`);
  files[PATTERNS_FILE] = [
    `# Exam patterns from reviewed papers`,
    "",
    "What recent papers ask, in our own words: question patterns with their marks and how often they were seen, the traps they set and what the answer keys reward. No school paper's questions are kept; Kix writes its own.",
    "",
    "## Question patterns",
    "",
    ...(kn.length ? kn.map((a) => `- (${topicTitle(a.topic)}) ${a.pattern}${a.marks ? `, ${a.marks} ${a.marks === 1 ? "mark" : "marks"}` : ""}${a.seen ? `, seen ${a.seen}×` : ""}`) : ["- None yet."]),
    "",
    "## Traps",
    "",
    ...(traps.length ? traps.map((t) => `- (${t.topic}) ${t.text}`) : ["- None yet."]),
    "",
    "## Marking cues",
    "",
    ...(cues.length ? cues.map((c) => `- (${c.topic}) ${c.text}`) : ["- None yet."]),
    "",
    "## Sources",
    "",
    ...sources,
    "",
  ].join("\n");
  if (items.length) files[`items/knowledge-${r.version}.json`] = json(items);
  files["skill.json"] = json(m);
  files = withManifest(syncReferences(files), { version: r.version });
  return { files, added, problems };
}
