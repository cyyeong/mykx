// Server only: the knowledge review's cross-check step (lib/knowledge/crosscheck.ts) over a session's uploads. When an
// answer sheet pairs with its question paper (whichever came first), when a paper arrives with its own answers, or
// when our own material has questions, Muse works every answer out again and the result is kept on the paper's
// upload for the admin to review. Muse never sees a school paper's question text here (rule 10).
import type { AuthStore } from "../auth/store.ts";
import { crossCheck, type CheckRow } from "./crosscheck.ts";
import type { KnowledgeUpload } from "./knowledge.ts";
import { docKind, effectivePaper, entriesOf, itemKeyText, keyedQuestions, pairUploads } from "./session.ts";

/** The rows to check for a paper: its questions with their keys (from itself or its answer sheet) and its items. */
export function checkRows(paper: KnowledgeUpload, sheet: KnowledgeUpload | null): CheckRow[] {
  const rows: CheckRow[] = keyedQuestions(paper, sheet).map((q) => ({ key: q.key, label: q.no, topic: q.topic, marks: q.marks, keyAnswer: q.keyAnswer, pattern: q.pattern, workedAnswer: q.workedAnswer }));
  // Items only for our own or licensed material (entriesOf gives none for a school paper).
  entriesOf(paper).items.forEach((it, i) => rows.push({ key: `i:${i}`, label: `question ${i + 1}`, topic: it.topic, marks: it.marks, keyAnswer: itemKeyText(it), stem: it.stem, options: it.options }));
  return rows;
}

/** The papers whose checks a new or changed upload affects: itself (a paper), or the paper its sheet pairs with. */
export function papersToCheck(changed: KnowledgeUpload, session: readonly KnowledgeUpload[]): { paper: KnowledgeUpload; sheet: KnowledgeUpload | null }[] {
  const pairs = pairUploads(session);
  const byId = new Map(session.map((u) => [u.id, u]));
  const kind = docKind(changed);
  if (changed.status !== "ready") return [];
  if (kind === "answer-sheet") {
    const p = byId.get(pairs.get(changed.id) ?? "");
    return p ? [{ paper: p, sheet: changed }] : [];
  }
  if (kind === "notes") return entriesOf(changed).items.length ? [{ paper: changed, sheet: null }] : [];
  return [{ paper: changed, sheet: byId.get(pairs.get(changed.id) ?? "") ?? null }];
}

/** Runs Muse's cross-check for each affected paper and saves it on the paper. Never throws (a failed call falls back). */
export async function recheck(store: AuthStore, targets: { paper: KnowledgeUpload; sheet: KnowledgeUpload | null }[], signal?: AbortSignal): Promise<KnowledgeUpload[]> {
  const out: KnowledgeUpload[] = [];
  for (const { paper, sheet } of targets) {
    const rows = checkRows(paper, sheet);
    if (!rows.length) continue;
    const p = effectivePaper(paper);
    const checks = await crossCheck(rows, { level: p.level === "unknown" ? null : p.level, subject: p.subject === "other" ? null : p.subject, signal });
    // A check the admin already settled stays settled only if Muse still says the same thing.
    const resolved = Object.fromEntries(Object.entries(paper.state.resolved ?? {}).filter(([k]) => checks.find((c) => c.key === k)?.status !== "ok"));
    const saved = await store.knowledge.updateUpload(paper.id, { state: { ...paper.state, checks, checkedAt: new Date().toISOString(), resolved } }).catch(() => null);
    if (saved) out.push(saved);
  }
  return out;
}
