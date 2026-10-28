// Server only: the skill packs on disk (id, version, topic ids), for the knowledge agent's routing and prompt.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface PackInfo {
  id: string;
  version: string;
  title: string;
  topics: string[];
}

export function packsOnDisk(root = process.cwd()): PackInfo[] {
  const dir = join(root, "content", "skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, "skill.json")))
    .map((d) => {
      const m = JSON.parse(readFileSync(join(dir, d, "skill.json"), "utf8")) as { id: string; version: string; title?: string; topics?: { id: string }[] };
      return { id: m.id, version: m.version, title: m.title ?? m.id, topics: (m.topics ?? []).map((t) => t.id) };
    });
}
