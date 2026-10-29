// The Pets lab's critters (founder, 29 Oct): four pets a kid raises through their real life cycles (P3 Science, the
// same stages as the Critter Lab catalogue). Every stage needs different care: what it eats (and why the wrong food
// is wrong), which bars it has, the jobs that grow it, where it lives in its habitat and how it moves. Pure data.

export type PetId = "frog" | "mealworm" | "butterfly" | "chicken";
export const PET_IDS: readonly PetId[] = ["frog", "mealworm", "butterfly", "chicken"];

/** Food: a full tummy. Clean: a clean home. Love: time with the kid. Warm: warmth (eggs, pupae, sunbathing). */
export type Bar = "food" | "clean" | "love" | "warm";
export type Job = "feed" | "clean" | "play" | "warm" | "special";
export type FoodId = "algae" | "lettuce" | "flies" | "cricket" | "bran" | "carrot" | "apple" | "leaves" | "flower" | "crumbs" | "corn" | "greens";
/** How a stage gets about: drawn by components/pets/PetActor.tsx. */
export type Move = "wobble" | "swim" | "hop" | "crawl" | "rest" | "scuttle" | "hang" | "flutter" | "walk";
/** Where in the habitat a stage lives (rectangles per habitat in components/pets/habitats.ts). */
export type Zone = "water" | "bank" | "floor" | "leaf" | "twig" | "air" | "nest";

export interface Food {
  id: FoodId;
  name: string;
}

export const FOODS: Record<FoodId, Food> = {
  algae: { id: "algae", name: "Algae" },
  lettuce: { id: "lettuce", name: "Boiled lettuce" },
  flies: { id: "flies", name: "Fruit flies" },
  cricket: { id: "cricket", name: "Cricket" },
  bran: { id: "bran", name: "Bran and oats" },
  carrot: { id: "carrot", name: "Carrot slice" },
  apple: { id: "apple", name: "Apple slice" },
  leaves: { id: "leaves", name: "Fresh leaves" },
  flower: { id: "flower", name: "Nectar flower" },
  crumbs: { id: "crumbs", name: "Chick crumbs" },
  corn: { id: "corn", name: "Corn" },
  greens: { id: "greens", name: "Leafy greens" },
};

export interface Special {
  id: string;
  /** The button. */
  label: string;
  /** What the pet says when it's done. */
  done: string;
}

export interface StageDef {
  label: string;
  /** What this stage is and can do, in the pet's own words: the talk agent's facts and the cached replies. */
  self: string;
  bars: readonly [Bar, Bar, Bar];
  /** The right foods; empty when this stage doesn't eat. */
  eats: readonly FoodId[];
  /** Why a wrong food is wrong, in the pet's words (a stage that doesn't eat says `notEating`). */
  wrong: Partial<Record<FoodId, string>>;
  /** What grows it: each job this many times. At the adult stage the special is laying eggs, which starts again. */
  jobs: Partial<Record<Job, number>>;
  special?: Special;
  /** What changes to become the next stage (the adult: laying eggs), for the life-cycle track. */
  change: string;
  zone: Zone;
  move: Move;
  /** Width in percent of the habitat's width. */
  size: number;
}

export interface PetSpecies {
  id: PetId;
  /** The species, e.g. "Frog". */
  kind: string;
  /** The pet's own name. */
  name: string;
  habitat: string;
  /** The four foods on this habitat's tray, right and wrong. */
  tray: readonly [FoodId, FoodId, FoodId, FoodId];
  /** Said by a stage that doesn't eat when offered food. */
  notEating: readonly [string | null, string | null, string | null, string | null];
  stages: readonly [StageDef, StageDef, StageDef, StageDef];
}

export const PETS: Record<PetId, PetSpecies> = {
  frog: {
    id: "frog",
    kind: "Frog",
    name: "Bloop",
    habitat: "Pond tank",
    tray: ["algae", "lettuce", "flies", "cricket"],
    notEating: ["We're eggs! The yolk inside each egg feeds the tadpole growing in it.", null, null, null],
    stages: [
      {
        label: "Frogspawn",
        self: "a clump of frogspawn: tiny dark eggs in clear jelly, floating in the pond. A tadpole is growing in each egg, fed by the yolk. The jelly keeps the eggs safe and the sun keeps them warm.",
        bars: ["warm", "clean", "love"],
        eats: [],
        wrong: {},
        jobs: { warm: 2, clean: 1 },
        change: "Each egg hatches into a tiny tadpole that wriggles out of the jelly.",
        zone: "water",
        move: "wobble",
        size: 17,
      },
      {
        label: "Tadpole",
        self: "a tadpole: I live in water, swim by wiggling my long tail and breathe with gills. I have no legs yet. I nibble algae and soft plants.",
        bars: ["food", "clean", "love"],
        eats: ["algae", "lettuce"],
        wrong: { flies: "I can't catch flies: I don't even have legs yet! Algae, please.", cricket: "That cricket is bigger than me! Tadpoles eat algae and soft plants." },
        jobs: { feed: 3, clean: 1, play: 1 },
        change: "It grows back legs, then front legs; its tail shrinks and it grows lungs.",
        zone: "water",
        move: "swim",
        size: 15,
      },
      {
        label: "Froglet",
        self: "a froglet: I have four legs now and my tail is shrinking. I'm growing lungs, so I climb out of the water to breathe air, and I eat tiny insects now, not plants.",
        bars: ["food", "clean", "love"],
        eats: ["flies"],
        wrong: { algae: "I'm turning into a frog, so I eat tiny insects now, not plants.", lettuce: "No more plants for me: tiny insects, please!", cricket: "Too big for me just yet. Tiny fruit flies, please!" },
        jobs: { feed: 2, special: 1, play: 1 },
        special: { id: "rock", label: "Add a rock", done: "A rock! I can climb out of the water and breathe air with my new lungs." },
        change: "Its tail disappears completely, and it leaves the water to live on land too.",
        zone: "bank",
        move: "hop",
        size: 13,
      },
      {
        label: "Frog",
        self: "a grown-up frog: no tail, four strong legs for hopping, lungs for breathing air. I live on land and in water and catch insects with my sticky tongue.",
        bars: ["food", "clean", "love"],
        eats: ["cricket", "flies"],
        wrong: { algae: "Grown-up frogs eat insects, not algae.", lettuce: "I catch insects with my tongue. No lettuce for me!" },
        jobs: { feed: 3, clean: 1, play: 1, special: 1 },
        special: { id: "eggs", label: "Lay frogspawn", done: "I laid frogspawn in the water. The life cycle starts again!" },
        change: "It lays frogspawn in the water, and the cycle starts again.",
        zone: "bank",
        move: "hop",
        size: 17,
      },
    ],
  },
  mealworm: {
    id: "mealworm",
    kind: "Mealworm beetle",
    name: "Crumbs",
    habitat: "Bran tub",
    tray: ["bran", "carrot", "apple", "flower"],
    notEating: ["We're eggs, hidden in the bran. We don't eat yet!", null, "Pupae don't eat at all. I'm busy changing inside!", null],
    stages: [
      {
        label: "Eggs",
        self: "tiny white oval eggs hidden in the bran. Larvae are growing inside us. We like it warm and dark.",
        bars: ["warm", "clean", "love"],
        eats: [],
        wrong: {},
        jobs: { warm: 2, clean: 1 },
        change: "Each egg hatches into a tiny larva: the mealworm.",
        zone: "floor",
        move: "rest",
        size: 11,
      },
      {
        label: "Mealworm",
        self: "a mealworm: the larva of a beetle, not a worm! I have six tiny legs and chewing jaws. I eat bran, oats and vegetables, and I shed my skin (moult) as I grow.",
        bars: ["food", "clean", "love"],
        eats: ["bran", "carrot", "apple"],
        wrong: { flower: "I can't drink nectar. I chew bran with my jaws." },
        jobs: { feed: 2, special: 1, clean: 1 },
        special: { id: "moult", label: "Watch it moult", done: "I wriggled out of my old skin! Now I can grow bigger." },
        change: "After shedding its skin many times, it stops eating and becomes a pupa.",
        zone: "floor",
        move: "crawl",
        size: 18,
      },
      {
        label: "Pupa",
        self: "a pupa: I don't eat and hardly move. Inside me, my body is changing into a beetle. I need peace and quiet.",
        bars: ["warm", "clean", "love"],
        eats: [],
        wrong: {},
        jobs: { warm: 1, special: 1 },
        special: { id: "rest", label: "Let it rest", done: "Shh… thank you. Pupae need peace and quiet while they change." },
        change: "Inside the pupa its body changes completely into a beetle.",
        zone: "floor",
        move: "rest",
        size: 15,
      },
      {
        label: "Beetle",
        self: "a mealworm beetle, all grown up: six legs, hard wing covers on my back, two feelers. I eat bran, oats and bits of fruit and vegetables.",
        bars: ["food", "clean", "love"],
        eats: ["bran", "apple", "carrot"],
        wrong: { flower: "Beetles chew their food. We can't sip nectar like butterflies." },
        jobs: { feed: 2, clean: 1, play: 1, special: 1 },
        special: { id: "eggs", label: "Lay eggs", done: "I laid tiny eggs in the bran. The life cycle starts again!" },
        change: "It lays eggs in the bran, and the cycle starts again.",
        zone: "floor",
        move: "scuttle",
        size: 15,
      },
    ],
  },
  butterfly: {
    id: "butterfly",
    kind: "Butterfly",
    name: "Flutter",
    habitat: "Butterfly garden",
    tray: ["leaves", "flower", "cricket", "bran"],
    notEating: ["We're eggs on a leaf. The caterpillars will eat this very leaf when they hatch!", null, "A chrysalis doesn't eat. Inside, I'm turning into a butterfly!", null],
    stages: [
      {
        label: "Eggs",
        self: "tiny round eggs laid on a leaf. The leaf is the food the caterpillar will eat when it hatches.",
        bars: ["warm", "clean", "love"],
        eats: [],
        wrong: {},
        jobs: { warm: 1, special: 1 },
        special: { id: "leaf", label: "Keep the leaf fresh", done: "A fresh leaf! My caterpillar will eat it when it hatches." },
        change: "Each egg hatches into a tiny caterpillar that eats its eggshell, then the leaf.",
        zone: "leaf",
        move: "rest",
        size: 15,
      },
      {
        label: "Caterpillar",
        self: "a caterpillar: the larva of a butterfly. I munch leaves all day and grow fast, shedding my skin as I get bigger.",
        bars: ["food", "clean", "love"],
        eats: ["leaves"],
        wrong: { flower: "Caterpillars munch leaves. Nectar is for butterflies!", cricket: "I only eat leaves!", bran: "I eat fresh leaves from my plant, not bran." },
        jobs: { feed: 3, clean: 1, play: 1 },
        change: "When it's fully grown, it hangs from a twig and forms a chrysalis.",
        zone: "floor",
        move: "crawl",
        size: 19,
      },
      {
        label: "Chrysalis",
        self: "a chrysalis (the pupa), hanging from a twig. I don't eat or move much. Inside, my whole body is changing into a butterfly.",
        bars: ["warm", "clean", "love"],
        eats: [],
        wrong: {},
        jobs: { warm: 1, special: 1 },
        special: { id: "rest", label: "Let it hang in peace", done: "Thank you for letting me hang in peace. I'm changing inside!" },
        change: "Inside the chrysalis its body changes into a butterfly, which crawls out.",
        zone: "twig",
        move: "hang",
        size: 9,
      },
      {
        label: "Butterfly",
        self: "a butterfly, all grown up: six legs, four wings, and a long curly tongue for sipping nectar from flowers. I warm my wings in the sun before I fly.",
        bars: ["food", "warm", "love"],
        eats: ["flower"],
        wrong: { leaves: "I don't chew leaves any more. I sip nectar with my long tongue!", cricket: "Butterflies sip nectar. No insects for me!", bran: "I can't eat bran. Nectar, please!" },
        jobs: { feed: 2, warm: 1, play: 1, special: 1 },
        special: { id: "eggs", label: "Lay eggs on a leaf", done: "I laid my eggs on a leaf the caterpillars can eat. The life cycle starts again!" },
        change: "It lays eggs on a leaf the caterpillars can eat, and the cycle starts again.",
        zone: "air",
        move: "flutter",
        size: 19,
      },
    ],
  },
  chicken: {
    id: "chicken",
    kind: "Chicken",
    name: "Pebble",
    habitat: "Coop",
    tray: ["crumbs", "corn", "greens", "flower"],
    notEating: ["I'm an egg! The chick inside is fed by the yolk.", "I'm still hatching! The last of the yolk keeps me going.", null, null],
    stages: [
      {
        label: "Egg",
        self: "an egg. A chick is growing inside me, fed by the yolk. I need to be kept warm, and turned now and then.",
        bars: ["warm", "clean", "love"],
        eats: [],
        wrong: {},
        jobs: { warm: 2, special: 1 },
        special: { id: "turn", label: "Turn the egg", done: "Turning the egg helps the chick inside grow well." },
        change: "When the chick is ready, it starts pecking its way out of the shell.",
        zone: "nest",
        move: "wobble",
        size: 12,
      },
      {
        label: "Hatching",
        self: "a chick hatching: I'm pecking my way out of my shell with a tiny tooth on my beak. It's hard work, and I have to do it myself.",
        bars: ["warm", "clean", "love"],
        eats: [],
        wrong: {},
        jobs: { warm: 1, special: 1 },
        special: { id: "wait", label: "Let it hatch by itself", done: "I did it all by myself! Pecking out makes me strong." },
        change: "It breaks free, dries off and becomes a fluffy chick.",
        zone: "nest",
        move: "wobble",
        size: 15,
      },
      {
        label: "Chick",
        self: "a fluffy chick. I look like a small hen already. I peck at chick crumbs, drink water and stay near the warm lamp.",
        bars: ["food", "warm", "love"],
        eats: ["crumbs"],
        wrong: { corn: "Corn is too big for my little beak. Chick crumbs, please!", greens: "Maybe when I'm bigger. Crumbs, please!", flower: "Chickens don't sip nectar!" },
        jobs: { feed: 3, warm: 1, play: 1 },
        change: "It grows feathers, a comb and strong legs, and becomes a hen.",
        zone: "floor",
        move: "walk",
        size: 13,
      },
      {
        label: "Hen",
        self: "a hen, all grown up: feathers, a beak, a red comb and two strong legs for scratching. I peck at corn, grains and greens, and I lay eggs.",
        bars: ["food", "clean", "love"],
        eats: ["corn", "greens"],
        wrong: { crumbs: "Crumbs are for chicks. I'd love some corn or greens!", flower: "Chickens don't sip nectar!" },
        jobs: { feed: 2, clean: 1, play: 1, special: 1 },
        special: { id: "eggs", label: "Lay an egg", done: "I laid an egg in the nest. The life cycle starts again!" },
        change: "It lays an egg in the nest, and the cycle starts again.",
        zone: "floor",
        move: "walk",
        size: 19,
      },
    ],
  },
};

export const isPetId = (v: unknown): v is PetId => typeof v === "string" && (PET_IDS as readonly string[]).includes(v);
export const isFoodId = (v: unknown): v is FoodId => typeof v === "string" && v in FOODS;
