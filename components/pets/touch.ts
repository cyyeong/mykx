// What a pet says when a kid touches it (founder, 30 Oct): a tap gets a different line each time, in the way its
// stage moves; too many quick taps get "gently"; a pet carried out of the part of the habitat its stage lives in says
// why it belongs there. Lines are original and true for the stage.
import { useMemo, useSyncExternalStore } from "react";
import type { PropSound } from "@/lib/sound/palette";
import type { Move, PetId, Zone } from "@/lib/pets/species";
import type { SpotKind } from "./habitats";

export const POKE_LINES: Record<Move, string[]> = {
  wobble: ["Wobble wobble!", "Hee hee! Something tiny is growing in here.", "Gently does it!"],
  swim: ["Whee! My tail pushes me through the water.", "You found me! I was nibbling algae.", "That tickles! I breathe with gills, like a fish."],
  hop: ["Boing! My long back legs are made for jumping.", "Ribbit! Did you see how far I can hop?", "Hello! I keep my skin nice and damp."],
  crawl: ["Hee hee, that tickles!", "Munch munch… oh, hello!", "I'm busy eating so I can grow bigger."],
  rest: ["Shh… something amazing is happening in here.", "I can't move yet, but I know you're there!", "Gently! I'm growing very quietly."],
  scuttle: ["Zoom! Beetles are speedy.", "My hard wing cases keep me safe.", "Six legs, like every insect. Count them!"],
  hang: ["Sway… sway… I'm changing inside.", "Careful! I hang on by a tiny pad of silk.", "Shh! Wings are growing in here."],
  flutter: ["Flutter! Catch me if you can.", "My wings are covered in tiny scales.", "Hello! I have six legs and two feelers."],
  walk: ["Hello there! Did you come to visit?", "Peck peck. Any crumbs for me?", "I scratch the ground to find food."],
};

/** Stages whose tap lines are their own (frogspawn is jelly; an egg has a shell). */
const STAGE_POKE_LINES: Partial<Record<string, string[]>> = {
  "frog-0": ["Wobble wobble! The jelly keeps the eggs safe.", "Hee hee! Tiny tadpoles are growing in here.", "Gently does it. I'm squishy!"],
  "chicken-0": ["Wobble wobble! A chick is growing in here.", "Tap tap… is someone in there?", "Gently! Eggshells can crack."],
  "chicken-1": ["Peck, peck! I'm nearly out!", "I have to break the shell by myself.", "Cheep! Can you hear me in here?"],
};
export const pokeLines = (species: PetId, stage: number, move: Move) => STAGE_POKE_LINES[`${species}-${stage}`] ?? POKE_LINES[move];

export const GENTLY = "Gently, please! I'm only small.";
/** The hint's "touch … too", naming a few touchable parts of each habitat. */
export const TOUCH_HINT: Record<PetId, string> = { frog: "the water, plants and rocks", mealworm: "the bran, carrots and cartons", butterfly: "the plants, flowers and twig", chicken: "the nest, straw and lamp" };
export const DROP_LINES = ["Wheee! Thanks for the lift.", "A new spot. I like it here.", "That was fun. Down I go!"];

/** Said when a kid carries the pet out of its part of the habitat. */
const ZONE_LINES: Record<Zone, string> = {
  water: "I have to stay in the water. I breathe with gills!",
  bank: "I like the bank, close to the water, so my skin stays damp.",
  floor: "I stay down here on the floor, near my food.",
  leaf: "Butterfly eggs stay on the leaf the caterpillars will eat.",
  twig: "A chrysalis hangs from its twig until the butterfly comes out.",
  air: "I fly here, between the plants and the flowers.",
  nest: "Eggs stay warm in the nest until they hatch.",
};
const STAGE_ZONE_LINES: Partial<Record<string, string>> = {
  "frog-0": "Frogspawn has to stay in the water, or the eggs dry out.",
  "mealworm-0": "Beetle eggs stay hidden in the bran.",
  "mealworm-1": "I live in the bran. It's my bed and my food!",
  "mealworm-2": "A pupa stays still in the bran while it changes.",
  "mealworm-3": "I like the dark bran best.",
};
export const zoneLine = (species: PetId, stage: number, zone: Zone) => STAGE_ZONE_LINES[`${species}-${stage}`] ?? ZONE_LINES[zone];

/** The sound a pet makes when tapped, by how its stage moves. */
export const POKE_SOUND: Record<Move, PropSound> = { wobble: "pop", swim: "splash", hop: "croak", crawl: "pop", rest: "tink", scuttle: "click", hang: "creak", flutter: "flutter", walk: "pop" };

/** The sound a part of the habitat makes when tapped. */
export const SPOT_SOUND: Record<SpotKind, PropSound> = { plant: "rustle", twig: "creak", flower: "chime", water: "splash", deep: "pop", lily: "splash", rock: "knock", bran: "rustle", carrot: "pop", straw: "rustle", grain: "rustle", lamp: "tink", sun: "chime" };

/** What this device's kid has already touched, so the "touch me" ring, the sparkles and the hint fade once found.
 *  A convenience only (localStorage); nothing about it reaches the server. */
export interface Touched {
  pet: boolean;
  spots: Partial<Record<PetId, string[]>>;
  /** Not known yet (server render): show no hints rather than flash them. */
  unknown?: boolean;
}

const KEY = "mykx.critterTouch";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
const parse = (raw: string): Touched => {
  try {
    const t = JSON.parse(raw || "{}") as Partial<Touched>;
    return { pet: Boolean(t.pet), spots: t.spots && typeof t.spots === "object" ? t.spots : {} };
  } catch {
    return { pet: false, spots: {} };
  }
};

export function markTouched(change: (t: Touched) => Touched) {
  try {
    localStorage.setItem(KEY, JSON.stringify(change(parse(read()))));
  } catch {
    // Storage blocked: the hints just stay.
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function useTouched(): Touched {
  const raw = useSyncExternalStore(subscribe, read, () => "\u0000");
  return useMemo(() => (raw === "\u0000" ? { pet: true, spots: {}, unknown: true } : parse(raw)), [raw]);
}
