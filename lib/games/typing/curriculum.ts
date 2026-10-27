// The typing path (GAMES.md §3): nine stages from the home row to typing answers. Stages 1–4 are built in;
// 5–9 draw on the child's own skill packs (spelling lists, subject words, reviewed questions), wired on Day 4.

export type StageSource = "built-in" | "spelling" | "subject" | "answer" | "match" | "sentence";

export type Stage = {
  n: number;
  name: string;
  what: string;
  source: StageSource;
  /** Built-in stages: the word bank, easiest first. Levels take slices of it. */
  words?: readonly string[];
  /** New keys this stage introduces (shown on the path and in the result card). */
  newKeys?: string;
};

export const STAGES: readonly Stage[] = [
  {
    n: 1,
    name: "Home row heroes",
    what: "A S D F, J K L ;",
    source: "built-in",
    newKeys: "asdfghjkl;",
    words: ["as", "ad", "lad", "sad", "dad", "add", "all", "ask", "fall", "hall", "half", "glad", "flag", "dash", "flash", "glass", "salad", "shall"],
  },
  {
    n: 2,
    name: "Reach up",
    what: "The top row",
    source: "built-in",
    newKeys: "qwertyuiop",
    words: ["we", "it", "to", "up", "pie", "toy", "yes", "wet", "tree", "rope", "hope", "fire", "quiet", "water", "tiger", "power"],
  },
  {
    n: 3,
    name: "Reach down",
    what: "The bottom row",
    source: "built-in",
    newKeys: "zxcvbnm,./",
    words: ["box", "zoo", "van", "cab", "man", "bin", "mix", "cave", "nice", "comb", "oven", "bench", "zebra", "camel", "buzz", "climb"],
  },
  {
    n: 4,
    name: "Little words",
    what: "Short words you know",
    source: "built-in",
    words: ["the", "and", "was", "frog", "egg", "pond", "leaf", "bee", "moth", "ant", "sun", "tail", "web", "log", "bug", "fern", "nest", "said", "they", "come"],
  },
  { n: 5, name: "My spelling words", what: "From your English lists", source: "spelling" },
  { n: 6, name: "Subject words", what: "Words from your science and maths", source: "subject" },
  { n: 7, name: "Answer blast", what: "Type the answer to a question", source: "answer" },
  { n: 8, name: "Match it", what: "Type the word for the picture or clue", source: "match" },
  { n: 9, name: "Sentence sprint", what: "The boss level", source: "sentence" },
];

export const LEVELS_PER_STAGE = 5;
export const WORDS_PER_LEVEL = 10;

/**
 * The words for a built-in level: a window that slides through the stage's bank, so later levels lean on the
 * longer words. Deterministic (the same level always has the same words).
 */
export function builtInLevel(stage: number, level: number): string[] {
  const s = STAGES.find((x) => x.n === stage);
  if (!s?.words) throw new Error(`Stage ${stage} isn't built in.`);
  const bank = s.words;
  const span = Math.min(WORDS_PER_LEVEL, bank.length);
  const start = Math.round(((bank.length - span) * (Math.min(Math.max(level, 1), LEVELS_PER_STAGE) - 1)) / (LEVELS_PER_STAGE - 1));
  return bank.slice(start, start + span);
}

/** Juniors start at stage 1; teens start at stage 4 until a placement round says otherwise. */
export function startingStage(band: "junior" | "teen"): number {
  return band === "junior" ? 1 : 4;
}
