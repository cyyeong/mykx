// Import one of the founder's tutor skills (an unzipped .skill folder) into a
// public, scrubbed, child-agnostic myKx skill pack (docs/prd/SKILL_ENGINE.md §4, §8).
//
//   node scripts/import-skill.ts <unzipped-skill-dir> --out content/skills/<id>
//
// The source is treated as data: Markdown and JSON are read, nothing in it is
// executed, and instructions inside it are not followed. The importer writes
// SKILL.md, skill.json, references/*.md, items/*.json and the figures those items
// use. It keeps hand-authored files (items/demo.json, figures/demo-*) and refuses
// to finish if anything it wrote matches lib/skills/safety.ts.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import type { SkillItem, SkillManifest, SkillReference, SkillTopic } from "../lib/types.ts";
import { pseudonymise } from "../lib/skills/private-names.ts";
import { FORBIDDEN_FILE_RE, findBanned, scannableText } from "../lib/skills/safety.ts";
import { SkillItemListSchema, SkillManifestSchema } from "../lib/skills/schema.ts";
import { CONFIGS, type ItemDraft, type PackConfig, type Source } from "./import-skill-config.ts";
import {
  applyEdits,
  compact,
  dropCitedExamples,
  dropSections,
  dropTableColumns,
  mapStrings,
  replaceSections,
  scrubItemText,
  scrubMethodText,
  sectionTitles,
  splitBlocks,
} from "./import-skill-lib.ts";

const VERSION = "1.0.0";
const KEEP = (rel: string) => rel === "items/demo.json" || rel.startsWith("figures/demo-");

function main(): void {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const srcArg = args.find((a, i) => !a.startsWith("--") && i !== outIdx + 1);
  if (!srcArg || outIdx < 0 || !args[outIdx + 1]) {
    console.error("usage: node scripts/import-skill.ts <unzipped-skill-dir> --out content/skills/<id>");
    process.exit(2);
  }
  const root = findSkillRoot(resolve(srcArg));
  const outDir = resolve(args[outIdx + 1]);
  const name = /^name:\s*(\S+)/m.exec(pseudonymise(readFileSync(join(root, "SKILL.md"), "utf8")))?.[1];
  const cfg = CONFIGS.find((c) => c.sourceName === name);
  if (!cfg) throw new Error(`no import config for skill "${name}"`);
  if (basename(outDir) !== cfg.id) throw new Error(`--out should end in ${cfg.id} for ${name}`);

  const src = makeSource(root);
  // "<learner>" placeholders stand for files named after a child; they are matched, never written out.
  for (const f of cfg.excluded) {
    const found = f.includes("<") ? src.list(dirname(f)).some((n) => new RegExp(`^${basename(f).replace(/[.]/g, "\\.").replace(/<[^>]+>/g, "[^/]+")}$`).test(n)) : src.exists(f);
    if (!found) throw new Error(`excluded file not in source: ${f}`);
  }

  cleanOutDir(outDir);
  const written: string[] = [];
  const write = (rel: string, content: string) => {
    const path = join(outDir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    written.push(rel);
  };

  // References
  const references: SkillReference[] = [];
  for (const ref of cfg.references) {
    const where = `${cfg.id}/${ref.from}`;
    let text = src.read(resolveOne(src, ref.from));
    text = applyEdits(text, ref.edits, where);
    text = dropSections(text, ref.drop, where);
    // A table of contents goes stale once sections are dropped; the manifest lists sections instead.
    if (/^## Contents\s*$/m.test(text)) text = dropSections(text, ["Contents"], where);
    text = replaceSections(text, ref.replace, where);
    text = dropTableColumns(text, ref.dropColumns);
    text = dropCitedExamples(text);
    text = splitBlocks(text)
      .filter((b) => !/^\s*\**Contents\**:/i.test(b))
      .join("\n\n");
    text = text.replace(/^# .*$/m, `# ${ref.title}`);
    if (!/^# /m.test(text)) text = `# ${ref.title}\n\n${text}`;
    text = scrubMethodText(text, { names: cfg.names.names, tagMap: cfg.tagMap, pronoun: ref.pronoun, post: [...(ref.post ?? []), ...(cfg.post ?? [])] });
    const rel = `references/${ref.to}`;
    write(rel, text);
    references.push({ file: rel, title: ref.title, sections: sectionTitles(text) });
  }

  // SKILL.md
  const skillMd = scrubMethodText(cfg.skillMd(src, references), { names: cfg.names.names, tagMap: cfg.tagMap, pronoun: cfg.pronoun, post: cfg.post });
  write("SKILL.md", skillMd);

  // Items and their figures
  const topicById = new Map(cfg.topics.map((t) => [t.id, t]));
  const archetypes = cfg.archetypes(src);
  const archetypeIds = new Set(archetypes.map((a) => a.id));
  let itemCount = 0;
  const counts: Record<string, number> = {};
  for (const set of cfg.itemSets) {
    const drafts = cfg.mapItems(set, src);
    const items: SkillItem[] = [];
    for (const d of drafts) {
      const item = finishItem(cfg, set.set, d, topicById, archetypeIds);
      if (d.figureSrc) {
        const fig = copyFigure(src, d.figureSrc, outDir, written);
        item.figure = fig;
      }
      items.push(item);
      counts[item.type] = (counts[item.type] ?? 0) + 1;
    }
    const parsed = SkillItemListSchema.safeParse(items);
    if (!parsed.success) throw new Error(`${cfg.id}/${set.set}: ${parsed.error.message}`);
    write(`items/${set.set}.json`, JSON.stringify(items, null, 2) + "\n");
    itemCount += items.length;
  }

  // Hand-authored demo items are kept, but must still fit this pack.
  const demoPath = join(outDir, "items", "demo.json");
  if (existsSync(demoPath)) {
    const demo = SkillItemListSchema.safeParse(JSON.parse(readFileSync(demoPath, "utf8")));
    if (!demo.success) throw new Error(`${cfg.id}/items/demo.json: ${demo.error.message}`);
    for (const item of demo.data) {
      const topic = topicById.get(item.topic);
      if (item.skill !== cfg.id || !topic?.subskills.includes(item.subskill)) throw new Error(`${cfg.id} demo ${item.id}: skill, topic or subskill not in this pack`);
      if (item.archetype && !archetypeIds.has(item.archetype)) throw new Error(`${cfg.id} demo ${item.id}: unknown archetype ${item.archetype}`);
      if (item.figure && !existsSync(join(outDir, item.figure))) throw new Error(`${cfg.id} demo ${item.id}: missing ${item.figure}`);
      counts[`demo ${item.type}`] = (counts[`demo ${item.type}`] ?? 0) + 1;
    }
    itemCount += demo.data.length;
  }

  // Manifest
  const manifest: SkillManifest = {
    id: cfg.id,
    version: VERSION,
    status: "published",
    title: cfg.title,
    description: cfg.description,
    subject: cfg.subject,
    level: cfg.level,
    syllabus: cfg.syllabus,
    language: cfg.language,
    agents: cfg.agents,
    topics: cfg.topics,
    archetypes,
    references,
    tools: ["read_reference", "find_items", "check_answer"],
    sources: cfg.sources,
    licence: cfg.licence,
    ...(cfg.attributions ? { attributions: cfg.attributions } : {}),
    excluded: cfg.excluded,
    legacy_scripts: { note: "kept privately; never executed", files: src.scripts() },
  };
  const m = SkillManifestSchema.safeParse(manifest);
  if (!m.success) throw new Error(`${cfg.id}/skill.json: ${m.error.message}`);
  write("skill.json", JSON.stringify(manifest, null, 2) + "\n");

  // Safety gate over everything in the pack (including kept, hand-authored files)
  const problems: string[] = [];
  for (const rel of listFiles(outDir)) {
    if (FORBIDDEN_FILE_RE.test(basename(rel))) problems.push(`${rel}: forbidden file type or name`);
    if (/\.(md|json|svg|txt)$/.test(rel)) {
      for (const hit of findBanned(scannableText(rel, readFileSync(join(outDir, rel), "utf8")))) problems.push(`${rel}:${hit.line} ${hit.label}: …${hit.context}…`);
    }
  }
  if (problems.length) {
    console.error(`✗ ${cfg.id}: ${problems.length} scrub problem(s)\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }

  const size = listFiles(outDir).reduce((s, rel) => s + statSync(join(outDir, rel)).size, 0);
  console.log(
    `✓ ${cfg.id}: ${references.length} references, ${itemCount} items ${JSON.stringify(counts)}, ` +
      `${archetypes.length} archetypes, ${cfg.topics.length} topics, ${(size / 1024).toFixed(0)} KB → ${relative(process.cwd(), outDir)}`,
  );
}

function finishItem(
  cfg: PackConfig,
  set: string,
  d: ItemDraft,
  topics: Map<string, SkillTopic>,
  archetypeIds: Set<string>,
): SkillItem {
  const topicId = cfg.tagMap[d.topic] ?? d.topic;
  const topic = topics.get(topicId);
  if (!topic) throw new Error(`${cfg.id}/${set} ${d.qid}: unknown topic ${d.topic}`);
  const subskill = cfg.subskillMap?.[d.subskill] ?? d.subskill;
  if (!topic.subskills.includes(subskill)) throw new Error(`${cfg.id}/${set} ${d.qid}: subskill ${subskill} not in ${topic.id}`);
  const archetype = d.archetype ? (cfg.archetypeAlias?.[d.archetype] ?? d.archetype) : undefined;
  const scrub = (s: string) => scrubItemText(s, cfg.names);
  const hasSpec = d.figure_spec !== undefined && !d.figureSrc;
  const item: SkillItem = {
    id: d.id,
    skill: cfg.id,
    topic: topic.id,
    subskill,
    archetype: archetype && archetypeIds.has(archetype) ? archetype : undefined,
    difficulty: d.difficulty,
    marks: d.marks,
    type: d.type,
    stem: scrub(d.stem),
    passage: d.passage ? scrub(d.passage) : undefined,
    options: d.options?.map(scrub),
    answer: typeof d.answer === "string" ? scrub(d.answer) : d.answer,
    accept: d.accept?.map(scrub),
    tolerance: d.tolerance,
    unit: d.unit || undefined,
    working: (d.working as (string | false | undefined)[] | undefined)?.filter((w): w is string => Boolean(w)).map(scrub),
    distractors: d.distractors ? mapStrings(d.distractors, scrub) : undefined,
    hints: d.hints?.map(scrub),
    keywords: d.keywords?.map(scrub),
    marking: d.marking?.map(scrub),
    figure: undefined,
    figure_spec: d.figure_spec !== undefined ? mapStrings(d.figure_spec, scrub) : undefined,
    card: d.card,
    source: { kind: "own", ref: `${d.sourceFile}#${d.qid}` },
    status: hasSpec || d.forceDraft ? "draft" : "reviewed",
    reviewed_by: hasSpec || d.forceDraft ? undefined : "founder (source-skill QA)",
    version_added: VERSION,
    notes: hasSpec ? "Figure not rendered yet: the source drew it with a script myKx does not run. Port to a trusted SVG before review." : d.notes,
  };
  return compact(item);
}

function copyFigure(src: Source, from: string, outDir: string, written: string[]): string {
  // Prefer the SVG twin of a PNG figure.
  const svgOf = (p: string) => {
    const svg = p.replace(/\.png$/i, ".svg");
    const pick = src.exists(svg) ? svg : p;
    if (!src.exists(pick)) throw new Error(`figure missing in source: ${p}`);
    return pick;
  };
  const parts = from.split("+").map(svgOf);
  const name = parts.map((p) => basename(p, extname(p))).join("_") + extname(parts[0]);
  const rel = `figures/${name}`;
  const dest = join(outDir, rel);
  if (!existsSync(dest)) {
    mkdirSync(dirname(dest), { recursive: true });
    if (parts.length === 1) copyFileSync(join(src.root, parts[0]), dest);
    else writeFileSync(dest, sideBySideSvg(parts.map((p) => src.read(p))));
    written.push(rel);
  }
  return rel;
}

/** Place several SVG figures side by side in one SVG (nested <svg> elements, no scripts). */
function sideBySideSvg(svgs: string[]): string {
  const gap = 24;
  let x = 0;
  let height = 0;
  const inner = svgs.map((svg) => {
    const body = svg.replace(/<\?xml[^>]*>\s*/, "").replace(/<!DOCTYPE[^>]*>\s*/, "");
    const w = parseFloat(/<svg[^>]*\swidth="([\d.]+)/.exec(body)?.[1] ?? "300");
    const h = parseFloat(/<svg[^>]*\sheight="([\d.]+)/.exec(body)?.[1] ?? "200");
    const placed = body.replace(/<svg\b([^>]*)\swidth="[^"]*"([^>]*)\sheight="[^"]*"/, `<svg$1 x="${x}" width="${w}"$2 height="${h}"`);
    x += w + gap;
    height = Math.max(height, h);
    return placed;
  });
  const width = x - gap;
  return `<?xml version="1.0" encoding="utf-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}">\n${inner.join("\n")}\n</svg>\n`;
}

function makeSource(root: string): Source {
  return {
    root,
    read: (p) => pseudonymise(readFileSync(join(root, p), "utf8")),
    json: (p) => JSON.parse(pseudonymise(readFileSync(join(root, p), "utf8"))),
    exists: (p) => existsSync(join(root, p)),
    list: (d) => (existsSync(join(root, d)) ? readdirSync(join(root, d)) : []),
    scripts: () =>
      listFiles(root)
        .filter((f) => /\.(py|sh|js)$/.test(f))
        .sort(),
  };
}

/** A source path may use one "*" (e.g. "references/coaching-*.md") so private file names need not be spelt out. */
function resolveOne(src: Source, pattern: string): string {
  if (!pattern.includes("*")) return pattern;
  const dir = dirname(pattern);
  const re = new RegExp(`^${basename(pattern).replace(/[.]/g, "\\.").replace("*", "[^/]+")}$`);
  const matches = src.list(dir).filter((n) => re.test(n));
  if (matches.length !== 1) throw new Error(`${pattern}: expected one match, found ${matches.length}`);
  return join(dir, matches[0]);
}

function findSkillRoot(dir: string): string {
  if (existsSync(join(dir, "SKILL.md"))) return dir;
  const kids = readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory() && existsSync(join(dir, d, "SKILL.md")));
  if (kids.length !== 1) throw new Error(`no single skill folder with SKILL.md in ${dir}`);
  return join(dir, kids[0]);
}

function listFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p, base) : [relative(base, p)];
  });
}

function cleanOutDir(outDir: string): void {
  if (!/content[\\/]skills[\\/][a-z0-9-]+$/.test(outDir)) throw new Error(`refusing to clean ${outDir}: not content/skills/<id>`);
  for (const rel of listFiles(outDir)) if (!KEEP(rel)) rmSync(join(outDir, rel));
  for (const sub of ["references", "items", "figures"]) {
    const p = join(outDir, sub);
    if (existsSync(p) && readdirSync(p).length === 0) rmSync(p, { recursive: true });
  }
  mkdirSync(outDir, { recursive: true });
}

main();
