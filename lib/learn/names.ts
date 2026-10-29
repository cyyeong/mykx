// Subskill names for a child: the packs keep subskills as snake_case ids ("tense_simple_present", "sva"); the
// Learn pages and the done page spell them out. Pure.

/** Short forms in subskill ids, spelt out. */
const WORDS: Record<string, string> = {
  "1d": "1-digit",
  "3d": "3-digit",
  "4digit": "4-digit",
  "24h": "24-hour",
  h: "hours",
  min: "minutes",
  ba: "before and after:",
  comp: "comprehension:",
  rc: "reading:",
  vt: "visual text:",
  lnl: "living or non-living:",
  sva: "subject-verb agreement",
  npt: "not possible to tell",
  gpe: "GPE",
  ke: "KE",
  gst: "GST",
  ph: "pH",
  stis: "STIs",
  mcq: "choices",
  open: "written",
  char: "character",
  div: "division",
  mul: "multiplication",
  wh: "wh-",
  vocab: "vocabulary",
  noncontact: "non-contact",
};

/** "tense_simple_present" → "Tense simple present", "sva" → "Subject-verb agreement", "tables_6_9" → "Tables 6 to 9". */
export function subskillName(id: string): string {
  const parts = id.split("_").filter(Boolean);
  const words: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (/^\d+$/.test(p) && /^\d+$/.test(parts[i + 1] ?? "")) {
      words.push(`${p} to ${parts[i + 1]}`);
      i++;
      continue;
    }
    words.push(WORDS[p] ?? p);
  }
  const text = words.join(" ").replace(/: *$/, "").replace(/wh- /, "wh-").replace("hours minutes", "hours and minutes");
  return text ? text[0].toUpperCase() + text.slice(1) : id;
}
