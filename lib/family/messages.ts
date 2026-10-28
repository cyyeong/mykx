// Family messages (PARENT_INSIGHTS §3): grown-up ↔ kid inside the household. Words, Kix stickers (our own art,
// animated with CSS: no outside GIF service, so no tracking and no unsafe content), quick encouragements and quick
// replies. Kix and every language model never read these (rule 12). Pure data and checks.
import { z } from "zod";

export const STICKERS = ["cheer", "proud", "hug", "got-this", "rest", "think", "party", "love"] as const;
export type Sticker = (typeof STICKERS)[number];

/** Each sticker: which Kix art, the CSS animation, the little effect on top, and its words. */
export const STICKER_INFO: Record<Sticker, { label: string; art: string; motion: "bounce" | "wiggle" | "pulse" | "float"; fx: "stars" | "hearts" | "zzz" | "sparkle" | "confetti" | "dots" | null }> = {
  cheer: { label: "Yay!", art: "/art/kix/expressions/cheer", motion: "bounce", fx: "confetti" },
  proud: { label: "Proud of you", art: "/art/kix/expressions/idle", motion: "pulse", fx: "stars" },
  hug: { label: "Big hug", art: "/art/kix/dreamlight", motion: "wiggle", fx: "hearts" },
  "got-this": { label: "You've got this", art: "/art/kix/expressions/hint", motion: "bounce", fx: "sparkle" },
  rest: { label: "Rest time", art: "/art/kix/expressions/thinking", motion: "float", fx: "zzz" },
  think: { label: "Hmm…", art: "/art/kix/expressions/thinking", motion: "wiggle", fx: "dots" },
  party: { label: "Party!", art: "/art/kix/toon-pop", motion: "bounce", fx: "confetti" },
  love: { label: "Love you", art: "/art/kix/terrarium", motion: "pulse", fx: "hearts" },
};

export const ENCOURAGEMENTS = ["Proud of you!", "You've got this.", "Time for a break?", "Great effort today.", "See you at dinner!"] as const;
export const QUICK_REPLIES = ["Thank you!", "Love you", "I did it!", "Can we talk later?", "OK!"] as const;

export const messageBody = z
  .strictObject({
    body: z.string().trim().min(1).max(300).optional(),
    sticker: z.enum(STICKERS).optional(),
    byVoice: z.boolean().optional(),
  })
  .refine((m) => m.body !== undefined || m.sticker !== undefined, "A message needs words or a sticker");

export interface FamilyMessage {
  id: string;
  from: string;
  to: string;
  body: string | null;
  sticker: Sticker | null;
  byVoice: boolean;
  at: string;
  readAt: string | null;
}
