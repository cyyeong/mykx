// What a reward card shows for any item in the kid's packs (the question's reward panel, the done page, Treasure).
// No new art is generated for this: a science topic with a matching card in public/art/cards uses it (life cycles,
// living things and habitats, forces and magnets, light); everything else shows Kix in the kid's own world as a
// neutral pack card. The card's title is the topic's name and its chip the subject ("P6 Maths"). The frog quest's
// stops keep their own labels and art (lib/learn/frog-quest.ts). Pure.
import { FROG_QUEST, questCardArt } from "./frog-quest.ts";
import type { Subject } from "./subjects.ts";

export interface RewardCard {
  label: string;
  art: string;
  chip: string;
}

/** Existing topic art (public/art/cards, in the manifest), by topic id pattern. Science only. */
const TOPIC_ART: { test: RegExp; art: string }[] = [
  { test: /^cycles\.(animal|life|plant)$/, art: "/art/cards/gecko-and-frog" },
  { test: /^(diversity\.(living|classification)|interactions\.environment|biology\.environment)$/, art: "/art/cards/ant-colony" },
  { test: /^(interactions\.(forces|magnets|making_magnets)|physics\.forces_energy)$/, art: "/art/cards/forces" },
  { test: /^energy\.light$/, art: "/art/cards/light-and-shadows" },
];

/** The art for a topic: matching science art, else Kix in the kid's world (`/art/kix/<pack>`). */
export function topicArt(subject: Pick<Subject, "subject">, topicId: string, pack: string): string {
  if (subject.subject === "science") {
    const hit = TOPIC_ART.find((t) => t.test.test(topicId));
    if (hit) return hit.art;
  }
  return `/art/kix/${pack}`;
}

/** One card per item of the kid's subjects, keyed by item id (ledger refs for first tries and retries). */
export function rewardCards(subjects: readonly Subject[], pack: string): Record<string, RewardCard> {
  const out: Record<string, RewardCard> = {};
  for (const s of subjects) {
    const titles = new Map(s.topics.map((t) => [t.id, t.title]));
    for (const item of s.items) out[item.id] = { label: titles.get(item.topic) ?? s.name, art: topicArt(s, item.topic, pack), chip: s.label };
  }
  // The frog quest's stops keep their own names and art.
  for (const [id, card] of Object.entries(questCardArt())) out[id] = { ...card, chip: FROG_QUEST.chip };
  return out;
}

/**
 * The card for a ledger ref: an item id, or a fresh-transfer ref ("p6-maths/number.ratio/ratio_basics#family"),
 * which is titled by its topic. Null when the ref isn't from the kid's subjects.
 */
export function cardForRef(ref: string | undefined, cards: Record<string, RewardCard>, subjects: readonly Subject[], pack: string): RewardCard | null {
  if (!ref) return null;
  if (cards[ref]) return cards[ref];
  const m = /^([a-z0-9-]+)\/([^/#]+)\/[^#]+#/.exec(ref);
  const s = m ? subjects.find((x) => x.id === m[1]) : undefined;
  if (!m || !s) return null;
  return { label: s.topics.find((t) => t.id === m[2])?.title ?? s.name, art: topicArt(s, m[2], pack), chip: s.label };
}
