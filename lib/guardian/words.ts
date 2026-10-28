// What a child's own words to Kix may say about how they are (docs/prd/PARENT_INSIGHTS.md §1–2, AGENTS.md rule 12).
// Two deterministic passes run on every message the child types or says to Kix:
//   1. Safety: distress or safety words always get Kix's caring reply, the helplines and an urgent parent flag.
//      This list errs towards flagging; the post-session Muse Spark call (Standard mode) confirms or clears it.
//   2. Mood: a small word list gives a first, low-confidence reading; the Spark call refines it with context.
// Family messages never come here (rule 12). Words are never a diagnosis: the parent sees "possibly …" with the
// words behind it. Nothing here touches mastery or rewards (rule 5).

export const HELPLINES = [
  { name: "Tinkle Friend", number: "1800 274 4788", note: "for children" },
  { name: "SOS", number: "1767", note: "24 hours" },
] as const;

/** Phrases that mean a child may be unsafe or in distress (English and common Singlish spellings). */
const DISTRESS: readonly RegExp[] = [
  /\b(hurt|harm|cut|kill)(ing)? my ?self\b/,
  /\bself[- ]?harm\b/,
  /\b(want|wan|wanna|going) (to )?die\b/,
  /\b(end|ending) my life\b/,
  /\bsuicid/,
  /\b(don'?t|dont|dun|do not) want to (live|be alive|wake up)\b/,
  /\b(no ?one|nobody) (would|will)? ?(care|cares|miss me)\b/,
  /\bbetter off without me\b/,
  /\bgiving up on everything\b/,
  /\bhate my life\b/,
  /\b(someone|somebody|he|she|they) (hurt|hit|hits|touched|touches|beat|beats) me\b/,
  /\b(i'?m|i am) (being )?(bullied|abused)\b/,
  /\brun(ning)? away from home\b/,
];

/** Negative self-talk: a watch-level sign, never urgent on its own. */
const SELF_TALK: readonly RegExp[] = [
  /\b(i'?m|i am|im) (so )?(stupid|dumb|useless|hopeless|an idiot|a failure)\b/,
  /\bi (can'?t|cannot|cant) do anything\b/,
  /\bi('?m| am)? ?(always|never) (get|getting)? ?(it )?(wrong|right)\b/,
  /\bi hate myself\b/,
  /\bi('?m| am) bad at everything\b/,
];

export type Mood = "calm" | "happy" | "curious" | "unsure" | "frustrated" | "tired" | "worried";
export const MOODS = ["calm", "happy", "curious", "unsure", "frustrated", "tired", "worried"] as const satisfies readonly Mood[];

const MOOD_WORDS: Record<Exclude<Mood, "calm">, readonly RegExp[]> = {
  tired: [/\b(tired|sleepy|exhausted|yawn\w*|so late|can'?t keep my eyes)\b/],
  frustrated: [/\b(too hard|so hard|very hard|difficult|annoying|argh+|ugh+|hate this|give up|don'?t get it|dont get it|makes no sense|confus\w*)\b/],
  worried: [/\b(scared|worried|nervous|afraid|anxious|stress\w*|panic\w*)\b/],
  unsure: [/\b(not sure|idk|i dunno|dunno|maybe|i guess|i think so)\b/],
  happy: [/\b(yay+|fun|love (it|this)|awesome|cool|easy|i did it|got it|nice)\b/],
  curious: [/\b(why|how come|what if|how does|how do|i wonder)\b/],
};

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface WordCheck {
  /** Distress or safety words: Kix's caring reply, the helplines and an urgent flag, every time. */
  distress: boolean;
  /** Negative self-talk ("I'm stupid"): a watch-level sign for the parent. */
  selfTalk: boolean;
}

export function checkWords(text: string): WordCheck {
  const t = normalise(text);
  return { distress: DISTRESS.some((r) => r.test(t)), selfTalk: SELF_TALK.some((r) => r.test(t)) };
}

export interface MoodReading {
  mood: Mood;
  confidence: "low" | "medium";
  /** The child's own short phrases behind the reading (at most three, each at most 80 characters). */
  evidence: string[];
}

/** A first mood reading from a session's messages, or null when the child said nothing to Kix. */
export function moodFromWords(messages: readonly string[]): MoodReading | null {
  const said = messages.map((m) => m.trim()).filter(Boolean);
  if (!said.length) return null;
  const hits = new Map<Exclude<Mood, "calm">, string[]>();
  for (const m of said) {
    const t = normalise(m);
    for (const mood of Object.keys(MOOD_WORDS) as Exclude<Mood, "calm">[]) {
      if (MOOD_WORDS[mood].some((r) => r.test(t))) hits.set(mood, [...(hits.get(mood) ?? []), m.slice(0, 80)]);
    }
  }
  // Care first: a worried, tired or frustrated child matters more than one happy word.
  const order: Exclude<Mood, "calm">[] = ["worried", "tired", "frustrated", "unsure", "happy", "curious"];
  const best = order.filter((m) => hits.has(m)).sort((a, b) => (hits.get(b)!.length - hits.get(a)!.length) || order.indexOf(a) - order.indexOf(b))[0];
  if (!best) return { mood: "calm", confidence: "low", evidence: [] };
  const evidence = hits.get(best)!.slice(0, 3);
  return { mood: best, confidence: evidence.length >= 2 ? "medium" : "low", evidence };
}

/** Kix's reply when a child's words show distress: caring, points to a trusted adult, never counsels, never secret. */
export function caringReply(nickname: string): string {
  return `Thank you for telling me, ${nickname}. That sounds really hard, and you don't have to handle it alone. Please talk to a grown-up you trust, like Mum, Dad or a teacher. You can also call Tinkle Friend at 1800 274 4788. I've let your grown-up know you might need a hug.`;
}

/** Kix's first line back when it notices a mood in what the child just said (warm, short, never a label). */
export function kixMoodLine(mood: Mood, heard: string): string {
  switch (mood) {
    case "tired":
      return "Sounds like you're tired. How about a short break, some water, and back in two minutes?";
    case "frustrated":
      return "That sounds tricky. It's okay: let's take it one small step at a time.";
    case "worried":
      return "It's okay to feel worried. Do you want to tell me more, or talk to your grown-up about it?";
    case "unsure":
      return "Not sure is fine! Tell me what you think, and we'll check it together.";
    case "happy":
      return "Yay! I love that. You should be proud!";
    case "curious":
      return `Great question! Let's find out together: "${heard.slice(0, 80)}"`;
    default:
      return `I heard you say: ${heard}`;
  }
}
