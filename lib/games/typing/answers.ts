// Neon Strike's "Answer blast" (GAMES.md §3, stage 7): a short science question, typed answer, one word. Written
// for myKx from each level's MOE syllabus topics, easiest first; five rounds of five. Original wording, never
// copied from a paper (rule 10). Game rounds are practice: they never change mastery.
import type { SchoolLevel } from "./levels.ts";

export type Blast = { q: string; a: string };

const P3: readonly Blast[] = [
  { q: "It attracts things made of iron and steel.", a: "magnet" },
  { q: "An animal with six legs and three body parts.", a: "insect" },
  { q: "Mushrooms and moulds belong to this group.", a: "fungi" },
  { q: "A young frog that swims with its tail.", a: "tadpole" },
  { q: "It grows into a new plant when it gets water, air and warmth.", a: "seed" },
  { q: "An animal with feathers and a beak.", a: "bird" },
  { q: "A metal that a magnet attracts.", a: "iron" },
  { q: "An animal that lives in water and breathes with gills.", a: "fish" },
  { q: "A see-through material used for windows.", a: "glass" },
  { q: "The part of a plant that takes in water from the soil.", a: "root" },
  { q: "A north pole and a south pole placed near each other do this.", a: "attract" },
  { q: "Two north poles placed near each other do this.", a: "repel" },
  { q: "An animal with hair or fur that feeds its young on milk.", a: "mammal" },
  { q: "A stretchy, waterproof material used to make erasers.", a: "rubber" },
  { q: "The part of a plant that makes food.", a: "leaf" },
  { q: "The stage between larva and adult in a beetle's life cycle.", a: "pupa" },
  { q: "The stage after the egg in a mosquito's life cycle.", a: "larva" },
  { q: "Material from trees, used to make tables and pencils.", a: "wood" },
  { q: "A strong, light material for bottles. It does not rust or break easily.", a: "plastic" },
  { q: "An animal with dry, scaly skin, like a lizard.", a: "reptile" },
  { q: "Tiny living things too small to see. Some make food go bad.", a: "bacteria" },
  { q: "It uses a magnet to show which way is north.", a: "compass" },
  { q: "Rubbing a magnet along a steel nail in one direction to make a magnet.", a: "stroke" },
  { q: "The ends of a magnet, where its pull is strongest.", a: "poles" },
  { q: "A magnet made with electricity and a coil of wire.", a: "electromagnet" },
];

const P6: readonly Blast[] = [
  { q: "The force that pulls everything towards the Earth.", a: "gravity" },
  { q: "A material that lets electricity flow through it easily.", a: "conductor" },
  { q: "The force that slows a box sliding across a rough floor.", a: "friction" },
  { q: "The place where a living thing lives and gets what it needs.", a: "habitat" },
  { q: "A dark area formed when an object blocks light.", a: "shadow" },
  { q: "Water vapour cooling and turning into tiny water droplets.", a: "condensation" },
  { q: "Water slowly changing into water vapour at its surface.", a: "evaporation" },
  { q: "A material that does not let heat or electricity pass easily.", a: "insulator" },
  { q: "The gas that plants give out in the light and animals need to breathe.", a: "oxygen" },
  { q: "A closed path that lets electricity flow round to light a bulb.", a: "circuit" },
  { q: "The transfer of pollen grains to the stigma of a flower.", a: "pollination" },
  { q: "A seed starting to grow into a young plant.", a: "germination" },
  { q: "An organism that makes its own food, such as a green plant.", a: "producer" },
  { q: "An animal that hunts and eats other animals.", a: "predator" },
  { q: "An organism, like a fungus, that breaks down dead matter.", a: "decomposer" },
  { q: "Plants making food from light, water and carbon dioxide.", a: "photosynthesis" },
  { q: "The green substance in leaves that traps light.", a: "chlorophyll" },
  { q: "A feature that helps an organism survive in its surroundings.", a: "adaptation" },
  { q: "Energy that a moving object has.", a: "kinetic" },
  { q: "The energy stored in a stretched spring or a raised object.", a: "potential" },
  { q: "Light bouncing off a mirror.", a: "reflection" },
  { q: "The amount of space that something takes up.", a: "volume" },
  { q: "The amount of matter in an object.", a: "mass" },
  { q: "Living things releasing energy from food.", a: "respiration" },
  { q: "The female part of a flower that receives pollen.", a: "stigma" },
];

const SEC2: readonly Blast[] = [
  { q: "The flow of electric charge round a circuit.", a: "current" },
  { q: "The SI unit of electrical resistance.", a: "ohm" },
  { q: "The SI unit of force.", a: "newton" },
  { q: "A substance made of only one kind of atom.", a: "element" },
  { q: "Two or more elements chemically joined together.", a: "compound" },
  { q: "Two or more substances mixed but not chemically joined.", a: "mixture" },
  { q: "A solution with a pH below 7.", a: "acid" },
  { q: "A soluble base, with a pH above 7.", a: "alkali" },
  { q: "A substance that changes colour to show if something is acidic or alkaline.", a: "indicator" },
  { q: "How much a component opposes the flow of current.", a: "resistance" },
  { q: "Components joined one after another in a single loop.", a: "series" },
  { q: "Components on separate branches of a circuit.", a: "parallel" },
  { q: "All the organisms of one species living in one place.", a: "population" },
  { q: "A community of organisms and their physical surroundings.", a: "ecosystem" },
  { q: "The single force with the same effect as all the forces on an object.", a: "resultant" },
  { q: "A starting substance in a chemical reaction.", a: "reactant" },
  { q: "A new substance formed in a chemical reaction.", a: "product" },
  { q: "A substance that dissolves in a solvent.", a: "solute" },
  { q: "Separating a soluble solid from its solution by boiling off the solvent.", a: "evaporation" },
  { q: "Separating an insoluble solid from a liquid with filter paper.", a: "filtration" },
  { q: "Separating coloured dyes on paper.", a: "chromatography" },
  { q: "The potential difference across a component, measured in volts.", a: "voltage" },
  { q: "Breaking down a compound using electricity.", a: "electrolysis" },
  { q: "The variety of organisms in an area.", a: "biodiversity" },
  { q: "The tiny pores on a leaf where gases go in and out.", a: "stomata" },
];

/** Five questions for an "Answer blast" level (1–5), from the child's own level's bank. */
export function blastLevel(level: number, school: SchoolLevel): Blast[] {
  const bank = school === "Sec 2" ? SEC2 : school === "P6" ? P6 : P3;
  const l = Math.min(Math.max(level, 1), 5);
  return bank.slice((l - 1) * 5, l * 5);
}
