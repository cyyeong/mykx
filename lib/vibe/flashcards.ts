// Vibe Zone flashcards (PRD_REVIEW §4; design board VibeZone). The child asks in their own words ("I keep
// forgetting the frog life cycle"); Muse Spark (Standard) writes a flashcard spec, checked against this schema and
// drawn by trusted components (AGENTS.md rule 4: no model-authored code runs). "Change something" makes a new
// version; saving pays the deterministic creation_saved reward once (rule 5); sharing sends one version to the
// family's grown-ups and can be revoked.
import { z } from "zod";

/** Pictures the cards may use: the frog life cycle frames we have art for. Anything else is words only. */
export const PICTURES = ["frogspawn", "tadpole", "froglet", "frog"] as const;
export type Picture = (typeof PICTURES)[number];

export const cardSchema = z.strictObject({
  front: z.string().min(1).max(120),
  back: z.string().min(1).max(180),
  picture: z.enum(PICTURES).nullable(),
});

export const flashcardSpecSchema = z.strictObject({
  title: z.string().min(1).max(60),
  topic: z.string().max(60),
  cards: z.array(cardSchema).min(3).max(8),
  /** Kix's one line about the set ("Flip each card and say the answer before you look!"). */
  kixSays: z.string().max(160),
});
export type FlashcardSpec = z.infer<typeof flashcardSpecSchema>;
export type Card = z.infer<typeof cardSchema>;

export function makePrompt(o: { nickname: string; level: string | null; notes: string; revise: { spec: FlashcardSpec; change: string } | null }): string {
  return [
    `You make study flashcards for ${o.nickname}, a Singapore ${o.level ?? "primary"} student, in myKx's Vibe Zone.`,
    "Return 4 to 6 cards (8 at most if asked): a short question or prompt on the front, the answer on the back in a child's words. Facts must match the Singapore MOE syllabus and the pack notes below. Use picture only for frog life-cycle stages (frogspawn, tadpole, froglet, frog), otherwise null.",
    "Make them fun to remember: a tiny rhyme, pattern or picture-in-words on a back is welcome. No names of real people, brands or characters.",
    "If the request isn't about learning, or isn't safe for a child, make a gentle 3-card set about how to ask Kix for study help instead.",
    o.revise ? `Revise this set: ${o.revise.change}\nCurrent set: ${JSON.stringify(o.revise.spec)}` : "",
    "",
    "# Pack notes",
    o.notes,
  ].join("\n");
}

/** The cached set, so the demo never depends on a live call (rule 7); labelled as a sample in the UI. */
export const SAMPLE_SET: FlashcardSpec = {
  title: "Frog life cycle flashcards",
  topic: "Life cycles of animals",
  kixSays: "Say the answer out loud before you flip. Every Tadpole Finds Freedom!",
  cards: [
    { front: "What is the first stage of a frog's life cycle?", back: "Frogspawn: a jelly cluster of eggs laid in water.", picture: "frogspawn" },
    { front: "What hatches out of frogspawn?", back: "A tadpole. It lives in water and breathes with gills.", picture: "tadpole" },
    { front: "Which stage has legs AND a tail?", back: "The froglet: legs to hop, a tail that is shrinking.", picture: "froglet" },
    { front: "How is an adult frog different from a tadpole?", back: "It has no tail, has four legs, breathes with lungs and can live on land.", picture: "frog" },
  ],
};

/** A change request the UI offers as one tap. */
export const QUICK_CHANGES = ["Make them harder", "Add a mealworm card", "Make them shorter"] as const;
