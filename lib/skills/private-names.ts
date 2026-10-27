// The founder's children appear in committed files only by stand-in names: Leonard (Sec 2), Abby (P6) and
// Jordan (P3). These are not their real names (docs/README.md). The real names live outside this repository, in
// names.json inside the private folder named by MYKX_PRIVATE_DIR (set in .env.local, never committed) as
// { "<real name>": "<stand-in>" }. The importer swaps them for the stand-ins the moment it reads a private
// source, and the scanner blocks both. Without that folder (CI, a fresh clone, any other agent) only the stand-ins
// are known, which is all committed content can contain.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const STAND_INS = ["Leonard", "Abby", "Jordan"] as const;

/** A file in the private folder (MYKX_PRIVATE_DIR), or null when the folder isn't configured. */
export function privateFile(name: string): string | null {
  const dir = process.env.MYKX_PRIVATE_DIR;
  return dir ? join(dir, name) : null;
}

export function privateNames(file = privateFile("names.json")): Record<string, string> {
  try {
    return file && existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, string>) : {};
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
