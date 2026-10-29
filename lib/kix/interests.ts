// What a kid loves (founder, 29 Oct): picked in Sidekick Studio or set by a grown-up in Your family, kept on the
// kid's profile (profiles.interests). Kix uses them to spark a drifting kid's interest: a true, simple fact from
// their world, a line that ties it to the question (Muse Spark, Standard: the tutor's "spark" part), and a place
// in myKx that fits. Interests are chips from this fixed list, never free text, and never reach image or web
// prompts beyond the Studio's own props (lib/studio/prompt.ts). Pure, so client and server share it.

export const INTERESTS = ["Bugs and critters", "Jets", "Anime", "K-pop", "Dance", "Space", "Animals", "Music", "Football", "Robots", "Drawing"] as const;
export type Interest = (typeof INTERESTS)[number];
export const MAX_INTERESTS = 4;

export const isInterest = (v: string): v is Interest => (INTERESTS as readonly string[]).includes(v);

/** Known chips only, in the kid's order, at most four. */
export function cleanInterests(list: readonly string[]): Interest[] {
  return [...new Set(list)].filter(isInterest).slice(0, MAX_INTERESTS);
}

export interface SparkPlace {
  href: string;
  cta: string;
}

interface InterestSpark {
  /** Short, true facts a 9-year-old can read aloud. Kix's cached lines when Muse Spark isn't there. */
  facts: readonly string[];
  /** Where myKx has more of it. */
  place: SparkPlace;
  /** How the tutor may use the interest in an example (for the prompt). */
  flavour: string;
}

export const SPARKS: Readonly<Record<Interest, InterestSpark>> = {
  "Bugs and critters": {
    facts: ["A tadpole breathes with gills before it grows lungs.", "An ant can carry many times its own weight.", "A gecko's toes have millions of tiny hairs that let it walk up glass."],
    place: { href: "/critters", cta: "Visit your critters" },
    flavour: "tadpoles, ants, geckos and other small creatures",
  },
  Jets: {
    facts: ["A dragonfly can hover and even fly backwards, like a tiny helicopter.", "A bumblebee beats its wings about 200 times a second.", "Display jets fly in tight formation by watching each other's wingtips."],
    place: { href: "/squadron", cta: "Fly your squadron" },
    flavour: "display jets, flight and the insects that inspire them",
  },
  Anime: {
    facts: ["Animators draw the key poses first, then the drawings in between.", "Cartoons often hold one drawing for two frames, which is called animating on twos.", "A storyboard is a comic-strip plan of a scene, drawn before any animation."],
    place: { href: "/vibe", cta: "Make anime flashcards" },
    flavour: "drawing anime-style characters, storyboards and frames",
  },
  "K-pop": {
    facts: ["Pop dance routines are learned in counts of eight beats.", "A chorus usually comes back the same way each time, so the crowd can sing along.", "Groups practise in front of mirrors to match every move."],
    place: { href: "/arcade/neon-strike", cta: "Play Neon Strike" },
    flavour: "pop songs, choruses, beats and practising as a group",
  },
  Dance: {
    facts: ["Dancers learn a routine eight counts at a time.", "Mirroring a move means doing it the other way round, like a reflection.", "A short dance break gets your heart pumping and wakes up your brain."],
    place: { href: "/arcade/neon-strike", cta: "Play Neon Strike" },
    flavour: "dance moves, counts of eight and routines",
  },
  Space: {
    facts: ["A day on Mars is only about 40 minutes longer than a day on Earth.", "The Moon has no air, so footprints there can last a very long time.", "Light from the Sun takes about 8 minutes to reach Earth."],
    place: { href: "/vibe", cta: "Make space flashcards" },
    flavour: "planets, rockets and the night sky",
  },
  Animals: {
    facts: ["An octopus has three hearts.", "Elephants can recognise themselves in a mirror.", "A sea otter holds hands with another otter while it sleeps so it won't drift away."],
    place: { href: "/vibe", cta: "Make animal flashcards" },
    flavour: "animals and how they live",
  },
  Music: {
    facts: ["A song's beat is like a clock that everyone in the band follows.", "Many pop songs repeat a short pattern of four chords.", "Words set to a tune are often easier to remember."],
    place: { href: "/vibe", cta: "Make flashcards" },
    flavour: "music, beats and songs",
  },
  Football: {
    facts: ["A football pitch is about 100 metres long.", "Players run about 10 kilometres in one match.", "A curling free kick bends because the ball spins as it flies."],
    place: { href: "/arcade", cta: "Open the Arcade" },
    flavour: "football, passes and goals",
  },
  Robots: {
    facts: ["A robot follows steps called a program, one at a time.", "Some robots use sensors that work like eyes and ears.", "Mars rovers are robots that drive on another planet."],
    place: { href: "/arcade", cta: "Open the Arcade" },
    flavour: "robots, sensors and programs",
  },
  Drawing: {
    facts: ["Artists often sketch light circles and lines before the real drawing.", "Mixing blue and yellow paint makes green.", "Drawing something helps you remember it better than reading about it."],
    place: { href: "/vibe", cta: "Make something" },
    flavour: "drawing, sketching and colour",
  },
};

export interface Spark {
  interest: Interest;
  /** Kix's line: a fact from the kid's world, then an invitation back. */
  line: string;
  place: SparkPlace;
}

/** Which interest and fact to use: turns through the kid's interests and their facts by `turn` (deterministic). */
export function pickSpark(interests: readonly string[], turn: number): Spark | null {
  const list = cleanInterests(interests);
  if (!list.length) return null;
  const n = Math.abs(Math.trunc(turn));
  const interest = list[n % list.length];
  const s = SPARKS[interest];
  return { interest, line: s.facts[Math.floor(n / list.length) % s.facts.length], place: s.place };
}
