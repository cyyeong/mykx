// Server only: the skill packs as Kix sees them now (id, version, topic ids, level and subject), for the knowledge
// agent's routing and prompt. Each pack's published version when it has one, else the pack on disk; imported packs
// count too (lib/skills/overrides.ts). Call refreshSkillOverrides first in a route.
import { allPackIds, hasDiskPack, packFile } from "../skills/overrides.ts";

export interface PackInfo {
  id: string;
  version: string;
  title: string;
  topics: string[];
  level: string | null;
  subject: string | null;
  tier: string | null;
  /** On disk (it has a built-in default), rather than imported. */
  builtIn: boolean;
}

export function packsOnDisk(root = process.cwd()): PackInfo[] {
  return allPackIds(root).flatMap((d) => {
    try {
      const m = JSON.parse(packFile(d, "skill.json", root) ?? "") as { id: string; version: string; title?: string; level?: string; subject?: string; tier?: string; topics?: { id: string }[] };
      return [{ id: m.id, version: m.version, title: m.title ?? m.id, topics: (m.topics ?? []).map((t) => t.id), level: m.level ?? null, subject: m.subject ?? null, tier: m.tier ?? null, builtIn: hasDiskPack(d, root) }];
    } catch {
      return [];
    }
  });
}
