// Soak test A: audits every item in content/skills/ (offline, deterministic, no model calls).
//   node scripts/soak/audit.ts
// Writes scripts/soak/out/audit.json (every finding) and scripts/soak/out/audit.md (tables).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { OBJECTIVE_TYPES, familyOf, partOf, questionOf } from "../../lib/domain/attempts.ts";
import { markItem, normaliseAnswer, parseQuantity } from "../../lib/domain/marking.ts";
import { difficultyBand } from "../../lib/domain/selection.ts";
import { SKILLS, loadPacks, table, writeOut } from "./bank.ts";

type Severity = "error" | "warn" | "info";
interface Finding {
  check: string;
  severity: Severity;
  pack: string;
  ids: string[];
  detail: string;
}

const findings: Finding[] = [];
const add = (check: string, severity: Severity, pack: string, ids: string[], detail: string) => findings.push({ check, severity, pack, ids, detail });

const packs = loadPacks();
const all = packs.flatMap((p) => p.items.map((i) => ({ ...i, pack: p })));
type Item = (typeof all)[number];

// ─── A1. Schema and manifest agreement ──────────────────────────────────────
for (const p of packs) {
  for (const s of p.issues) add("schema", "error", p.id, [s.id], `${s.file}: ${s.message}`);
  const topics = new Map(p.manifest.topics.map((t) => [t.id, t]));
  const archetypes = new Map(p.manifest.archetypes.map((a) => [a.id, a]));
  for (const i of p.items) {
    const t = topics.get(i.topic);
    if (!t) add("schema", "error", p.id, [i.id], `unknown topic ${i.topic}`);
    else if (!t.subskills.includes(i.subskill)) add("schema", "error", p.id, [i.id], `unknown subskill ${i.topic}/${i.subskill}`);
    if (i.archetype && archetypes.get(i.archetype)?.topic !== i.topic) add("schema", "error", p.id, [i.id], `archetype ${i.archetype} is not in topic ${i.topic}`);
    if (i.figure && !existsSync(join(SKILLS, p.id, i.figure))) add("schema", "error", p.id, [i.id], `missing figure ${i.figure}`);
    if (i.status === "reviewed" && !i.reviewed_by) add("schema", "error", p.id, [i.id], "reviewed without reviewed_by");
  }
}
const ids = all.map((i) => i.id);
for (const dup of ids.filter((id, k) => ids.indexOf(id) !== k)) add("schema", "error", "*", [dup], "duplicate item id");

// ─── A2. Answer keys ────────────────────────────────────────────────────────
const words = (s: string) => normaliseAnswer(s).match(/[\p{L}\p{N}]+/gu) ?? [];
const STOP = new Set("a an the of to in on at is are was were be it its and or for with by as that this which what who how why from into than then so do does did not no can will".split(" "));
const content = (s: string) => words(s).filter((w) => !STOP.has(w) && w.length > 2);
const numbersIn = (s: string) => (normaliseAnswer(s).replace(/(\d),(\d{3})/g, "$1$2").match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

const mcqAnswerPos: Record<string, number[]> = {};
const longestIsCorrect: Record<string, { yes: number; n: number }> = {};

for (const i of all) {
  const pid = i.pack.id;
  if (i.type === "mcq" && i.options) {
    const norm = i.options.map(normaliseAnswer);
    const dupes = norm.filter((o, k) => norm.indexOf(o) !== k);
    if (dupes.length) add("answer-key", "error", pid, [i.id], `duplicate options: ${dupes.join(", ")}`);
    if (norm.some((o) => /\b(all|none) of the above\b|\bboth [a-d] and [a-d]\b/.test(o)))
      add("answer-key", "warn", pid, [i.id], "an 'all/none of the above' or 'both' option: check exactly one option is correct");
    const ans = i.answer as number;
    (mcqAnswerPos[pid] ??= [0, 0, 0, 0, 0, 0, 0])[ans] += 1;
    const lens = i.options.map((o) => o.length);
    const max = Math.max(...lens);
    const lb = (longestIsCorrect[pid] ??= { yes: 0, n: 0 });
    if (lens.filter((l) => l === max).length === 1 && i.options.length >= 3) {
      lb.n += 1;
      if (lens[ans - 1] === max) lb.yes += 1;
    }
    // Numeric options: the worked solution should reach the keyed value somewhere.
    const vals = i.options.map((o) => parseQuantity(normaliseAnswer(o))?.value ?? null);
    if (i.working?.length && vals.every((v) => v !== null)) {
      const nums = i.working.flatMap(numbersIn);
      const key = vals[ans - 1] as number;
      if (!nums.includes(key)) add("answer-key", "warn", pid, [i.id], `the worked solution never reaches the keyed value ${key}`);
    }
    // Self-consistency of marking: the key marks right, every other option wrong.
    if (!markItem(i, ans).correct) add("answer-key", "error", pid, [i.id], "the keyed option does not mark correct");
    for (let k = 1; k <= i.options.length; k++) if (k !== ans && markItem(i, k).correct) add("answer-key", "error", pid, [i.id], `option ${k} also marks correct`);
  }
  if (i.type === "short") {
    const key = String(i.answer);
    const r = markItem(i, key);
    if (!r.correct) add("answer-key", "error", pid, [i.id], `the key "${key}" does not mark correct against itself`);
    for (const a of i.accept ?? []) if (!markItem(i, a).correct) add("answer-key", "error", pid, [i.id], `accepted answer "${a}" does not mark correct`);
    // Plausible answers from a child who is right: the bold part(s), the key without its
    // parenthetical note, and the key with the brackets dropped but their words kept.
    const bold = [...key.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]);
    const plain = key.replace(/\*\*/g, "");
    const candidates = new Set<string>(bold);
    if (/\(.*\)/.test(plain)) {
      candidates.add(plain.replace(/\s*\(.*?\)\s*/g, " ").trim());
      if (/\(\s*\S+\s*\)/.test(plain) && /\p{L}/u.test(plain.replace(/\(.*?\)/g, ""))) candidates.add(plain.replace(/[()]/g, ""));
    }
    const failing = [...new Set([...candidates].map((c) => c.replace(/\s+([.!])$/, "$1")))].filter((c) => normaliseAnswer(c) && !markItem(i, c).correct);
    if (failing.length)
      add("marking-notes-in-key", i.status === "reviewed" ? "error" : "warn", pid, [i.id], `the key "${key}" holds marking notes, so a right answer is marked wrong: ${failing.map((f) => `"${f}"`).join(", ")}`);
    const isSequence = /^[^,、;]+([,、;][^,、;]+)+$/u.test(key) && key.split(/[,、;]/u).every((t) => t.trim().split(/\s+/).length === 1);
    if (!isSequence && words(key).length >= 5 && !i.accept?.length)
      add("short-too-open", "warn", pid, [i.id], `short answer is a ${words(key).length}-word sentence ("${key.slice(0, 60)}"); exact marking will reject fair paraphrases: add accept[] or make it open`);
    const q = parseQuantity(normaliseAnswer(key));
    if (q && i.working?.length && !i.working.flatMap(numbersIn).includes(q.value)) add("answer-key", "warn", pid, [i.id], `the worked solution never reaches the answer ${key}`);
  }
  if ((i.type === "open" || i.type === "short") && !String(i.answer).trim()) add("answer-key", "error", pid, [i.id], "empty answer");
}

// ─── A3. Hints, distractor feedback and stems that give the answer away ─────
for (const i of all) {
  const pid = i.pack.id;
  const answerText = i.type === "mcq" ? (i.options?.[(i.answer as number) - 1] ?? "") : String(i.answer);
  const na = normaliseAnswer(answerText);
  const ansNum = i.type === "mcq" ? parseQuantity(na) : parseQuantity(normaliseAnswer(String(i.answer)));
  const containsAnswer = (text: string) => {
    const t = normaliseAnswer(text);
    if (na.length >= 4 && t.includes(na)) return `contains the answer text "${answerText.slice(0, 50)}"`;
    if (i.type !== "mcq" && na.length >= 2 && na.length < 4 && new RegExp(`(^|[^\\p{L}\\p{N}])${na.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`, "u").test(t) && !/\d/.test(na))
      return `contains the short answer "${answerText}"`;
    if (ansNum && Math.abs(ansNum.value) >= 2 && numbersIn(text).includes(ansNum.value)) return `states the answer's number ${ansNum.value}`;
    return null;
  };
  (i.hints ?? []).forEach((h, k) => {
    const why = containsAnswer(h);
    if (why) add("hint-giveaway", "warn", pid, [i.id], `hint ${k + 1} ${why}: "${h.slice(0, 120)}"`);
    else if (i.type === "mcq" && i.options && i.options.length >= 3) {
      // Points at the answer: the hint shares most of the key's content words and few of any distractor's.
      const hw = new Set(content(h));
      const share = i.options.map((o) => {
        const cw = [...new Set(content(o))];
        return cw.length ? cw.filter((w) => hw.has(w)).length / cw.length : 0;
      });
      const key = share[(i.answer as number) - 1];
      const other = Math.max(...share.filter((_, j) => j !== (i.answer as number) - 1));
      if (key >= 0.5 && key - other >= 0.25) add("hint-points", "info", pid, [i.id], `hint ${k + 1} echoes the key's wording (${Math.round(key * 100)}% of its words vs ≤${Math.round(other * 100)}% for any distractor): "${h.slice(0, 120)}"`);
    }
  });
  for (const [opt, note] of Object.entries(i.distractors ?? {})) {
    const why = containsAnswer(note);
    if (why) add("feedback-giveaway", "warn", pid, [i.id], `feedback for option ${opt} ${why}, so the retry (3 points) is free: "${note.slice(0, 120)}"`);
  }
  if (i.type === "short" && na.length >= 3 && !ansNum && normaliseAnswer(i.stem).includes(na))
    add("stem-giveaway", "info", pid, [i.id], `stem contains the answer "${answerText}" (fine for "copy a word" items; check)`);
}

// ─── A4. Duplicate and near-duplicate stems ─────────────────────────────────
const shingles = (s: string, zh: boolean) => {
  const t = normaliseAnswer(s);
  const toks = zh ? [...t.replace(/\s+/g, "")] : words(t);
  const n = zh ? 4 : 3;
  const set = new Set<string>();
  for (let k = 0; k + n <= toks.length; k++) set.add(toks.slice(k, k + n).join(zh ? "" : " "));
  return set;
};
const jaccard = (a: Set<string>, b: Set<string>) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};
const nonCards = all.filter((i) => i.type !== "card");
const exactKey = (i: Item) => normaliseAnswer([i.passage ?? "", i.stem, ...(i.options ?? [])].join(" ¦ "));
const byExact = new Map<string, Item[]>();
for (const i of nonCards) byExact.set(exactKey(i), [...(byExact.get(exactKey(i)) ?? []), i]);
for (const group of byExact.values()) if (group.length > 1) add("duplicate", "warn", group[0].pack.id, group.map((i) => i.id), "identical stem, passage and options");

const templateKey = (i: Item) => normaliseAnswer(i.stem).replace(/\d+(\.\d+)?/g, "#").replace(/\b[A-Z][a-z]+\b/g, "N");
const nearPairs: { a: Item; b: Item; sim: number; kind: string }[] = [];
const sharedBanks: [Item, Item][] = [];
for (const p of packs) {
  const zh = p.manifest.language.startsWith("zh");
  const list = nonCards.filter((i) => i.pack.id === p.id && i.stem.length >= 25);
  const sh = list.map((i) => shingles(i.stem, zh));
  for (let x = 0; x < list.length; x++) {
    for (let y = x + 1; y < list.length; y++) {
      const a = list[x];
      const b = list[y];
      if (questionOf(a) === questionOf(b)) continue; // subparts share a lead-in by design
      if (exactKey(a) === exactKey(b)) continue;
      if (a.passage || b.passage) continue; // blanks of one passage, or one instruction over different passages
      if (a.figure && b.figure && a.figure !== b.figure) continue; // same instruction, different diagram
      if (a.options && b.options && a.options.length > 4 && normaliseAnswer(a.options.join("|")) === normaliseAnswer(b.options.join("|"))) {
        sharedBanks.push([a, b]);
        continue;
      }
      const sim = jaccard(sh[x], sh[y]);
      const sameTemplate = templateKey(a) === templateKey(b) && normaliseAnswer(a.stem) !== normaliseAnswer(b.stem);
      if (sim >= 0.6 || sameTemplate) nearPairs.push({ a, b, sim, kind: sameTemplate ? "same template, other numbers" : "near-identical wording" });
    }
  }
}
for (const n of nearPairs) {
  const live = (i: Item) => i.status === "reviewed" || i.demo;
  add("near-duplicate", live(n.a) && live(n.b) ? "warn" : "info", n.a.pack.id, [n.a.id, n.b.id], `${n.kind} (similarity ${n.sim.toFixed(2)}): treat as one question family, or a learner gets two "fresh" credits for one idea`);
}
const bankGroups = new Map<string, Set<string>>();
for (const [a, b] of sharedBanks) {
  const k = normaliseAnswer(a.options?.join("|") ?? "");
  const g = bankGroups.get(k) ?? new Set<string>();
  g.add(a.id).add(b.id);
  bankGroups.set(k, g);
}
for (const g of bankGroups.values()) {
  const list = [...g].sort();
  add("matching-set", "info", all.find((i) => i.id === list[0])?.pack.id ?? "?", list, `${list.length} items share one option bank (a matching set): each answer narrows the next, so later ones are not independent evidence`);
}

// ─── A5. Families and subparts ──────────────────────────────────────────────
const questions = new Map<string, Item[]>();
for (const i of all) questions.set(questionOf(i), [...(questions.get(questionOf(i)) ?? []), i]);
for (const [q, parts] of questions) {
  const pid = parts[0].pack.id;
  if (parts.length === 1 && partOf(parts[0])) {
    const letter = partOf(parts[0]);
    add("family", letter === "a" ? "warn" : "error", pid, [parts[0].id], `lonely subpart (${letter}) with no sibling parts: the item says "(${letter})" but its other part is missing (dropped as open or draft?)`);
  }
  if (new Set(parts.map((p) => p.status)).size > 1) add("family", "warn", pid, parts.map((p) => p.id), `question ${q} mixes statuses ${[...new Set(parts.map((p) => p.status))].join("/")}: selection serves only reviewed parts`);
  if (new Set(parts.map((p) => p.topic)).size > 1) add("family", "info", pid, parts.map((p) => p.id), `question ${q} spans topics; each part counts toward its own subskill`);
  const letters = parts.map((p) => partOf(p)).filter(Boolean).sort();
  if (letters.length > 1 && letters.some((l, k) => l !== String.fromCharCode(97 + k))) add("family", "warn", pid, parts.map((p) => p.id), `question ${q} has parts ${letters.join(",")}: a letter is missing`);
}

// ─── A6. Coverage: can selection run for each topic? ────────────────────────
interface TopicRow {
  pack: string;
  level: string;
  topic: string;
  weight: number;
  subskills: number;
  subskillsCovered: number;
  reviewedObjective: number;
  families: number;
  diff: number[];
  bands: Record<string, number>;
  draftObjective: number;
  open: number;
}
const topicRows: TopicRow[] = [];
const subskillRows: { pack: string; topic: string; subskill: string; families: number; bands: string }[] = [];
for (const p of packs) {
  for (const t of p.manifest.topics) {
    const inTopic = p.items.filter((i) => i.topic === t.id);
    const obj = inTopic.filter((i) => i.status === "reviewed" && OBJECTIVE_TYPES.includes(i.type));
    const fams = new Set(obj.map((i) => familyOf({ id: i.id })));
    const diff = [0, 0, 0, 0, 0];
    for (const i of obj) diff[i.difficulty - 1] += 1;
    const bands: Record<string, number> = { easy: 0, medium: 0, harder: 0 };
    for (const i of obj) bands[difficultyBand(i.difficulty)] += 1;
    const covered = t.subskills.filter((s) => obj.some((i) => i.subskill === s));
    topicRows.push({
      pack: p.id,
      level: p.manifest.level,
      topic: t.id,
      weight: t.weight,
      subskills: t.subskills.length,
      subskillsCovered: covered.length,
      reviewedObjective: obj.length,
      families: fams.size,
      diff,
      bands,
      draftObjective: inTopic.filter((i) => i.status === "draft" && OBJECTIVE_TYPES.includes(i.type)).length,
      open: inTopic.filter((i) => i.type === "open").length,
    });
    for (const s of t.subskills) {
      const so = obj.filter((i) => i.subskill === s);
      const b = new Set(so.map((i) => difficultyBand(i.difficulty)));
      subskillRows.push({ pack: p.id, topic: t.id, subskill: s, families: new Set(so.map((i) => familyOf({ id: i.id }))).size, bands: [...b].sort().join("+") || "-" });
    }
  }
}

const packRows = packs.map((p) => {
  const it = p.items;
  const reviewedObj = it.filter((i) => i.status === "reviewed" && OBJECTIVE_TYPES.includes(i.type));
  const fams = new Set(reviewedObj.map((i) => familyOf({ id: i.id })));
  const tr = topicRows.filter((r) => r.pack === p.id);
  const weightServed = tr.filter((r) => r.families >= 3).reduce((s, r) => s + r.weight, 0);
  const weightAll = tr.reduce((s, r) => s + r.weight, 0);
  const subs = subskillRows.filter((r) => r.pack === p.id);
  return {
    pack: p.id,
    level: p.manifest.level,
    items: it.length,
    reviewed: it.filter((i) => i.status === "reviewed").length,
    reviewedObjective: reviewedObj.length,
    families: fams.size,
    cards: it.filter((i) => i.type === "card").length,
    openReviewed: it.filter((i) => i.type === "open" && i.status === "reviewed").length,
    drafts: it.filter((i) => i.status === "draft").length,
    topicsRunnable: `${tr.filter((r) => r.families >= 3).length}/${tr.length}`,
    examWeightRunnable: weightAll ? Math.round((100 * weightServed) / weightAll) : 0,
    subskillsCovered: `${subs.filter((s) => s.families > 0).length}/${subs.length}`,
    subskillsAtFive: subs.filter((s) => s.families >= 5).length,
  };
});

// ─── A7. Demo items: the twelve on the demo path ────────────────────────────
const demo = all.filter((i) => i.demo);
const demoRows = demo.map((i) => [i.id, i.status, i.topic + "/" + i.subskill, i.difficulty, i.type === "mcq" ? `option ${i.answer}` : String(i.answer)]);

// ─── Output ─────────────────────────────────────────────────────────────────
const bySev = (s: Severity) => findings.filter((f) => f.severity === s);
const byCheck = new Map<string, Finding[]>();
for (const f of findings) byCheck.set(f.check, [...(byCheck.get(f.check) ?? []), f]);

const md: string[] = [];
md.push(`# Bank audit (generated by scripts/soak/audit.ts)\n`);
md.push(`Items: ${all.length} in ${packs.length} packs. Findings: ${bySev("error").length} errors, ${bySev("warn").length} warnings, ${bySev("info").length} info.\n`);
md.push(`## Findings by check\n`);
md.push(table(["check", "error", "warn", "info"], [...byCheck].map(([c, fs]) => [c, fs.filter((f) => f.severity === "error").length, fs.filter((f) => f.severity === "warn").length, fs.filter((f) => f.severity === "info").length])));
md.push(`\n## Packs\n`);
md.push(
  table(
    ["pack", "level", "items", "reviewed", "reviewed mcq/short", "families", "cards", "open (reviewed)", "drafts", "topics with ≥3 families", "exam weight runnable %", "subskills with any item", "subskills with ≥5 families"],
    packRows.map((r) => [r.pack, r.level, r.items, r.reviewed, r.reviewedObjective, r.families, r.cards, r.openReviewed, r.drafts, r.topicsRunnable, r.examWeightRunnable, r.subskillsCovered, r.subskillsAtFive]),
  ),
);
md.push(`\n## Topics (reviewed mcq/short only; difficulty 1–5 counts)\n`);
md.push(
  table(
    ["pack", "topic", "weight", "families", "subskills covered", "d1", "d2", "d3", "d4", "d5", "easy/med/hard", "draft mcq/short", "open"],
    topicRows.map((r) => [r.pack, r.topic, r.weight, r.families, `${r.subskillsCovered}/${r.subskills}`, ...r.diff, `${r.bands.easy}/${r.bands.medium}/${r.bands.harder}`, r.draftObjective, r.open]),
  ),
);
md.push(`\n## MCQ answer positions and the "longest option is correct" cue\n`);
md.push(
  table(
    ["pack", "MCQs", "key=1", "key=2", "key=3", "key=4", "longest option is the key"],
    Object.entries(mcqAnswerPos).map(([p, pos]) => {
      const n = pos.reduce((a, b) => a + b, 0);
      const lb = longestIsCorrect[p];
      return [p, n, pos[1], pos[2], pos[3], pos[4], lb?.n ? `${lb.yes}/${lb.n} (${Math.round((100 * lb.yes) / lb.n)}%)` : "-"];
    }),
  ),
);
md.push(`\n## Demo items\n`);
md.push(table(["id", "status", "subskill", "difficulty", "key"], demoRows));
md.push(`\n## All findings\n`);
for (const [c, fs] of byCheck) {
  md.push(`\n### ${c} (${fs.length})\n`);
  for (const f of fs) md.push(`- **${f.severity}** ${f.pack} ${f.ids.join(", ")}: ${f.detail}`);
}

const jsonPath = writeOut("audit.json", { generated: "scripts/soak/audit.ts", packs: packRows, topics: topicRows, subskills: subskillRows, findings });
const mdPath = writeOut("audit.md", md.join("\n") + "\n");

console.log(`Bank audit: ${all.length} items, ${packs.length} packs`);
console.log(table(["check", "error", "warn", "info"], [...byCheck].map(([c, fs]) => [c, fs.filter((f) => f.severity === "error").length, fs.filter((f) => f.severity === "warn").length, fs.filter((f) => f.severity === "info").length])));
console.log();
console.log(table(["pack", "reviewed mcq/short", "families", "topics ≥3 fam", "weight runnable %", "subskills covered", "subskills ≥5 fam"], packRows.map((r) => [r.pack, r.reviewedObjective, r.families, r.topicsRunnable, r.examWeightRunnable, r.subskillsCovered, r.subskillsAtFive])));
console.log(`\nWrote ${mdPath} and ${jsonPath}`);

