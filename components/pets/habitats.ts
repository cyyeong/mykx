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

/** What a touchable part of the habitat does when tapped. */
export type SpotKind = "plant" | "twig" | "flower" | "water" | "deep" | "lily" | "rock" | "bran" | "carrot" | "straw" | "grain" | "lamp" | "sun";

/** A part of the habitat art a kid can touch (founder, 30 Oct): its box in percent of the habitat, how it reacts, and a
 *  one-line fact that ties it to the life cycle. Boxes are drawn over the Muse Image habitats in public/art/pets. */
export interface Spot {
  id: string;
  kind: SpotKind;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  fact: string;
}

export const SPOTS: Record<PetId, Spot[]> = {
  frog: [
    { id: "lily", kind: "lily", x: 10, y: 26, w: 22, h: 12, label: "the lily pads", fact: "Frogs lay frogspawn in still, shallow water like this. The jelly keeps the eggs safe." },
    { id: "water", kind: "deep", x: 20, y: 40, w: 22, h: 16, label: "the water", fact: "Tadpoles breathe with gills under the water, just like fish." },
    { id: "weed", kind: "plant", x: 8, y: 44, w: 12, h: 22, label: "the water plants", fact: "Tadpoles nibble the soft algae that grows on water plants." },
    { id: "weed2", kind: "plant", x: 44, y: 50, w: 12, h: 18, label: "the water weed", fact: "Water plants make oxygen, and tadpoles need it to breathe." },
    { id: "pebbles", kind: "rock", x: 8, y: 68, w: 22, h: 16, label: "the pebbles", fact: "Pebbles and rocks give tadpoles places to hide from danger." },
    { id: "stone", kind: "rock", x: 46, y: 68, w: 10, h: 12, label: "the big stone", fact: "A tadpole's tail gets shorter as its legs grow. It doesn't fall off; the body takes it back in." },
    { id: "stones", kind: "rock", x: 64, y: 20, w: 20, h: 16, label: "the stepping stones", fact: "A froglet climbs out onto rocks to breathe air with its new lungs." },
    { id: "moss", kind: "plant", x: 76, y: 2, w: 18, h: 18, label: "the moss", fact: "Frogs rest in damp moss to keep their skin wet. They breathe through their skin too." },
  ],
  mealworm: [
    { id: "bran", kind: "bran", x: 40, y: 62, w: 32, h: 20, label: "the bran", fact: "Mealworms live in bran. It's their bed and their food." },
    { id: "carrot", kind: "carrot", x: 14, y: 54, w: 10, h: 10, label: "the carrot", fact: "Carrot gives mealworms the water they need. They don't drink!" },
    { id: "carrot2", kind: "carrot", x: 65, y: 56, w: 9, h: 9, label: "the carrot slice", fact: "Too much wet food makes mould, so a small slice of carrot is just right." },
    { id: "carton", kind: "rock", x: 19, y: 40, w: 17, h: 12, label: "the egg carton", fact: "Darkling beetles like dark hiding places, like an egg carton." },
    { id: "carton2", kind: "rock", x: 81, y: 44, w: 13, h: 20, label: "the other carton", fact: "A mealworm sheds its skin many times as it grows. That's called moulting." },
    { id: "lamp", kind: "lamp", x: 66, y: 0, w: 14, h: 14, label: "the lamp", fact: "Mealworms like it warm, but not hot. Too much heat dries them out." },
    { id: "plant", kind: "plant", x: 5, y: 36, w: 10, h: 22, label: "the little plant", fact: "From egg to beetle takes a few months, if mealworms are warm and fed." },
  ],
  butterfly: [
    { id: "twig", kind: "twig", x: 14, y: 8, w: 76, h: 12, label: "the twig", fact: "A caterpillar hangs from a twig like this to make its chrysalis." },
    { id: "fern", kind: "plant", x: 12, y: 36, w: 20, h: 24, label: "the fern", fact: "Butterflies lay their eggs under leaves, out of the rain and sun." },
    { id: "leaves", kind: "plant", x: 66, y: 38, w: 24, h: 24, label: "the leaves", fact: "Caterpillars eat and eat leaves. They grow so fast they shed their skin." },
    { id: "flowers", kind: "flower", x: 0, y: 76, w: 22, h: 20, label: "the flowers", fact: "Butterflies drink nectar from flowers through a long tube called a proboscis." },
    { id: "flowers2", kind: "flower", x: 72, y: 78, w: 20, h: 18, label: "the orange flowers", fact: "Butterflies taste with their feet! They stand on a leaf to know it's the right one." },
    { id: "sun", kind: "sun", x: 36, y: 20, w: 24, h: 28, label: "the sunlight", fact: "Butterflies warm their wings in the sun before they can fly." },
  ],
  chicken: [
    { id: "lamp", kind: "lamp", x: 23, y: 1, w: 16, h: 14, label: "the lamp", fact: "A warm lamp keeps chicks cosy until their feathers grow in." },
    { id: "nest", kind: "straw", x: 19, y: 44, w: 22, h: 20, label: "the nest box", fact: "A hen lays her eggs in a quiet nest box full of straw." },
    { id: "window", kind: "sun", x: 53, y: 12, w: 22, h: 30, label: "the window", fact: "Daylight helps hens lay eggs. Longer days, more eggs." },
    { id: "bowl", kind: "water", x: 12, y: 70, w: 12, h: 12, label: "the water bowl", fact: "Chickens need fresh, clean water every day." },
    { id: "grain", kind: "grain", x: 75, y: 66, w: 14, h: 16, label: "the grain box", fact: "Hens eat grain and greens. Chicks eat soft crumbs." },
    { id: "straw", kind: "straw", x: 40, y: 72, w: 28, h: 16, label: "the straw", fact: "Chicks scratch and peck in straw. It's how they find food." },
    { id: "plants", kind: "plant", x: 88, y: 50, w: 12, h: 28, label: "the plants", fact: "A chick hatches after about 21 days in the egg." },
  ],
};
