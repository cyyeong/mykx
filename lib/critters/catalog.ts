// The Critter Lab's living things (P3 Science: life cycles of animals and plants, diversity and classification).
// Each has a four-stage sheet in public/art/critters (Muse Image, see the manifest), a motion per stage, and short
// facts written for myKx in a child's words, matched to the MOE syllabus. Pip the frog is the kid's companion and
// grows with their learning (lib/domain/companion.ts); the others are to explore. Pure data.

export type Motion = "jiggle" | "swim" | "hop" | "breathe" | "crawl" | "twitch" | "scuttle" | "flutter" | "hover" | "sway" | "float";
export type Group = "amphibian" | "insect" | "bird" | "plant";

export interface Stage {
  label: string;
  note: string;
  motion: Motion;
}

export interface Critter {
  id: string;
  name: string;
  /** The art sheet base, four stages left to right. */
  art: string;
  group: Group;
  /** "4 stages: egg, larva, pupa, adult", etc. */
  cycle: string;
  /** The young look like the adult (true) or very different (false); null for plants. */
  youngLookLikeAdult: boolean | null;
  stages: [Stage, Stage, Stage, Stage];
  facts: string[];
  /** How far each tile zooms into its quarter of the sheet (default 1.12, so neighbours never peek in); tall,
   *  well-spaced sheets keep 1 so nothing is cropped. */
  zoom?: number;
}

export const GROUP_LABEL: Record<Group, string> = { amphibian: "Amphibian", insect: "Insect", bird: "Bird", plant: "Flowering plant" };

export const CRITTERS: readonly Critter[] = [
  {
    id: "frog",
    name: "Frog",
    art: "/art/critters/frog-life-cycle",
    group: "amphibian",
    cycle: "4 stages: egg, tadpole, froglet, adult frog",
    youngLookLikeAdult: false,
    stages: [
      { label: "Frogspawn", note: "Eggs in jelly, laid in water.", motion: "jiggle" },
      { label: "Tadpole", note: "Lives in water, swims with its tail, breathes with gills.", motion: "swim" },
      { label: "Froglet", note: "Grows legs; the tail gets shorter.", motion: "breathe" },
      { label: "Frog", note: "No tail, four legs, breathes with lungs, lives on land and in water.", motion: "hop" },
    ],
    facts: ["A frog is an amphibian: it starts life in water and can live on land as an adult.", "The young (tadpole) looks very different from the adult."],
  },
  {
    id: "mealworm",
    name: "Mealworm beetle",
    art: "/art/critters/mealworm-life-cycle",
    group: "insect",
    cycle: "4 stages: egg, larva, pupa, adult",
    youngLookLikeAdult: false,
    stages: [
      { label: "Eggs", note: "Tiny, white and oval.", motion: "jiggle" },
      { label: "Larva", note: "The mealworm: eats and grows, shedding its skin.", motion: "crawl" },
      { label: "Pupa", note: "Does not eat or move much while it changes.", motion: "twitch" },
      { label: "Adult beetle", note: "Six legs, hard wing covers.", motion: "scuttle" },
    ],
    facts: ["The mealworm is not a worm: it is the larva of a beetle.", "Four stages, and the young look nothing like the adult."],
  },
  {
    id: "butterfly",
    name: "Butterfly",
    art: "/art/critters/butterfly-life-cycle",
    group: "insect",
    cycle: "4 stages: egg, larva (caterpillar), pupa (chrysalis), adult",
    youngLookLikeAdult: false,
    stages: [
      { label: "Eggs", note: "Laid on the leaf the caterpillar will eat.", motion: "jiggle" },
      { label: "Caterpillar", note: "The larva: eats leaves and grows fast.", motion: "crawl" },
      { label: "Chrysalis", note: "The pupa: inside, the body changes completely.", motion: "sway" },
      { label: "Butterfly", note: "The adult: six legs, wings, drinks nectar.", motion: "flutter" },
    ],
    facts: ["The caterpillar and the butterfly eat different food: leaves, then nectar.", "Four stages, like the mealworm beetle."],
  },
  {
    id: "mosquito",
    name: "Mosquito",
    art: "/art/critters/mosquito-life-cycle",
    group: "insect",
    cycle: "4 stages: egg, larva, pupa, adult",
    youngLookLikeAdult: false,
    stages: [
      { label: "Eggs", note: "Laid on still water, often as a raft.", motion: "float" },
      { label: "Larva", note: "The wriggler: lives in water, breathes at the surface.", motion: "swim" },
      { label: "Pupa", note: "The tumbler: lives in water, does not eat.", motion: "twitch" },
      { label: "Adult", note: "Flies; only the female bites.", motion: "hover" },
    ],
    facts: ["Three of its four stages live in water, so tipping out still water stops mosquitoes breeding.", "Like the frog, its young live in water."],
  },
  {
    id: "cockroach",
    name: "Cockroach",
    art: "/art/critters/cockroach-life-cycle",
    group: "insect",
    cycle: "3 stages: egg, nymph, adult",
    youngLookLikeAdult: true,
    stages: [
      { label: "Egg case", note: "Holds many eggs inside.", motion: "jiggle" },
      { label: "Young nymph", note: "Looks like a small adult, but has no wings.", motion: "scuttle" },
      { label: "Older nymph", note: "Grows by shedding its skin (moulting).", motion: "scuttle" },
      { label: "Adult", note: "Has wings and can lay eggs.", motion: "twitch" },
    ],
    facts: ["Only 3 stages: there is no pupa.", "The nymph looks like the adult without wings."],
  },
  {
    id: "chicken",
    name: "Chicken",
    art: "/art/critters/chicken-life-cycle",
    zoom: 1.05,
    group: "bird",
    cycle: "3 stages: egg, chick, adult",
    youngLookLikeAdult: true,
    stages: [
      { label: "Egg", note: "The chick grows inside, kept warm by the hen.", motion: "jiggle" },
      { label: "Hatching", note: "The chick breaks out of the shell.", motion: "twitch" },
      { label: "Chick", note: "Fluffy and small, but shaped like a hen.", motion: "hop" },
      { label: "Hen", note: "Grown up: feathers, a beak and a comb.", motion: "breathe" },
    ],
    facts: ["A chicken is a bird: it has feathers and lays eggs with hard shells.", "The chick looks like a small adult."],
  },
  {
    id: "bean",
    name: "Bean plant",
    art: "/art/critters/bean-plant-life-cycle",
    zoom: 1,
    group: "plant",
    cycle: "seed → seedling → adult plant → flowers → fruits with seeds",
    youngLookLikeAdult: null,
    stages: [
      { label: "Seed", note: "Needs water, air and warmth to germinate.", motion: "jiggle" },
      { label: "Germinating", note: "The root grows first, then the shoot.", motion: "sway" },
      { label: "Seedling", note: "First leaves make food using light.", motion: "sway" },
      { label: "Adult plant", note: "Flowers become fruits (pods) with new seeds.", motion: "sway" },
    ],
    facts: ["A seed does not need light to germinate, but the seedling needs light to grow.", "Flowers turn into fruits, and fruits hold seeds."],
  },
];

/** The adults to sort in "Which are insects?" (stage 3 of each sheet). */
export const INSECT_QUIZ = CRITTERS.map((c) => ({ id: c.id, name: c.name, art: c.art, insect: c.group === "insect" }));

/** Shuffles 0..3 deterministically from a seed, never leaving it already in order. */
export function shuffledStages(seed: number): number[] {
  const order = [0, 1, 2, 3];
  let s = seed || 1;
  for (let i = order.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.join() === "0,1,2,3" ? [2, 0, 3, 1] : order;
}
