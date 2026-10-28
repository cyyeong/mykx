// Word Garden's "Match it" (GAMES.md §3, stage 8): a life-cycle picture from the Critter Lab sheets and a clue; the
// child types the word and a flower grows. Every level plays the same pictures; the words follow the child's grade:
// P3 names the stages (life cycles), P6 names the processes and groups (cycles, systems), Sec 2 uses lower
// secondary terms (diversity, cells, reproduction, ecology). Five levels of six, easiest first. Clues are written
// for myKx from each syllabus and the catalog's stage notes (lib/critters/catalog.ts). Practice only.
import type { SchoolLevel } from "./levels.ts";

export type GardenPrompt = { critter: string; stage: number; word: string; clue: string };

const P3: readonly (readonly GardenPrompt[])[] = [
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

const P6: readonly (readonly GardenPrompt[])[] = [
  [
    { critter: "frog", stage: 3, word: "amphibian", clue: "Young in water, adult on land and in water. Which animal group?" },
    { critter: "butterfly", stage: 2, word: "metamorphosis", clue: "Inside the chrysalis, the body changes completely. This change is called…" },
    { critter: "bean", stage: 1, word: "germination", clue: "The seed takes in water and its root starts to grow. This is…" },
    { critter: "cockroach", stage: 2, word: "moulting", clue: "The nymph sheds its old skin to grow bigger. This is called…" },
    { critter: "bean", stage: 2, word: "photosynthesis", clue: "The young leaves use light to make food. This process is…" },
    { critter: "chicken", stage: 0, word: "reproduction", clue: "Living things making young of their own kind, like a hen laying eggs." },
  ],
  [
    { critter: "mealworm", stage: 3, word: "insect", clue: "Six legs and three body parts. Which animal group?" },
    { critter: "chicken", stage: 3, word: "bird", clue: "Feathers, a beak, and eggs with hard shells. Which animal group?" },
    { critter: "frog", stage: 0, word: "fertilisation", clue: "A sperm joins an egg so it can grow into a tadpole. This is…" },
    { critter: "bean", stage: 3, word: "pollination", clue: "Pollen reaches the stigma before the flower can make seeds. This is…" },
    { critter: "mosquito", stage: 1, word: "oxygen", clue: "The wriggler hangs at the surface to take in this gas from the air." },
    { critter: "butterfly", stage: 3, word: "nectar", clue: "The adult butterfly drinks this sweet liquid from flowers." },
  ],
  [
    { critter: "mosquito", stage: 0, word: "breeding", clue: "Tipping out still water stops mosquitoes from doing this." },
    { critter: "frog", stage: 1, word: "gills", clue: "A tadpole breathes in water using these." },
    { critter: "frog", stage: 3, word: "lungs", clue: "An adult frog breathes air using these." },
    { critter: "cockroach", stage: 1, word: "nymph", clue: "The young of a cockroach: like the adult, but with no wings." },
    { critter: "butterfly", stage: 1, word: "larva", clue: "The caterpillar is this stage of the butterfly's life cycle." },
    { critter: "bean", stage: 0, word: "dispersal", clue: "Seeds being carried away from the parent plant. This is…" },
  ],
  [
    { critter: "chicken", stage: 1, word: "hatching", clue: "The young bird breaks out of its shell." },
    { critter: "mealworm", stage: 2, word: "pupa", clue: "The stage that does not eat while its body changes." },
    { critter: "bean", stage: 2, word: "chlorophyll", clue: "The green substance in leaves that traps light." },
    { critter: "chicken", stage: 2, word: "offspring", clue: "The young that parents produce, like this chick." },
    { critter: "butterfly", stage: 0, word: "complete", clue: "Egg, larva, pupa, adult: a life cycle with four stages is called…" },
    { critter: "cockroach", stage: 3, word: "incomplete", clue: "Egg, nymph, adult with no pupa: this life cycle is called…" },
  ],
  [
    { critter: "butterfly", stage: 2, word: "metamorphosis", clue: "The big change from larva to adult." },
    { critter: "bean", stage: 1, word: "germination", clue: "Needs water, air and warmth, but not light." },
    { critter: "frog", stage: 3, word: "amphibian", clue: "Moist skin, and it starts life in water." },
    { critter: "cockroach", stage: 2, word: "moulting", clue: "How an insect with a hard outer skin grows bigger." },
    { critter: "bean", stage: 2, word: "photosynthesis", clue: "Light, water and carbon dioxide make food in the leaves." },
    { critter: "bean", stage: 3, word: "pollination", clue: "Insects carry pollen from flower to flower." },
  ],
];

const SEC2: readonly (readonly GardenPrompt[])[] = [
  [
    { critter: "frog", stage: 3, word: "vertebrate", clue: "An animal with a backbone, like this frog." },
    { critter: "mealworm", stage: 3, word: "invertebrate", clue: "An animal with no backbone, like this beetle." },
    { critter: "cockroach", stage: 3, word: "exoskeleton", clue: "The hard outer covering that supports and protects an insect." },
    { critter: "chicken", stage: 0, word: "embryo", clue: "The young chick developing inside the egg." },
    { critter: "bean", stage: 0, word: "cotyledon", clue: "The seed leaf that stores food for the young plant." },
    { critter: "bean", stage: 2, word: "chlorophyll", clue: "The green pigment in chloroplasts that absorbs light." },
  ],
  [
    { critter: "butterfly", stage: 2, word: "metamorphosis", clue: "The complete change in body form during the pupa stage." },
    { critter: "frog", stage: 0, word: "fertilisation", clue: "Male and female gametes fuse, outside the body in frogs." },
    { critter: "bean", stage: 3, word: "pollination", clue: "The transfer of pollen from anther to stigma." },
    { critter: "mosquito", stage: 3, word: "vector", clue: "An organism that carries a disease from one host to another." },
    { critter: "frog", stage: 1, word: "gills", clue: "Organs for gas exchange in water." },
    { critter: "chicken", stage: 3, word: "omnivore", clue: "It eats both plants and animals, like seeds and insects." },
  ],
  [
    { critter: "cockroach", stage: 2, word: "moulting", clue: "Shedding the exoskeleton so the body can grow." },
    { critter: "bean", stage: 1, word: "germination", clue: "The seed's embryo starts to grow when conditions are right." },
    { critter: "bean", stage: 2, word: "photosynthesis", clue: "Light energy is used to make glucose from carbon dioxide and water." },
    { critter: "mosquito", stage: 1, word: "aquatic", clue: "Living in water, like the mosquito larva." },
    { critter: "frog", stage: 3, word: "amphibian", clue: "A vertebrate with moist skin that breeds in water." },
    { critter: "butterfly", stage: 1, word: "consumer", clue: "It gets its energy by eating plants: a primary…" },
  ],
  [
    { critter: "bean", stage: 3, word: "producer", clue: "It makes its own food, so it starts every food chain." },
    { critter: "butterfly", stage: 3, word: "pollinator", clue: "An animal that carries pollen between flowers as it feeds." },
    { critter: "chicken", stage: 1, word: "hatching", clue: "The young bird breaks out of the shell." },
    { critter: "cockroach", stage: 1, word: "nymph", clue: "The young stage of an insect without a pupa." },
    { critter: "mosquito", stage: 2, word: "pupa", clue: "The non-feeding stage between larva and adult." },
    { critter: "mealworm", stage: 1, word: "larva", clue: "The feeding stage that hatches from the egg." },
  ],
  [
    { critter: "frog", stage: 3, word: "vertebrate", clue: "It has a backbone." },
    { critter: "mealworm", stage: 3, word: "invertebrate", clue: "It has no backbone." },
    { critter: "cockroach", stage: 3, word: "exoskeleton", clue: "Its skeleton is on the outside." },
    { critter: "chicken", stage: 0, word: "embryo", clue: "What grows inside a fertilised egg." },
    { critter: "bean", stage: 0, word: "cotyledon", clue: "Food store inside the seed." },
    { critter: "butterfly", stage: 2, word: "metamorphosis", clue: "From caterpillar to butterfly." },
  ],
];

/** Six pictures for a level (1–5), with words for the child's own grade. */
export function gardenLevel(level: number, school: SchoolLevel = "P3"): GardenPrompt[] {
  const bank = school === "Sec 2" ? SEC2 : school === "P6" ? P6 : P3;
  return [...bank[Math.min(Math.max(level, 1), bank.length) - 1]];
}
