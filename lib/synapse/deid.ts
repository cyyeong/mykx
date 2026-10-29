// De-identification before any reviewer sees a case (docs/prd/SYNAPSE.md §9): the family's nicknames become
// "Learner" or "Parent", and email addresses, phone numbers, web links and street addresses are removed. Reviewers
// get the level and subject, never an age, a household or an id.

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
// Singapore numbers (8 digits starting 3, 6, 8 or 9, with or without +65 and a space) and other long digit runs.
const PHONE = /(?:\+?65[\s-]?)?\b[3689]\d{3}[\s-]?\d{4}\b|\b\d{9,}\b/g;
const ADDRESS = /\b(?:blk|block)\s*\d+[a-z]?\b[^,.\n]{0,40}|\b\d{1,4}[a-z]?\s+[a-z][a-z ]{2,30}\s(?:road|rd|street|st|avenue|ave|drive|dr|crescent|cres|lane|ln)\b/gi;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Replaces each name (whole words, any case) and the contact details. */
export function deidentify(text: string, names: { learner?: readonly string[]; parent?: readonly string[] } = {}): string {
  let out = text.replace(EMAIL, "[email]").replace(URL_RE, "[link]").replace(PHONE, "[number]").replace(ADDRESS, "[address]");
  const swap = (list: readonly string[] | undefined, label: string) => {
    for (const n of [...(list ?? [])].filter((x) => x && x.trim().length >= 2).sort((a, b) => b.length - a.length)) {
      out = out.replace(new RegExp(`\\b${escape(n.trim())}\\b`, "gi"), label);
    }
  };
  swap(names.learner, "Learner");
  swap(names.parent, "Parent");
  return out;
}

/** True when text still holds one of the names (a caution or a fix must never carry one). */
export function holdsName(text: string, names: readonly string[]): boolean {
  return names.some((n) => n.trim().length >= 2 && new RegExp(`\\b${escape(n.trim())}\\b`, "i").test(text));
}
