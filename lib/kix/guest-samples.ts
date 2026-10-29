// Ask Kix on the guest site (lib/guest.ts): ready-made questions for each level, with the lessons Kix would draw for
// them, in the live schema (lib/kix/homework.ts) so the same trusted components render them. Original questions, each
// worked by hand; labelled as samples in the UI. Pure, so the client can list the questions.
import type { Block, Explanation, Stage } from "./homework.ts";

type Lesson = Omit<Explanation, "stage" | "blocks" | "finalAnswer" | "unclear" | "figure"> & {
  hint: Block[];
  steps: Block[];
  full: Block[];
  answer: string;
};

const EMPTY: Block = { kind: "say", title: null, text: null, steps: null, bars: null, claim: null, evidence: null, reasoning: null, hook: null, question: null, answer: null };
const b = (kind: Block["kind"], fields: Partial<Block>): Block => ({ ...EMPTY, kind, ...fields });

const LESSONS: Record<"P3" | "P6" | "Sec 2", Lesson[]> = {
  P3: [
    {
      question: "Ali has 24 more stickers than Ben. Together they have 100 stickers. How many stickers does Ben have?",
      subject: "maths",
      topic: "Whole numbers: model drawing",
      method: "Model drawing: comparison",
      hint: [b("say", { text: "Draw Ben's bar first. Ali's bar is the same length plus a piece for the extra 24." })],
      steps: [
        b("bar-model", { title: "Draw the bars", bars: [{ label: "Ben", parts: [{ label: "1 unit", value: "?" }] }, { label: "Ali", parts: [{ label: "1 unit", value: "?" }, { label: "extra", value: "24" }] }] }),
        b("steps", { title: "Take away the extra", steps: ["Both bars together make 100.", "Take away Ali's extra 24: 100 − 24 = 76.", "Now the two equal units make 76."] }),
      ],
      full: [b("steps", { title: "Finish it", steps: ["2 units = 76", "1 unit = 76 ÷ 2 = 38", "Ben has 38 stickers. Check: Ali has 38 + 24 = 62, and 38 + 62 = 100."] }), b("try-this", { title: "Try this one", question: "Sara has 15 more beads than Mei. They have 75 beads altogether. How many beads does Mei have?", answer: "30 beads" })],
      answer: "Ben has 38 stickers.",
    },
    {
      question: "Why can a tadpole live only in water?",
      subject: "science",
      topic: "Life cycles of animals",
      method: "Claim, evidence, reasoning",
      hint: [b("say", { text: "Think about how a tadpole breathes. Does it have lungs yet?" })],
      steps: [b("cer", { title: "Build your answer", claim: "A tadpole breathes with gills.", evidence: "Gills take in oxygen from the water. A tadpole has no lungs and no legs yet.", reasoning: "So it can only get oxygen, and move about, in water." })],
      full: [b("memory-hook", { title: "Remember it", text: "Gills for the pond, lungs for the land.", hook: "rhyme" }), b("try-this", { title: "Try this one", question: "Which stage of the frog can live both in water and on land?", answer: "The adult frog (it has lungs and legs)." })],
      answer: "It breathes with gills, which take in oxygen from water, and it has no lungs or legs yet.",
    },
  ],
  P6: [
    {
      question: "The ratio of Amy's money to Ben's money is 3 : 5. After Ben gives Amy $12, they have the same amount. How much money did Amy have at first?",
      subject: "maths",
      topic: "Ratio: before and after",
      method: "Model drawing: total unchanged",
      hint: [b("say", { text: "Money only moves from Ben to Amy, so the total stays the same. Start there." })],
      steps: [
        b("bar-model", { title: "Before", bars: [{ label: "Amy", parts: [{ label: "3 units", value: "?" }] }, { label: "Ben", parts: [{ label: "5 units", value: "?" }] }] }),
        b("steps", { title: "Use the unchanged total", steps: ["The total is 3 + 5 = 8 units, before and after.", "After, they're equal: 4 units each.", "Ben went from 5 units to 4, so he gave 1 unit."] }),
      ],
      full: [b("steps", { title: "Finish it", steps: ["1 unit = $12", "Amy at first = 3 units = 3 × $12 = $36", "Check: Amy $36, Ben $60. After $12 moves, both have $48."] }), b("try-this", { title: "Try this one", question: "The ratio of Ken's marbles to Raj's is 2 : 4. After Raj gives Ken 10 marbles, they have the same number. How many marbles did Ken have at first?", answer: "20 marbles" })],
      answer: "Amy had $36 at first.",
    },
    {
      question: "A plant was kept in a dark cupboard for two weeks. Why did it turn pale and weak?",
      subject: "science",
      topic: "Energy: photosynthesis",
      method: "Claim, evidence, reasoning",
      hint: [b("say", { text: "What does a plant need light for?" })],
      steps: [b("cer", { title: "Build your answer", claim: "The plant could not make its own food.", evidence: "Without light, the plant cannot photosynthesise, and its leaves lose their green colour.", reasoning: "Plants use light energy to make food. With no food made, the plant has too little energy to stay healthy, so it grows weak." })],
      full: [b("memory-hook", { title: "Remember it", text: "Light in, food made: no light, no lunch.", hook: "chant" }), b("try-this", { title: "Try this one", question: "Name two other things a plant needs to photosynthesise.", answer: "Water and carbon dioxide (and chlorophyll in its leaves)." })],
      answer: "With no light it could not photosynthesise, so it made no food and grew pale and weak.",
    },
  ],
  "Sec 2": [
    {
      question: "A 6 V battery is connected to a 3 Ω resistor. What current flows? What happens to the current if a second 3 Ω resistor is added in series?",
      subject: "science",
      topic: "Electrical systems: current and resistance",
      method: "Use V = IR, then total resistance in series",
      hint: [b("say", { text: "Write down V = IR, and what you know: V and R. Which one is missing?" })],
      steps: [b("steps", { title: "One resistor", steps: ["V = IR, so I = V ÷ R.", "I = 6 V ÷ 3 Ω = 2 A."] }), b("steps", { title: "Two in series", steps: ["In series, resistances add: 3 Ω + 3 Ω = 6 Ω.", "The battery's voltage stays 6 V."] })],
      full: [b("steps", { title: "Finish it", steps: ["I = 6 V ÷ 6 Ω = 1 A.", "Doubling the resistance halved the current: 2 A became 1 A."] }), b("try-this", { title: "Try this one", question: "A 12 V supply drives 0.5 A through a resistor. What is its resistance?", answer: "24 Ω" })],
      answer: "2 A; with a second 3 Ω resistor in series the current falls to 1 A.",
    },
    {
      question: "Why are the lights in a home wired in parallel instead of in series?",
      subject: "science",
      topic: "Electrical systems: series and parallel",
      method: "Claim, evidence, reasoning",
      hint: [b("say", { text: "Picture one bulb blowing. What happens to the others in each kind of circuit?" })],
      steps: [b("cer", { title: "Build your answer", claim: "In parallel, each light works on its own.", evidence: "Each branch has the full mains voltage and its own path for current, so a broken bulb only stops its own branch.", reasoning: "In series there is one path: one broken bulb stops them all, and the bulbs share the voltage, so each is dimmer." })],
      full: [b("memory-hook", { title: "Remember it", text: "Series is a single road; parallel gives every light its own lane.", hook: "picture" }), b("try-this", { title: "Try this one", question: "Two identical bulbs are in parallel across a 6 V battery. What is the voltage across each bulb?", answer: "6 V" })],
      answer: "So each light gets the full voltage and keeps working when another one fails or is switched off.",
    },
  ],
};

const levelOf = (level: string | null): keyof typeof LESSONS => (level === "P6" ? "P6" : level?.startsWith("Sec") ? "Sec 2" : "P3");

/** The sample questions a guest can ask at this level. */
export function guestQuestions(level: string | null): string[] {
  return LESSONS[levelOf(level)].map((l) => l.question);
}

/** The lesson for a sample question (the first one at the level if the text doesn't match), at a stage. */
export function guestLesson(level: string | null, question: string | null | undefined, stage: Stage): Explanation {
  const lessons = LESSONS[levelOf(level)];
  const l = lessons.find((x) => x.question === question?.trim()) ?? lessons[0];
  const blocks = [...l.hint, ...(stage === "hint" ? [] : l.steps), ...(stage === "full" ? l.full : [])].slice(0, 6);
  return { question: l.question, figure: null, subject: l.subject, topic: l.topic, method: l.method, stage, blocks, finalAnswer: stage === "full" ? l.answer : null, unclear: false };
}
