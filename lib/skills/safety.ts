// What must never appear in a public skill pack (AGENTS.md hard rule 10,
// docs/prd/SKILL_ENGINE.md §8). Shared by the importer (scripts/import-skill.ts),
// which refuses to write a pack that matches, and by content/skills.test.ts.
import { createHash } from "node:crypto";
import { STAND_INS, privateNames } from "./private-names.ts";

export interface BannedPattern {
  label: string;
  re: RegExp;
}

export interface BannedHit {
  label: string;
  match: string;
  line: number;
  context: string;
}

/**
 * The founder's children: their stand-in names, plus the real ones from the private folder's names.json when it is configured
 * (never committed). Packs are child-agnostic; their details live in the learner record and Kix's Notebook.
 */
const CHILD_NAMES = [...STAND_INS, ...Object.keys(privateNames())];

/**
 * Places tied to the children themselves (their schools, neighbourhood, tuition centre)
 * and a parent's name, stored as SHA-256 of the lowercased phrase so this repo never
 * spells them out. Matched against every 1–3 word phrase of a line.
 */
const PRIVATE_PHRASE_HASHES = new Set([
  "88f0b7a740275dfda1d3fe3c798fcf173f99b18bc98296dd6daf9dfde5f6a911",
  "847d8f71175fe394ea39b9ccc20ef22602d7916b385b858cd872bc420e46ea4e",
  "9b8da09c4b09f3ca3cd2620998cea1979265edac0724a6b27250f43fe344800b",
  "f0837d522aaff7d04a2843f2917bd5338b4d61b2d84669d3fc9656118d4e7a49",
  "60b0fe2459becf8e4c01f8b85634ac653a4440580b9a68234a3cae54f1513e45",
  "be3d606bbbfa87561b4d8d5be4d7b2550037d6ff0fabe2efc17e8a9f284e5bc3",
  "c580cc0b46f4199f5b99826f7c9d70252406c47a344568ed05d33154ebaeff6c",
  "502913bfdd49eab564282dff101e6d167321237eeec66eedb2a438ed80fdeaa0",
]);

function privatePhrase(line: string): string | null {
  const words = line.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (let n = 1; n <= 3; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const phrase = words.slice(i, i + n).join(" ");
      if (PRIVATE_PHRASE_HASHES.has(createHash("sha256").update(phrase).digest("hex"))) return phrase;
    }
  }
  return null;
}

/** Schools whose papers were used as private reference. Patterns, not paper text. */
const SCHOOLS = [
  "Nan Hua",
  "Ai Tong",
  "Tao Nan",
  "Red Swastika",
  "Catholic High",
  "Henry Park",
  "Elias Park",
  "Methodist Girls",
  "Raffles Girls",
  "Anglo[- ]Chinese",
  "Rosyth",
  "Yuhua",
  "Jurong West Primary",
  "Admiralty Primary",
  "Evergreen Primary",
  "Bukit Timah Primary",
  "CHIJ",
];

export const BANNED_PATTERNS: BannedPattern[] = [
  ...CHILD_NAMES.map((name) => ({ label: `child name (${name})`, re: new RegExp(`\\b${name}\\b`, "i") })),
  { label: "diagnosis", re: /adhd/i },
  ...SCHOOLS.map((s) => ({ label: `school name (${s.replace(/\[.*\]/, "-")})`, re: new RegExp(`\\b${s.replace(/ /g, "\\s+")}`, "i") })),
  { label: "school code", re: /\b(?:ACS|ACSJ|ACSP|RGPS|MGS|CHS|SCGS)\b/ },
  { label: "school code", re: /\bACS\s*\((?:J|P)\)/ },
  { label: "paper code", re: /\b(?:NH|AT|TN|AJ|AP)\d{1,2}[a-z]?\b/ },
  { label: "paper code", re: /\b(?:RS|TN|AT|CH|ACS)\s+P[12][ABLS]?\b/ },
  { label: "past-paper site", re: /sgexam|testpapers?\s*free/i },
  { label: "exam-paper source", re: /\b20\d\d\s+(?:P\d\s+)?(?:EOY|EYE|SA[12]|WA\d?|prelims?|preliminary)\b/i },
  { label: "exam-paper source", re: /\bprelim(?:inary)?\s+(?:papers?|questions?|exams?)\b/i },
  { label: "exam-paper source", re: /\bpast[- ]papers?[- ](?:verified|20\d\d)\b|question[-_ ]bank[-_ ]20\d\d/i },
  { label: "learner notes", re: /known facts about/i },
  { label: "learner trait", re: /loses focus|easily distracted|easily pressured|\bforgetful\b|(?:with|and) weak retention|attention (?:deficit|span disorder)/i },
  { label: "exam date", re: /\b\d{1,2}\s+(?:Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?)\s+2026\b/i },
  { label: "exam date", re: /\b(?:September|October|November)\s+\d{1,2},?\s+2026\b/i },
  { label: "exam date", re: /\b2026-(?:0[89]|1[01])-\d{2}\b/ },
  { label: "learner profile field", re: /"(?:exam_date|notes_for_tutor|error_log|five_to_keep|student)"\s*:/ },
];

/** Files that would hold a learner's state rather than teaching content. */
export const FORBIDDEN_FILE_RE = /(?:profile|tracker|progress[-_ ]?card|learner|session[-_]log)|\.(?:py|sh|pyc|pdf|ttf|otf)$/i;

/**
 * The text of a pack file as it should be scanned. A manifest's `excluded` and
 * `legacy_scripts` lists name private source files on purpose, so they are skipped.
 */
export function scannableText(relPath: string, text: string): string {
  if (!/(^|\/)skill\.json$/.test(relPath)) return text;
  const manifest = JSON.parse(text) as Record<string, unknown>;
  delete manifest.excluded;
  delete manifest.legacy_scripts;
  return JSON.stringify(manifest, null, 2);
}

export function findBanned(text: string): BannedHit[] {
  const hits: BannedHit[] = [];
  const lines = text.split("\n");
  for (const { label, re } of BANNED_PATTERNS) {
    lines.forEach((line, i) => {
      const m = re.exec(line);
      if (m) {
        const at = m.index;
        hits.push({ label, match: m[0], line: i + 1, context: line.slice(Math.max(0, at - 50), at + m[0].length + 50) });
      }
    });
  }
  lines.forEach((line, i) => {
    const phrase = privatePhrase(line);
    if (phrase) hits.push({ label: "private place or name", match: phrase, line: i + 1, context: line.slice(0, 120) });
  });
  return hits;
}
