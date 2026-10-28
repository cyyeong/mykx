// The Game Arcade's registry (GAMES.md §2). Adding a game is adding an entry here and a screen; the hub shows
// only games that fit the child's band and levels. Every game practises the child's own syllabus.

export type GameBand = "junior" | "teen";
export type GameLevel = "P3" | "P6" | "Sec 2";

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
    bands: ["junior", "teen"],
    levels: ["P3", "P6", "Sec 2"],
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
    bands: ["junior"],
    levels: ["P3"],
    subject: "typing",
    tag: "Typing · P3 Science life cycles",
    pitch: "Type the stage you see. Every right word grows a flower. No timer.",
    art: "/art/scenes/terrarium",
    route: "/arcade/word-garden",
    status: "soon",
  },
  {
    id: "neon-strike",
    name: "Neon Strike",
    bands: ["teen"],
    levels: ["P6", "Sec 2"],
    subject: "typing",
    tag: { P3: "", P6: "Typing · P6 Science answers", "Sec 2": "Typing · Sec 2 Science answers" },
    pitch: "Answer by typing it. Beams fire only on the right keys. Track your words a minute.",
    art: "/art/games/neon-arena",
    route: "/arcade/neon-strike",
    status: "soon",
  },
  { id: "number-dash", name: "Number Dash", bands: ["junior"], levels: ["P3"], subject: "maths", tag: "Maths · P3 times tables", pitch: "Race along the sky path by answering facts.", art: "/art/scenes/quest-map", route: null, status: "soon" },
  { id: "stroke-quest", name: "Stroke Quest", bands: ["junior"], levels: ["P3"], subject: "chinese", tag: "Chinese · P3 stroke order", pitch: "Trace each character stroke by stroke from your word cards.", art: "/art/scenes/treasure-vault", route: null, status: "soon" },
  { id: "ratio-rescue", name: "Ratio Rescue", bands: ["teen"], levels: ["P6"], subject: "maths", tag: "Maths · P6 ratio", pitch: "Balance the bridges with the right ratios.", art: "/art/scenes/quest-map", route: null, status: "soon" },
  { id: "circuit-builder", name: "Circuit Builder", bands: ["teen"], levels: ["Sec 2"], subject: "science", tag: "Science · Sec 2 electricity", pitch: "Wire the stage lights without blowing a fuse.", art: "/art/games/neon-arena", route: null, status: "soon" },
];

/** The cabinets a child sees, ready ones first. */
export function gamesFor(band: GameBand, level: GameLevel): (GameEntry & { tagText: string })[] {
  return GAMES.filter((g) => g.bands.includes(band) && g.levels.includes(level))
    .map((g) => ({ ...g, tagText: typeof g.tag === "string" ? g.tag : g.tag[level] }))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "ready" ? -1 : 1));
}
