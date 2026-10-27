// The founder's children appear in committed files only by stand-in names: Leonard (Sec 2), Abby (P6) and
// Jordan (P3). These are not their real names (docs/README.md). The real names live in the git-ignored
// content-private/names.json as { "<real name>": "<stand-in>" }. The importer swaps them for the stand-ins the
// moment it reads a private source, and the scanner blocks both. Without the file (CI, a fresh clone) only the
// stand-ins are known, which is all committed content can contain.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const STAND_INS = ["Leonard", "Abby", "Jordan"] as const;

export function privateNames(file = join(process.cwd(), "content-private", "names.json")): Record<string, string> {
  try {
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Real names → stand-ins, whole words, keeping the case of each match (Name, name, NAME). */
export function pseudonymise(text: string, map: Record<string, string> = privateNames()): string {
  let out = text;
  for (const [real, stand] of Object.entries(map)) {
    out = out.replace(new RegExp(`\\b${real}\\b`, "gi"), (m) =>
      m === m.toUpperCase() ? stand.toUpperCase() : m[0] === m[0].toLowerCase() ? stand.toLowerCase() : stand,
    );
  }
  return out;
}
