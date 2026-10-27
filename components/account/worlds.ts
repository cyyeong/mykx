// World identity colours (design system §2), from the FamilyAccounts and AdminPeople boards.
// Used only behind door art, avatars and swatches. Never behind text.
import type { PackId } from "@/components/theme/packs";

export const WORLD_SCENE: Record<PackId, string> = {
  dreamlight:
    "radial-gradient(60% 50% at 72% 18%, rgba(255, 227, 138, 0.55), rgba(255, 227, 138, 0) 70%), linear-gradient(180deg, #2B2A5C 0%, #5B4FA8 62%, #B9A7F5 100%)",
  "anime-sky":
    "radial-gradient(55% 50% at 80% 14%, rgba(255, 211, 110, 0.75), rgba(255, 211, 110, 0) 70%), linear-gradient(180deg, #3D8EE0 0%, #8EC4F5 58%, #F7B6CF 100%)",
  "toon-pop":
    "radial-gradient(55% 50% at 18% 16%, rgba(255, 210, 63, 0.7), rgba(255, 210, 63, 0) 70%), linear-gradient(160deg, #7C5CFF 0%, #B36BE6 55%, #FF7EB6 100%)",
  "idol-stage":
    "radial-gradient(60% 60% at 15% 0%, rgba(255, 61, 203, 0.6), rgba(255, 61, 203, 0) 70%), radial-gradient(60% 60% at 88% 8%, rgba(61, 245, 255, 0.5), rgba(61, 245, 255, 0) 70%), linear-gradient(180deg, #120C2B 0%, #2B1858 100%)",
  terrarium:
    "radial-gradient(70% 55% at 50% 100%, rgba(255, 211, 77, 0.55), rgba(255, 211, 77, 0) 70%), linear-gradient(180deg, #1C6C84 0%, #2C7A47 62%, #1D3324 100%)",
};

export const WORLD_SWATCH: Record<PackId, string> = {
  dreamlight: "linear-gradient(135deg, #2B2A5C, #B9A7F5 60%, #A8F0D4)",
  "anime-sky": "linear-gradient(135deg, #1B2350, #5AA9F0 50%, #F7B6CF)",
  "toon-pop": "linear-gradient(135deg, #7C5CFF, #FF7EB6 60%, #FFD23F)",
  "idol-stage": "linear-gradient(135deg, #120C2B, #FF3DCB 55%, #3DF5FF)",
  terrarium: "linear-gradient(135deg, #1C6C84, #2C7A47 50%, #FFD34D)",
};

/** The door's warm light, behind the Kix sprite on a kid card. */
export const DOOR_GLOW =
  "radial-gradient(90% 80% at 50% 100%, rgba(255, 248, 222, 0.98) 0%, rgba(255, 236, 190, 0.72) 45%, rgba(255, 255, 255, 0.16) 100%)";
