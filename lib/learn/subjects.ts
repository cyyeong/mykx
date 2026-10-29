// One source of truth for a kid's subjects (founder, 29 Oct: "every data point and interaction is scoped to their
// subjects"). A kid's subjects are the published skill packs whose skill.json `level` is the kid's level: P3 gets
// English, Maths, Science and Chinese; P6 gets Maths, Science and Chinese; Sec 2 gets Science and Chinese. Packs are read through the
// Skill Engine's loader (lib/skills/runtime.ts `loadPack`), so an admin's published version wins over the pack on
// disk and only reviewed items are ever served. Every learning surface asks here: the Learn hub and subject pages,
// the question player, POST /api/attempts and the Kix routes (tutor, reason, spark), which refuse an item from
// another level's pack. Server only (node:fs through the loader).
import { allPackIds } from "../skills/overrides.ts";
import { loadPack, type Pack } from "../skills/runtime.ts";
import type { SkillItem, SkillSubject, SkillTopic } from "../types.ts";

/** School order: English, Maths, Science, then the mother tongue. */
export const SUBJECT_ORDER: readonly SkillSubject[] = ["english", "maths", "science", "chinese"];

export const SUBJECT_NAMES: Record<SkillSubject, string> = { english: "English", maths: "Maths", science: "Science", chinese: "Chinese" };

export interface Subject {
  /** The pack id, e.g. "p6-maths". Also the subject page's slug: /learn/p6-maths. */
  id: string;
  /** The pack version every attempt is stamped with. */
  version: string;
  /** The pack's own title ("P6 Maths (PSLE)"). */
  title: string;
  subject: SkillSubject;
  /** "Maths". */
  name: string;
  level: string;
  /** "P6 Maths". */
  label: string;
  topics: SkillTopic[];
  /** Reviewed items only, every type (mcq, short, open, card). */
  items: SkillItem[];
}

function toSubject(p: Pack): Subject {
  const subject = p.subject as SkillSubject;
  const name = SUBJECT_NAMES[subject] ?? p.subject;
  return { id: p.id, version: p.version, title: p.title, subject, name, level: p.level, label: `${p.level} ${name}`, topics: p.topics, items: p.items };
}

/** One published pack as a subject (any level), or null. */
export function loadSubject(packId: string, root = process.cwd()): Subject | null {
  const pack = loadPack(packId, root);
  return pack ? toSubject(pack) : null;
}

/** The kid's subjects: published packs whose manifest level is the kid's level, in school order. */
export function subjectsFor(level: string | null | undefined, root = process.cwd()): Subject[] {
  if (!level) return [];
  return allPackIds(root)
    .map((id) => loadSubject(id, root))
    .filter((s): s is Subject => s !== null && s.level === level)
    .sort((a, b) => SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject) || a.id.localeCompare(b.id));
}

/** One of the kid's own subjects by pack id; null for another level's pack or an unknown id. */
export function subjectFor(level: string | null | undefined, packId: string, root = process.cwd()): Subject | null {
  return subjectsFor(level, root).find((s) => s.id === packId) ?? null;
}

/** A reviewed item from any published pack, with its subject (and so its pack version). */
export function findItem(itemId: string, root = process.cwd()): { item: SkillItem; subject: Subject } | null {
  for (const id of allPackIds(root)) {
    const subject = loadSubject(id, root);
    const item = subject?.items.find((i) => i.id === itemId);
    if (subject && item) return { item, subject };
  }
  return null;
}

export type ItemAccess = { ok: true; item: SkillItem; subject: Subject } | { ok: false; reason: "not-found" | "other-level" };

/**
 * An item the kid may be served: it must be reviewed and come from one of the kid's own level's packs. An item
 * from another level's pack is refused ("other-level"), never served, marked or explained.
 */
export function itemForKid(level: string | null | undefined, itemId: string, root = process.cwd()): ItemAccess {
  const found = findItem(itemId, root);
  if (!found) return { ok: false, reason: "not-found" };
  if (!level || found.subject.level !== level) return { ok: false, reason: "other-level" };
  return { ok: true, ...found };
}

export { subskillName } from "./names.ts";
