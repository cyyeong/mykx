// Reads skill packs from content/skills/ for printable papers (server only: node:fs). Items are checked
// with the pack schema; anything that fails is left out, and only reviewed items are ever printed.
// Figures are inlined as data URIs with their natural size, so the paper prints without extra requests.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { allPackIds, packFile, packFilesIn } from "../skills/overrides.ts";
import { SkillItemSchema, SkillManifestSchema } from "../skills/schema.ts";
import type { SkillItem, SkillLevel, SkillManifest, SkillSubject } from "../types.ts";
import { buildBlocks, blockQuestions } from "./blocks.ts";
import type { PackInfo, PrintBank } from "./paper.ts";

const SKILLS = join(process.cwd(), "content", "skills");
const PACK_ID = /^[a-z0-9][a-z0-9-]*$/;

export interface PackSummary {
  id: string;
  title: string;
  subject: SkillSubject;
  level: SkillLevel;
  language: string;
  /** Printable questions (numbered questions, a multi-part question counts once). */
  questions: number;
}

function readManifest(id: string): PackInfo | null {
  if (!PACK_ID.test(id)) return null;
  // The pack's published version when an admin has published one, else the pack on disk (lib/skills/overrides.ts).
  const text = packFile(id, "skill.json");
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = SkillManifestSchema.safeParse(raw);
  // A manifest that gained a field the schema doesn't know yet still prints, as long as the basics are there.
  const m = (parsed.success ? parsed.data : raw) as Partial<SkillManifest>;
  if (m.status !== "published" || !m.id || !m.title || !m.subject || !m.level || !Array.isArray(m.topics)) return null;
  return {
    id: m.id,
    title: m.title,
    subject: m.subject,
    level: m.level,
    language: m.language ?? "en",
    topics: m.topics,
    attributions: m.attributions,
  };
}

function readItems(id: string): SkillItem[] {
  const items: SkillItem[] = [];
  for (const file of packFilesIn(id, "items")) {
    let raw: unknown;
    try {
      raw = JSON.parse(packFile(id, file) ?? "[]");
    } catch {
      continue; // a file mid-edit; skip it rather than break the page
    }
    if (!Array.isArray(raw)) continue;
    for (const r of raw) {
      const parsed = SkillItemSchema.safeParse(r);
      if (parsed.success && parsed.data.skill === id) items.push(parsed.data as SkillItem);
    }
  }
  return items;
}

/** One published pack with its items, or null (unknown id, unpublished, or not a pack). */
export function loadPrintBank(id: string): PrintBank | null {
  const manifest = readManifest(id);
  return manifest ? { manifest, items: readItems(id) } : null;
}

/** Every published pack, with how many printable questions it has. */
export function listPrintPacks(): PackSummary[] {
  return allPackIds().flatMap((id) => {
    const bank = loadPrintBank(id);
    if (!bank) return [];
    const { manifest } = bank;
    const questions = buildBlocks(bank.items).reduce((s, b) => s + blockQuestions(b), 0);
    return [{ id, title: manifest.title, subject: manifest.subject, level: manifest.level, language: manifest.language, questions }];
  });
}

// ─── Figures ───────────────────────────────────────────────────────────────

export interface PrintFigure {
  src: string;
  /** Natural size in millimetres at 96 px per inch. */
  widthMm: number;
  heightMm: number;
  /** A small raster picture (an icon), drawn small. */
  icon: boolean;
}

const MIME: Record<string, string> = { svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
const MM_PER_PX = 25.4 / 96;
const UNIT_PX: Record<string, number> = { "": 1, px: 1, pt: 4 / 3, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };

function svgSize(svg: string): { w: number; h: number } | null {
  const tag = /<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!tag) return null;
  const attr = (name: string) => new RegExp(`\\s${name}="([\\d.]+)(px|pt|mm|cm|in)?"`).exec(tag);
  const w = attr("width");
  const h = attr("height");
  if (w && h) return { w: Number(w[1]) * UNIT_PX[w[2] ?? ""], h: Number(h[1]) * UNIT_PX[h[2] ?? ""] };
  const box = /viewBox="[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/.exec(tag);
  return box ? { w: Number(box[1]), h: Number(box[2]) } : null;
}

function pngSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24 || buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** Data URIs and sizes for figure paths inside one pack. Paths outside `figures/` or missing files are skipped. */
export function loadFigures(packId: string, paths: readonly string[]): Record<string, PrintFigure> {
  const out: Record<string, PrintFigure> = {};
  if (!PACK_ID.test(packId)) return out;
  for (const rel of paths) {
    if (!/^figures\/[A-Za-z0-9._-]+$/.test(rel) || rel.includes("..")) continue;
    const ext = rel.split(".").pop()!.toLowerCase();
    const mime = MIME[ext];
    const path = join(SKILLS, packId, rel);
    if (!mime || !existsSync(path)) continue;
    const buf = readFileSync(path);
    const size = ext === "svg" ? svgSize(buf.toString("utf8")) : ext === "png" ? pngSize(buf) : null;
    const w = size?.w ?? 400;
    const h = size?.h ?? 300;
    out[rel] = {
      src: `data:${mime};base64,${buf.toString("base64")}`,
      widthMm: w * MM_PER_PX,
      heightMm: h * MM_PER_PX,
      icon: ext !== "svg" && w <= 400 && h <= 400,
    };
  }
  return out;
}
