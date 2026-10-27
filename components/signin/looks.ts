import type { Band, PackId } from "@/components/theme/packs";
import type { PictureId } from "@/lib/auth/schemas";

/** default: grown-ups at the grand door. junior: storybook door and a picture code. teen: glass portal and a password. */
export type DoorVariant = "default" | "junior" | "teen";

const KIX = "/art/login/kix.webp";
const EXPLORER = "/art/login/kix-terrarium.webp";
const IDOL = "/art/login/kix-idol-stage.webp";
const ANIME = "/art/login/kix-anime-sky.webp";

type Look = {
  /** City backdrop, a path for <Art base>. */
  city: string;
  leafL: string;
  leafR: string;
  band: Band;
  /** The cut-out Kix sprites that fly over and walk across the plaza. */
  flyers: readonly [string, string, string];
  walkers: readonly [string, string, string];
};

export const LOOKS: Record<DoorVariant, Look> = {
  default: {
    city: "/art/login/city-twilight",
    leafL: "/art/login/door-grand-left.webp",
    leafR: "/art/login/door-grand-right.webp",
    band: "teen",
    flyers: [KIX, ANIME, IDOL],
    walkers: [KIX, EXPLORER, ANIME],
  },
  junior: {
    city: "/art/login/city-twilight",
    leafL: "/art/login/door-junior-left.webp",
    leafR: "/art/login/door-junior-right.webp",
    band: "junior",
    flyers: [EXPLORER, KIX, ANIME],
    walkers: [EXPLORER, KIX, IDOL],
  },
  teen: {
    city: "/art/login/city-neon",
    leafL: "/art/login/door-teen-left.webp",
    leafR: "/art/login/door-teen-right.webp",
    band: "teen",
    flyers: [IDOL, ANIME, KIX],
    walkers: [ANIME, IDOL, KIX],
  },
};

/** The cut-out Kix for a world: on the kid's door, in the sign-in card and on arrival. */
export function kixSprite(pack: PackId): string {
  if (pack === "terrarium") return EXPLORER;
  if (pack === "anime-sky") return ANIME;
  if (pack === "idol-stage") return IDOL;
  return KIX;
}

export type { PictureId };

/** The nine pad pictures, in pad order. Ids are what the server hashes (lib/auth/schemas.ts PICTURE_IDS). */
export const PAD_PICTURES: readonly { id: PictureId; art: string; label: string }[] = [
  { id: "idle", art: "/art/kix/expressions/idle", label: "Kix smiling" },
  { id: "thinking", art: "/art/kix/expressions/thinking", label: "Kix thinking" },
  { id: "hint", art: "/art/kix/expressions/hint", label: "Kix with a bright idea" },
  { id: "cheer", art: "/art/kix/expressions/cheer", label: "Kix cheering" },
  { id: "dreamlight", art: "/art/kix/dreamlight", label: "Starry Kix" },
  { id: "anime-sky", art: "/art/kix/anime-sky", label: "Sky Kix" },
  { id: "toon-pop", art: "/art/kix/toon-pop", label: "Toy Kix" },
  { id: "idol-stage", art: "/art/kix/idol-stage", label: "Stage Kix" },
  { id: "pilot", art: "/art/kix/pilot", label: "Kix the pilot" },
];
