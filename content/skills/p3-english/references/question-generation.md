# Writing new P3 English items

## 1. Synthesise, don't copy

Take an **archetype** (from `skill.json` or `exam-blueprint.md`),
keep its **skill** and its **trap**, change the **surface**: new names, new
setting, new verbs, their interests, a different position in the sentence.

Example archetype: *interrupted past action*.
* One surface: "My cousins ___ in the pool when the thunder started."
* New surface: "Marcus and their dad ___ football at the field when it started to pour."
* Harder twist: put the clue first: "When the fire alarm rang, the pupils ___ in the hall."
* Inversion for R3: "Why is *played* wrong here?"

Target the weakest tags in `learner_summary()`. A targeted set is 12–25 marks: about 60%
on the 1–2 weakest skills, 40% mixed review (interleaving), and the last item
easy (end on a win).

## 2. Writing items that test the right thing

* **One skill per item**, and tag it with that skill. If an item needs two
  skills (e.g. "Every student ___ punctual earlier today" needs SVA and past
  tense), tag the one it is designed to catch, and say so in `why`.
* **Every distractor is a real misconception**, not filler. For tense items:
  one wrong-time option, one wrong-number option, one wrong-form option. For
  pronouns: right person wrong job (the learner vs the learner), right job wrong number (the learner vs
  they), and an owner word.
* **Exactly one defensible answer.** Read each option into the sentence aloud.
  If two work, rewrite.
* **Clue present.** The sentence must contain the clue that decides it (a time
  word, near/far, a clue twin). A child should be able to point at it.
* **P3 vocabulary in stems.** Hard words only where they are the thing tested.
* **British spelling and Singapore context**: colour, favourite, practise (verb),
  neighbour, MRT, hawker centre, HDB block, community centre, void deck, recess.
  Use a mix of Singapore names (Wei Jie, Mei Ling, Ahmad, Priya, Nurul, Ravi,
  Daniel, Hui Min) and the learner's own name now and then.
* **Comprehension passages**: narrative 180–260 words, 4–6 short paragraphs,
  past tense, a clear problem and resolution, a feeling shift, one or two
  "pick-out-a-phrase" phrases (heart sank, froze in fear, giggles filled the
  room), one pronoun worth asking about. Factual passages: simple headings,
  numbers to check, one "why" relationship.
* **Comprehension items** for an 8-mark passage: 1 MCQ, 2–3 true/false rows,
  1 referent, 1 word meaning, 1 phrase, 1 sequence, 1 two-mark feeling+reason
  or two-things question, 1 inference. Mix to fit.
* **Keep it kind and safe**: everyday school, family and outdoor situations.
  Mild problems (a lost pet, a rainy day, a disagreement) with a positive
  ending. No real brands, celebrities, or copyrighted characters.

## 3. Quality checklist (run on every item before building)

1. Is the answer correct, and is it the **only** correct option? Say each
   option aloud in the sentence.
2. Does the stem contain the clue? Point to it.
3. Does each distractor match a named misconception?
4. Is the `why` one or two sentences a 9-year-old understands, naming the clue?
5. Is the `tag` an exact tag from `syllabus-map.md`?
6. For open answers: is the model answer **lifted from the passage**, and are
   reasonable alternatives listed in `accept`?
7. For 2-mark items: does `mark_note` say what earns each mark?
8. For word-box cloze: is every word used once, and do the extra words each
   fail for a clear reason?
9. For phrase questions: count the words in the answer.
10. For referents: substitute the answer into the sentence; it must make sense.
