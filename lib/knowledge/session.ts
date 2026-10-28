// Knowledge review sessions (founder, 29 Oct): several PDFs reviewed together, added at any time: a question paper
// now, its answer sheet later in the same session. Deterministic rules only (no model, no store), shared by the
// routes, the screen and the tests:
// - what each upload is and its level, subject and tier, after the admin's overrides ("changed by you");
// - which pack it refines (level + subject, like before);
// - pairing an answer sheet with its question paper by school, year, exam and paper number, or by hand;
// - the answer key each question ends up with, and the rows Muse cross-checks;
// - what blocks publishing: an unresolved mismatch between the key and Muse.
// Rule 10: nothing here carries a school paper's question text; its rows are numbers, patterns and answers.
import { routeFor, type CrossCheck, type DocKind, type Edits, type Extraction, type KixItem, type KnowledgeUpload, type PaperLevel, type PaperSubject, type Tier } from "./knowledge.ts";

/** "Q13" → "13", "13 (a)" → "13a", "Question 4b" → "4b": how question numbers are matched across documents. */
export function normNo(no: string): string {
  return no
    .toLowerCase()
    .replace(/question|qn|q\.?/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Two answers that say the same thing: the same words, or the same number (with or without units and spacing). */
export function sameAnswer(a: string, b: string): boolean {
  const t = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKC")
      .replace(/s\$|\$/g, "")
      .replace(/[^a-z0-9.]+/g, " ")
      .replace(/\b(option|answer|ans)\b/g, "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\.$/, "");
  const x = t(a);
  const y = t(b);
  if (x === y) return true;
  const num = (s: string) => {
    const m = /^(-?\d+(?:\.\d+)?)/.exec(s);
    return m ? Number(m[1]) : null;
  };
  const nx = num(x);
  const ny = num(y);
  if (nx !== null && ny !== null && Math.abs(nx - ny) < 1e-9) {
    const rest = (s: string) => s.replace(/^-?\d+(?:\.\d+)?/, "").trim();
    return !rest(x) || !rest(y) || rest(x) === rest(y);
  }
  return false;
}

export function docKind(u: KnowledgeUpload): DocKind {
  return u.extraction?.document?.kind ?? "question-paper";
}

/** The upload's entries as the admin left them: their edits where they made any, else Muse's reading. */
export function entriesOf(u: KnowledgeUpload): Required<Edits> {
  const e = u.extraction;
  const ed = u.state.edits ?? {};
  return {
    archetypes: ed.archetypes ?? e?.archetypes ?? [],
    traps: ed.traps ?? e?.traps ?? [],
    markingCues: ed.markingCues ?? e?.markingCues ?? [],
    // A school paper never has items, whatever an edit says (rule 10).
    items: u.rights === "school-private" ? [] : (ed.items ?? e?.items ?? []),
    questions: ed.questions ?? e?.questions ?? [],
  };
}

export interface EffectivePaper {
  level: PaperLevel;
  subject: PaperSubject;
  tier: Tier | null;
  /** Fields the admin changed (shown as "changed by you"). */
  changed: { level: boolean; subject: boolean; tier: boolean };
}

export function effectivePaper(u: KnowledgeUpload): EffectivePaper {
  const p = u.extraction?.paper;
  const o = u.state.overrides ?? {};
  const level = o.level ?? p?.level ?? "unknown";
  const subject = o.subject ?? p?.subject ?? "other";
  const tier = o.tier !== undefined ? o.tier : (p?.tier ?? null);
  return {
    level,
    subject,
    tier,
    changed: { level: o.level !== undefined && o.level !== p?.level, subject: o.subject !== undefined && o.subject !== p?.subject, tier: o.tier !== undefined && o.tier !== (p?.tier ?? null) },
  };
}

/** The pack an upload refines, after the admin's overrides. */
export function routeOf(u: KnowledgeUpload, packs: readonly string[]): { pack: string; isNew: boolean } | null {
  const p = effectivePaper(u);
  return routeFor(p.level, p.subject, packs);
}

const clean = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** How an upload identifies its paper: school, year, exam and paper number, plus level and subject. */
export function matchKey(u: KnowledgeUpload) {
  const p: Partial<Extraction["paper"]> = u.extraction?.paper ?? {};
  const eff = effectivePaper(u);
  return { school: clean(p.school), year: p.year ? String(p.year) : "", exam: clean(p.examType), paper: clean(u.extraction?.document?.paperNumber).replace(/^paper|^booklet/, ""), level: eff.level, subject: eff.subject };
}

/**
 * Pairs answer sheets with question papers in one session. The admin's choice wins (a pair, or "not paired");
 * otherwise a sheet pairs with the one question paper of the same level and subject whose school, year, exam and
 * paper number don't conflict and agree the most. A tie, or no agreement when several papers could fit, leaves it
 * for the admin. Returns sheet → paper and paper → sheet.
 */
export function pairUploads(uploads: readonly KnowledgeUpload[]): Map<string, string> {
  const ready = uploads.filter((u) => u.status === "ready" && u.extraction);
  const byId = new Map(ready.map((u) => [u.id, u]));
  const pairs = new Map<string, string>();
  const link = (a: string, b: string) => {
    pairs.set(a, b);
    pairs.set(b, a);
  };
  const optedOut = new Set<string>();
  for (const u of ready) {
    if (u.state.pairWith === null) optedOut.add(u.id);
    const other = u.state.pairWith ? byId.get(u.state.pairWith) : undefined;
    if (other && !pairs.has(u.id) && !pairs.has(other.id)) link(u.id, other.id);
  }
  const sheets = ready.filter((u) => docKind(u) === "answer-sheet" && !pairs.has(u.id) && !optedOut.has(u.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const s of sheets) {
    const k = matchKey(s);
    const scored = ready
      .filter((p) => docKind(p) === "question-paper" && !pairs.has(p.id) && !optedOut.has(p.id))
      .map((p) => {
        const q = matchKey(p);
        if (k.level !== "unknown" && q.level !== "unknown" && k.level !== q.level) return null;
        if (k.subject !== "other" && q.subject !== "other" && k.subject !== q.subject) return null;
        let score = 0;
        for (const f of ["school", "year", "exam", "paper"] as const) {
          if (!k[f] || !q[f]) continue;
          if (k[f] !== q[f]) return null;
          score += 1;
        }
        return { p, score };
      })
      .filter((x): x is { p: KnowledgeUpload; score: number } => Boolean(x))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best) continue;
    if (scored[1] && scored[1].score === best.score) continue; // ambiguous: the admin pairs it
    if (best.score === 0 && scored.length > 1) continue;
    link(s.id, best.p.id);
  }
  return pairs;
}

/** One row of a paper's answer table: the question by number, its pattern and marks, and where its key came from. */
export interface KeyedQuestion {
  no: string;
  key: string;
  topic: string;
  pattern: string;
  marks: number;
  keyAnswer: string | null;
  keyFrom: "paper" | "sheet" | "you" | null;
  workedAnswer: string | null;
}

/** A question paper's rows with the answer key each ends up with: an admin's edit, else the paper's own key ("both"),
 *  else its paired answer sheet's. */
export function keyedQuestions(paper: KnowledgeUpload, sheet: KnowledgeUpload | null): KeyedQuestion[] {
  const mine = entriesOf(paper).questions;
  const original = new Map((paper.extraction?.questions ?? []).map((q) => [normNo(q.no), q.keyAnswer]));
  const sheetKeys = new Map((sheet ? entriesOf(sheet).questions : []).map((q) => [normNo(q.no), q]));
  return mine.map((q) => {
    const n = normNo(q.no);
    const edited = q.keyAnswer !== (original.get(n) ?? null) && q.keyAnswer !== null;
    const fromSheet = sheetKeys.get(n)?.keyAnswer ?? null;
    const keyAnswer = q.keyAnswer ?? fromSheet;
    return {
      no: q.no,
      key: `q:${n}`,
      topic: q.topic,
      pattern: q.pattern,
      marks: q.marks || sheetKeys.get(n)?.marks || 0,
      keyAnswer,
      keyFrom: edited ? "you" : q.keyAnswer ? "paper" : fromSheet ? "sheet" : null,
      workedAnswer: q.workedAnswer,
    };
  });
}

export const checkOf = (u: KnowledgeUpload, key: string): CrossCheck | null => u.state.checks?.find((c) => c.key === key) ?? null;

/** Settled checks don't block: the key is right after all, or Muse's answer or the spelling fix was used. */
export const isResolved = (u: KnowledgeUpload, key: string) => Boolean(u.state.resolved?.[key]);

/** An item's key as text, for the cross-check ("2: tadpole" for an mcq). */
export function itemKeyText(it: { type: string; options: string[] | null; answer: string }): string {
  if (it.type === "mcq" && it.options?.length) {
    const n = Number(it.answer);
    if (Number.isInteger(n) && n >= 1 && n <= it.options.length) return `${n}: ${it.options[n - 1]}`;
  }
  return it.answer;
}

/** Why publishing a pack is blocked right now, in plain words; empty when it may go ahead. */
export function publishBlockers(uploads: readonly KnowledgeUpload[], kixItems: readonly KixItem[]): string[] {
  const out: string[] = [];
  for (const u of uploads) {
    for (const c of u.state.checks ?? []) {
      if (c.status !== "mismatch" || isResolved(u, c.key)) continue;
      if (c.key.startsWith("i:")) {
        const i = Number(c.key.slice(2));
        if (u.review[`i:${i}`] === "rejected") continue;
        out.push(`${u.fileName}, question ${i + 1}: the answer and Muse's disagree. Fix it, use Muse's answer, or mark it right.`);
      } else out.push(`${u.fileName}, Q${c.key.slice(2)}: the key and Muse's answer disagree. Fix the key, use Muse's, or mark the key right.`);
    }
  }
  kixItems.forEach((k, i) => {
    if (k.mark === "approved" && k.check?.status === "mismatch" && !k.resolved) out.push(`Kix's question N${i + 1}: Muse got a different answer when it worked it again.`);
  });
  const approved = uploads.some((u) => Object.values(u.review).includes("approved")) || kixItems.some((k) => k.mark === "approved");
  if (!approved) out.push("Approve at least one pattern, trap, cue or question first.");
  return out;
}

/** What publishing would add to the pack, for the summary card. */
export function refineCounts(uploads: readonly KnowledgeUpload[], kixItems: readonly KixItem[], knownTopics: readonly string[]) {
  let archetypes = 0;
  let traps = 0;
  let cues = 0;
  let items = 0;
  const topics = new Set<string>();
  const known = new Set(knownTopics.map((t) => t.toLowerCase()));
  for (const u of uploads) {
    const e = entriesOf(u);
    e.archetypes.forEach((a, i) => {
      if (u.review[`a:${i}`] !== "approved") return;
      archetypes += 1;
      if (!known.has(a.topic.toLowerCase())) topics.add(a.topic.toLowerCase());
    });
    e.traps.forEach((_, i) => u.review[`t:${i}`] === "approved" && (traps += 1));
    e.markingCues.forEach((_, i) => u.review[`c:${i}`] === "approved" && (cues += 1));
    e.items.forEach((_, i) => u.review[`i:${i}`] === "approved" && (items += 1));
  }
  const kix = kixItems.filter((k) => k.mark === "approved").length;
  return { archetypes, traps, cues, items, kix, topics: topics.size };
}
