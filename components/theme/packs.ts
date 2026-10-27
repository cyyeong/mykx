export const PACK_IDS = ["dreamlight", "anime-sky", "toon-pop", "idol-stage", "terrarium"] as const;
export type PackId = (typeof PACK_IDS)[number];
export type Band = "junior" | "teen";

export type Pack = {
  id: PackId;
  name: string;
  mood: string;
  /** Cached Kix for this pack: the transform fallback and the picker preview. */
  kix: string;
  /** Dark packs use the light wordmark. */
  dark: boolean;
};

export const PACKS: readonly Pack[] = [
  { id: "dreamlight", name: "Dreamlight", mood: "Twilight magic and drifting lanterns", kix: "/art/kix/dreamlight", dark: true },
  { id: "anime-sky", name: "Anime Sky", mood: "Big skies, light rays and petals", kix: "/art/kix/anime-sky", dark: false },
  { id: "toon-pop", name: "Toon Pop", mood: "Chunky, bouncy and toy-box bright", kix: "/art/kix/toon-pop", dark: false },
  { id: "idol-stage", name: "Idol Stage", mood: "Neon stage lights and holo sparkle", kix: "/art/kix/idol-stage", dark: true },
  { id: "terrarium", name: "Terrarium", mood: "Moss, ponds, tadpoles and tiny explorers", kix: "/art/kix/terrarium", dark: false },
];

export function getPack(id: PackId): Pack {
  return PACKS.find((p) => p.id === id) ?? PACKS[0];
}

export function wordmarkFor(pack: Pack): string {
  return pack.dark ? "/brand/wordmark-on-dark.svg" : "/brand/wordmark-on-light.svg";
}
