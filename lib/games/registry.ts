// The Game Arcade's registry (GAMES.md §2). Adding a game is adding an entry here and a screen. Every game is open to
// every child (founder, 28 Oct): only its words, questions and difficulty follow the child's level, so each one
// practises their own syllabus.

export type GameBand = "junior" | "teen";
export type GameLevel = "P3" | "P6" | "Sec 2";

const ALL_BANDS: readonly GameBand[] = ["junior", "teen"];
const ALL_LEVELS: readonly GameLevel[] = ["P3", "P6", "Sec 2"];

export type GameEntry = {
  id: string;
  name: string;
  bands: readonly GameBand[];
  levels: readonly GameLevel[];
  subject: "typing" | "english" | "maths" | "science" | "chinese";
  /** Shown on the cabinet: what this practises, in the child's syllabus terms. */
  tag: Record<GameLevel, string> | string;
  pitch: string;
  /** Background art path for <Art base>. */
  art: string;
  route: string | null;
  status: "ready" | "soon";
};

export const GAMES: readonly GameEntry[] = [
  {
    id: "star-typer",
    name: "Star Typer",
    bands: ALL_BANDS,
    levels: ALL_LEVELS,
    subject: "typing",
    tag: { P3: "Typing · P3 English words", P6: "Typing · P6 vocabulary", "Sec 2": "Typing · Sec 2 vocabulary" },
    pitch: "Kix fires a star-bolt for every right key. Ghost hands show each finger.",
    art: "/art/games/space",
    route: "/arcade/star-typer",
    status: "ready",
  },
  {
    id: "word-garden",
    name: "Word Garden",
    bands: ALL_BANDS,
    levels: ALL_LEVELS,
    subject: "typing",
    tag: { P3: "Typing · P3 Science life cycles", P6: "Typing · P6 Science: cycles", "Sec 2": "Typing · Sec 2 Science: living things" },
    pitch: "Type the word for the picture. Every right word grows a flower. No timer.",
    art: "/art/scenes/terrarium",
    route: "/arcade/word-garden",
    status: "ready",
  },
  {
    id: "neon-strike",
    name: "Neon Strike",
    bands: ALL_BANDS,
    levels: ALL_LEVELS,
    subject: "typing",
    tag: { P3: "Typing · P3 Science answers", P6: "Typing · P6 Science answers", "Sec 2": "Typing · Sec 2 Science answers" },
    pitch: "Answer by typing it. Beams fire only on the right keys. Track your words a minute.",
    art: "/art/games/neon-arena",
    route: "/arcade/neon-strike",
    status: "ready",
  },
  { id: "number-dash", name: "Number Dash", bands: ALL_BANDS, levels: ALL_LEVELS, subject: "maths", tag: { P3: "Maths · P3 times tables", P6: "Maths · P6 fractions and percentages", "Sec 2": "Maths · Sec 2 algebra" }, pitch: "Race along the sky path by answering facts.", art: "/art/scenes/quest-map", route: null, status: "soon" },
  { id: "stroke-quest", name: "Stroke Quest", bands: ALL_BANDS, levels: ALL_LEVELS, subject: "chinese", tag: { P3: "Chinese · P3 stroke order", P6: "Chinese · P6 characters", "Sec 2": "Chinese · Sec 2 characters" }, pitch: "Trace each character stroke by stroke from your word cards.", art: "/art/scenes/treasure-vault", route: null, status: "soon" },
  { id: "ratio-rescue", name: "Ratio Rescue", bands: ALL_BANDS, levels: ALL_LEVELS, subject: "maths", tag: { P3: "Maths · P3 sharing and grouping", P6: "Maths · P6 ratio", "Sec 2": "Maths · Sec 2 ratio and proportion" }, pitch: "Balance the bridges with the right amounts.", art: "/art/scenes/quest-map", route: null, status: "soon" },
  { id: "circuit-builder", name: "Circuit Builder", bands: ALL_BANDS, levels: ALL_LEVELS, subject: "science", tag: { P3: "Science · P3 magnets", P6: "Science · P6 circuits", "Sec 2": "Science · Sec 2 electricity" }, pitch: "Wire the stage lights without blowing a fuse.", art: "/art/games/neon-arena", route: null, status: "soon" },
];

/** The cabinets a child sees, ready ones first. */
export function gamesFor(band: GameBand, level: GameLevel): (GameEntry & { tagText: string })[] {
  return GAMES.filter((g) => g.bands.includes(band) && g.levels.includes(level))
    .map((g) => ({ ...g, tagText: typeof g.tag === "string" ? g.tag : g.tag[level] }))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "ready" ? -1 : 1));
}
