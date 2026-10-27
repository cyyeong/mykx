// The Sidekick Studio transform prompt: Kix canon + the child's world + two interests.
// Every accessory is a separate, nameable object that sits ON Kix (head, hand, back), never across
// the body, because SAM cuts accessories out separately and they are unioned back by noun
// (muse-image-assets skill, "Cutouts"). Pure, so it is unit-tested.
import type { PackId } from "@/components/theme/packs";

export const KIX_CANON =
  "Kix: an ORIGINAL small sidekick creature, a round, soft five-point star-shaped sprite with a glowing four-point " +
  "sparkle on its forehead, big friendly dark eyes with highlights, small rosy cheeks, gentle smile, stubby arms, " +
  "soft lavender body fading to mint at the bottom.";

type Accessory = { describe: string; noun: string };

/** One costume piece per world (the noun is what SAM is asked to find). */
const PACK_LOOK: Record<PackId, { style: string; accessory: Accessory }> = {
  dreamlight: {
    style: "dreamy twilight watercolour storybook illustration, soft lantern glow, gentle magical particles",
    accessory: { describe: "holding a tiny glowing paper lantern", noun: "lantern" },
  },
  "anime-sky": {
    style: "bright anime film style, crisp clean lines, luminous sky light, soft cel shading",
    accessory: { describe: "wearing a small sky-blue cap", noun: "cap" },
  },
  "toon-pop": {
    style: "chunky toy-box cartoon, bold outlines, saturated candy colours, playful squash and stretch",
    accessory: { describe: "wearing big chunky cartoon sneakers", noun: "sneakers" },
  },
  "idol-stage": {
    style: "glossy idol-stage look, neon rim light, holographic sparkle",
    accessory: { describe: "holding a sparkly star microphone", noun: "microphone" },
  },
  terrarium: {
    style: "lush miniature terrarium world, moss and ferns, warm amber sunlight through glass, soft picture-book 3D illustration",
    accessory: { describe: "wearing a little explorer hat", noun: "hat" },
  },
};

/** One prop per interest chip from the Studio picker. Unknown interests add nothing. */
const INTEREST_PROPS: Record<string, Accessory> = {
  "Bugs and critters": { describe: "holding a small magnifying glass", noun: "magnifying glass" },
  Jets: { describe: "with aviator goggles pushed up on its head", noun: "goggles" },
  Space: { describe: "wearing a tiny star-shaped badge", noun: "badge" },
  Animals: { describe: "hugging a small plush puppy", noun: "puppy" },
  Music: { describe: "wearing round headphones", noun: "headphones" },
  Dance: { describe: "twirling a short ribbon wand", noun: "ribbon" },
  Football: { describe: "with a small football at its feet", noun: "football" },
  Robots: { describe: "wearing a little robot antenna headband", noun: "headband" },
  Drawing: { describe: "holding a paintbrush", noun: "paintbrush" },
};

export type TransformPrompt = {
  prompt: string;
  /** SAM nouns: the body first, then each accessory to union back in. */
  bodyNoun: string;
  accessoryNouns: string[];
};

export function buildTransformPrompt(pack: PackId, interests: readonly string[]): TransformPrompt {
  const look = PACK_LOOK[pack];
  const props = interests.slice(0, 2).flatMap((i) => (INTEREST_PROPS[i] ? [INTEREST_PROPS[i]] : []));
  const accessories = [look.accessory, ...props];
  const prompt =
    "The same character as in the image, identical shape, proportions and face; " +
    `restyle it for this world: ${look.style}. ` +
    `It is ${accessories.map((a) => a.describe).join(", ")}. ` +
    "Full body, centred, standing, clearly separated from a soft plain background, exactly one character, " +
    "no other creatures or copies, nothing wrapped across its body. " +
    `${KIX_CANON} No text, no letters, no logos, no watermark.`;
  return { prompt, bodyNoun: "plush toy", accessoryNouns: accessories.map((a) => a.noun) };
}
