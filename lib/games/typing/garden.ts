// Word Garden's "Match it" (GAMES.md §3, stage 8): a life-cycle picture from the Critter Lab sheets and a clue;
// the child types the stage's name and a flower grows. P3 Science life cycles, five levels of six, easiest first.
// Clues are written for myKx from the catalog's stage notes (lib/critters/catalog.ts). Practice only.

export type GardenPrompt = { critter: string; stage: number; word: string; clue: string };

const LEVELS: readonly (readonly GardenPrompt[])[] = [
  [
    { critter: "frog", stage: 1, word: "tadpole", clue: "It hatches from frogspawn and swims with its tail." },
    { critter: "mealworm", stage: 1, word: "larva", clue: "The mealworm stage that eats and grows." },
    { critter: "frog", stage: 3, word: "frog", clue: "The adult. It lays eggs to start again." },
    { critter: "mealworm", stage: 2, word: "pupa", clue: "It rests and changes inside. It does not eat." },
    { critter: "frog", stage: 2, word: "froglet", clue: "Legs, lungs and a shrinking tail." },
    { critter: "mealworm", stage: 3, word: "beetle", clue: "The adult mealworm, with hard wing cases." },
  ],
  [
    { critter: "butterfly", stage: 1, word: "caterpillar", clue: "The butterfly's larva. It eats leaves and grows fast." },
    { critter: "chicken", stage: 2, word: "chick", clue: "Fluffy and small, but shaped like a hen." },
    { critter: "butterfly", stage: 3, word: "butterfly", clue: "The adult, with wings. It drinks nectar." },
    { critter: "chicken", stage: 0, word: "egg", clue: "The hen keeps it warm while the chick grows inside." },
    { critter: "butterfly", stage: 2, word: "chrysalis", clue: "The butterfly's pupa. Its body changes inside." },
    { critter: "chicken", stage: 3, word: "hen", clue: "The grown-up chicken, with feathers and a comb." },
  ],
  [
    { critter: "bean", stage: 0, word: "seed", clue: "It needs water, air and warmth to start growing." },
    { critter: "cockroach", stage: 1, word: "nymph", clue: "A young cockroach. It looks like the adult, but has no wings." },
    { critter: "bean", stage: 2, word: "seedling", clue: "A young plant. Its first leaves make food using light." },
    { critter: "cockroach", stage: 3, word: "cockroach", clue: "The adult, with wings. It can lay eggs." },
    { critter: "bean", stage: 3, word: "plant", clue: "The grown-up bean. Its flowers become pods with seeds." },
    { critter: "frog", stage: 0, word: "frogspawn", clue: "Frog eggs in jelly, laid in the water." },
  ],
  [
    { critter: "mosquito", stage: 0, word: "eggs", clue: "Laid on still water, often as a raft." },
    { critter: "mosquito", stage: 1, word: "wriggler", clue: "The mosquito larva. It breathes at the water's surface." },
    { critter: "mosquito", stage: 2, word: "tumbler", clue: "The mosquito pupa. It lives in water and does not eat." },
    { critter: "mosquito", stage: 3, word: "mosquito", clue: "The adult flies. Only the female bites." },
    { critter: "chicken", stage: 1, word: "hatching", clue: "The chick is breaking out of its shell." },
    { critter: "bean", stage: 1, word: "root", clue: "When a seed germinates, this grows out first." },
  ],
  [
    { critter: "frog", stage: 2, word: "froglet", clue: "Not a tadpole any more, not yet a frog." },
    { critter: "butterfly", stage: 2, word: "chrysalis", clue: "Hanging still while it changes completely." },
    { critter: "bean", stage: 2, word: "seedling", clue: "It needs light now to keep growing." },
    { critter: "cockroach", stage: 2, word: "nymph", clue: "It grows by shedding its skin. No pupa for this insect." },
    { critter: "mealworm", stage: 3, word: "beetle", clue: "Six legs and hard wing cases: the mealworm grown up." },
    { critter: "butterfly", stage: 1, word: "caterpillar", clue: "Leaves now, nectar later." },
  ],
];

export function gardenLevel(level: number): GardenPrompt[] {
  return [...LEVELS[Math.min(Math.max(level, 1), LEVELS.length) - 1]];
}
