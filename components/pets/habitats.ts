// Where each pet lives in its habitat art (public/art/pets/hab-*.webp, measured on the art): the zones a stage can
// move in, in percent of the habitat's width and height, and how a sprite hangs from its point (feet on the ground,
// centred when swimming or flying, top for a chrysalis on its twig). Plus each sprite's facing and the dirt colour.
import type { PetId, Zone } from "@/lib/pets/species";

export type Anchor = "feet" | "center" | "top";
export interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  anchor: Anchor;
}

export const HABITAT_ART: Record<PetId, string> = { frog: "/art/pets/hab-pond", mealworm: "/art/pets/hab-tub", butterfly: "/art/pets/hab-garden", chicken: "/art/pets/hab-coop" };

export const ZONES: Record<PetId, Partial<Record<Zone, Rect>>> = {
  frog: {
    // Frogspawn floats just under the surface; tadpoles swim the open water; froglets and frogs sit on the bank.
    water: { x0: 8, x1: 58, y0: 42, y1: 80, anchor: "center" },
    bank: { x0: 56, x1: 88, y0: 31, y1: 38, anchor: "feet" },
  },
  mealworm: { floor: { x0: 24, x1: 78, y0: 64, y1: 84, anchor: "feet" } },
  butterfly: {
    leaf: { x0: 30, x1: 42, y0: 80, y1: 84, anchor: "feet" },
    floor: { x0: 26, x1: 70, y0: 74, y1: 88, anchor: "feet" },
    twig: { x0: 44, x1: 54, y0: 20, y1: 21, anchor: "top" },
    air: { x0: 16, x1: 84, y0: 26, y1: 62, anchor: "center" },
  },
  chicken: {
    nest: { x0: 15, x1: 19, y0: 52, y1: 53, anchor: "feet" },
    floor: { x0: 26, x1: 84, y0: 70, y1: 90, anchor: "feet" },
  },
};

/** Frogspawn floats at the top of the water rather than swimming through it. */
export const SPAWN_ZONE: Rect = { x0: 14, x1: 40, y0: 36, y1: 40, anchor: "center" };

/** -1: the sprite faces left (flip it to face right); 0: seen from above, never flipped. */
export const FACING: Record<string, 1 | -1 | 0> = { "frog-1": -1, "butterfly-3": 0 };

export const DIRT: Record<PetId, [string, string]> = {
  frog: ["rgba(88, 120, 52, .55)", "rgba(120, 150, 70, .4)"],
  mealworm: ["rgba(84, 56, 30, .6)", "rgba(120, 86, 48, .45)"],
  butterfly: ["rgba(110, 82, 44, .55)", "rgba(140, 120, 60, .4)"],
  chicken: ["rgba(96, 66, 36, .6)", "rgba(130, 100, 56, .45)"],
};

export const spriteOf = (species: PetId, stage: number) => `/art/pets/${species}-${stage}.webp`;
export const foodArt = (food: string) => `/art/pets/food-${food}.webp`;
