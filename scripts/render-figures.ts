// Render skill-item figures from their figure_spec data with myKx's own SVG renderer
// (lib/skills/figures), so no script that came with a skill is ever run (AGENTS.md rule 10).
//
//   node scripts/render-figures.ts            render items that have a figure_spec and no figure
//   node scripts/render-figures.ts --force    also redraw figures this script made earlier (same files)
//   node scripts/render-figures.ts --check    render in memory and report; write nothing
//
// For each item it writes content/skills/<pack>/figures/<item-id>.svg (parts of one question with the
// same spec share a file), sets `figure` to that pack-relative path and swaps the "not rendered" note
// for a "rendered, founder to check" note. Status stays draft: the founder approves from the contact
// sheet (scripts/figure-sheet.ts). Re-running is safe: files and JSON are only written when they change,
// and the JSON keeps its 2-space layout with UTF-8 text unescaped.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FigureError, figureKinds, figureTitle, renderFigure } from "../lib/skills/figures/index.ts";
import { findBanned } from "../lib/skills/safety.ts";

export const PENDING_NOTE = "Figure not rendered yet: the source drew it with a script myKx does not run. Port to a trusted SVG before review.";
export const RENDERED_NOTE = "Figure rendered from figure_spec on 27 Oct by scripts/render-figures.ts; founder to check it.";

type Item = Record<string, unknown> & { id: string; stem: string; passage?: string; figure?: string; figure_spec?: unknown; notes?: string };

/** File name for a group of items sharing one figure: b1a+b1b+b1c → "…-b1abc", q10…q13 → "…-q10-q13". */
export function figureName(ids: string[]): string {
  if (ids.length === 1) return ids[0];
  const parts = ids.map((id) => /^(.*\d)([a-z])$/.exec(id));
  if (parts.every(Boolean) && new Set(parts.map((m) => m?.[1])).size === 1) return `${parts[0]?.[1]}${parts.map((m) => m?.[2]).join("")}`;
  return `${ids[0]}-${ids[ids.length - 1].split("-").pop()}`;
}

/** The item with `figure` set (just before figure_spec) and its pending note replaced. */
export function withFigure(item: Item, figure: string): Item {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) {
    if (k === "figure") continue;
    if (k === "figure_spec") out.figure = figure;
    out[k] = v;
  }
  if (!("figure" in out)) out.figure = figure;
  const notes = typeof item.notes === "string" ? item.notes : "";
  out.notes = notes.includes(PENDING_NOTE) ? notes.replace(PENDING_NOTE, RENDERED_NOTE) : notes.includes(RENDERED_NOTE) ? notes : [notes, RENDERED_NOTE].filter(Boolean).join(" ");
  return out as Item;
}

interface Result {
  rendered: string[];
  files: string[];
  errors: string[];
  kinds: Map<string, Set<string>>;
}

export function renderPacks(skillsDir: string, opts: { force?: boolean; write?: boolean } = {}): Result {
  const res: Result = { rendered: [], files: [], errors: [], kinds: new Map() };
  for (const pack of readdirSync(skillsDir).sort()) {
    const itemDir = join(skillsDir, pack, "items");
    if (!existsSync(itemDir) || !statSync(itemDir).isDirectory()) continue;
    for (const file of readdirSync(itemDir).filter((f) => f.endsWith(".json")).sort()) {
      const path = join(itemDir, file);
      const raw = readFileSync(path, "utf8");
      const items = JSON.parse(raw) as Item[];
      const todo = items.filter((it) => it.figure_spec !== undefined && (!it.figure || (opts.force && (it.notes ?? "").includes(RENDERED_NOTE))));
      if (!todo.length) continue;
      const groups = new Map<string, Item[]>();
      for (const it of todo) {
        const key = JSON.stringify(it.figure_spec);
        groups.set(key, [...(groups.get(key) ?? []), it]);
      }
      const done = new Map<string, string>();
      for (const group of groups.values()) {
        const ids = group.map((g) => g.id);
        const name = figureName(ids);
        try {
          const svg = renderFigure(group[0].figure_spec, { id: name, title: figureTitle(group) });
          const banned = findBanned(svg);
          if (banned.length) throw new FigureError(`rendered SVG trips the content scanner: ${banned.map((b) => b.label).join(", ")}`);
          const rel = `figures/${name}.svg`;
          const out = join(skillsDir, pack, rel);
          if (opts.write !== false) {
            mkdirSync(join(skillsDir, pack, "figures"), { recursive: true });
            if (!existsSync(out) || readFileSync(out, "utf8") !== svg) writeFileSync(out, svg);
          }
          res.files.push(`${pack}/${rel}`);
          for (const k of figureKinds(group[0].figure_spec)) res.kinds.set(k, (res.kinds.get(k) ?? new Set()).add(ids.join(" ")));
          for (const id of ids) done.set(id, rel);
          res.rendered.push(...ids);
        } catch (e) {
          res.errors.push(`${pack}/${file} ${ids.join(", ")}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      const next = items.map((it) => (done.has(it.id) ? withFigure(it, done.get(it.id) as string) : it));
      const text = JSON.stringify(next, null, 2) + "\n";
      if (opts.write !== false && text !== raw) writeFileSync(path, text);
    }
  }
  return res;
}

if (import.meta.main) {
  const args = new Set(process.argv.slice(2));
  const res = renderPacks(join(import.meta.dirname, "..", "content", "skills"), { force: args.has("--force"), write: !args.has("--check") });
  console.log(`${args.has("--check") ? "Checked" : "Rendered"} ${res.rendered.length} items into ${res.files.length} figures.`);
  for (const [k, ids] of [...res.kinds].sort()) console.log(`  ${k.padEnd(16)} ${[...ids].length} figure(s)`);
  if (res.errors.length) {
    console.error(`\n${res.errors.length} could not be rendered:\n  ${res.errors.join("\n  ")}`);
    process.exitCode = 1;
  }
}
