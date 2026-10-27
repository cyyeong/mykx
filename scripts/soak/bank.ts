// Loads every skill pack under content/skills/ for the soak scripts. Offline, read-only.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SkillItemSchema, SkillManifestSchema } from "../../lib/skills/schema.ts";
import type { SkillItem, SkillManifest } from "../../lib/types.ts";

export const ROOT = join(import.meta.dirname, "..", "..");
export const SKILLS = join(ROOT, "content", "skills");
export const OUT = join(import.meta.dirname, "out");

export interface SchemaIssue {
  pack: string;
  file: string;
  id: string;
  message: string;
}

export interface Pack {
  id: string;
  manifest: SkillManifest;
  /** Items that passed the schema (raw items that failed are in `issues`). */
  items: (SkillItem & { file: string })[];
  issues: SchemaIssue[];
}

export function loadPacks(): Pack[] {
  const packs: Pack[] = [];
  for (const id of readdirSync(SKILLS).sort()) {
    const dir = join(SKILLS, id);
    if (!existsSync(join(dir, "skill.json"))) continue;
    const issues: SchemaIssue[] = [];
    const m = SkillManifestSchema.safeParse(JSON.parse(readFileSync(join(dir, "skill.json"), "utf8")));
    if (!m.success) issues.push({ pack: id, file: "skill.json", id, message: m.error.message });
    const manifest = (m.success ? m.data : JSON.parse(readFileSync(join(dir, "skill.json"), "utf8"))) as SkillManifest;
    const items: Pack["items"] = [];
    const itemDir = join(dir, "items");
    for (const file of existsSync(itemDir) ? readdirSync(itemDir).filter((f) => f.endsWith(".json")).sort() : []) {
      const raw: unknown[] = JSON.parse(readFileSync(join(itemDir, file), "utf8"));
      for (const r of raw) {
        const parsed = SkillItemSchema.safeParse(r);
        if (parsed.success) items.push({ ...(parsed.data as SkillItem), file });
        else issues.push({ pack: id, file, id: String((r as { id?: string }).id ?? "?"), message: parsed.error.issues.map((i) => i.message).join("; ") });
      }
    }
    packs.push({ id, manifest, items, issues });
  }
  return packs;
}

export function writeOut(name: string, data: string | object): string {
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, name);
  writeFileSync(path, typeof data === "string" ? data : JSON.stringify(data, null, 2));
  return path;
}

/** A Markdown table. */
export function table(header: string[], rows: (string | number)[][]): string {
  const line = (r: (string | number)[]) => `| ${r.map((c) => String(c).replace(/\|/g, "\\|")).join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n");
}
