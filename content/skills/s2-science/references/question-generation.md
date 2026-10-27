# Generating questions with real diagrams

## The diagram rule

**Never use ASCII art, and never substitute a text description for a
diagram.** A Sec 2 science paper is a visual document — roughly half the
marks depend on reading a circuit, apparatus setup, graph or labelled
structure. Practising on text-only questions trains a skill the exam does
not test and leaves the one it does test untrained.

Every figure is a real vector drawing (SVG) using standard circuit symbols.

**When a good diagram is genuinely not possible** — a labelled uterus, a
cross-section of villi, a detailed digestive tract — do *not* produce a poor
imitation. A wrong anatomical drawing teaches wrong anatomy. Instead:

- use a labelled flow chart (real papers use these for
  digestion, the menstrual cycle, energy transfer and food chains);
- use a table of structure against function;
- or reference their own notes by page: "look at the diagram on p.45 of your
  notes and label the oviduct".

This is a real constraint, stated honestly, not a limitation to work around.

---

## How to synthesise a new question

Do not invent from nothing, and do not copy a past paper verbatim. Re-skin an
archetype from `references/exam-blueprint.md`:

1. **Pick the archetype** that targets the sub-skill `learner_summary()` flagged.
2. **Change the surface.** Swap lamps for resistors; move the switch to the
   other branch; change 6 V to 9 V; make the appliance a rice cooker.
3. **Invert or extend it.** "What happens?" → "Explain why it does not
   happen." "Calculate the cost" → "The family halves the usage; calculate the
   saving."
4. **Check the depth limit** in `references/syllabus-map.md`. The most common
   violation by far is smuggling in V = IR.
5. **Write the distractors from real errors.** Each wrong option should be the
   answer a student gets by making one specific mistake, and the `distractors`
   field should name that mistake. Options that are merely wrong teach
   nothing; options that are diagnostic tell you which misconception the learner holds.
6. **Tag it** with topic, subskill, archetype and difficulty so the result
   feeds the learner record.

### Worked example of re-skinning

Archetype: `open-one-branch`.

- Original: two lamps in parallel, open the switch in branch 2, what happens
  to lamp P?
- Variant A: three branches, one lamp already blown — does the third still
  light? (adds a distractor about "broken circuit")
- Variant B: same circuit, but ask "explain why the ammeter in the main
  circuit reading falls" (shifts from `parallel_independence` to
  `effective_resistance`)
- Variant C: give it as a fault-finding scenario — "a room's lights stay on
  when the fan is switched off; explain what this tells you about how they are
  wired" (same physics, unfamiliar context, difficulty 4)

Same underlying idea, four different questions, increasing transfer demand.

---

## Quality checklist before shipping a set

- [ ] Every figure rendered and **visually inspected** — no overlapping labels
- [ ] No question requires V = IR or any other out-of-syllabus tool
- [ ] Marks = number of distinct mark points in the `answer` list
- [ ] Every distractor names a specific error
- [ ] Difficulty mostly 2–3, at most one 4–5
- [ ] Mixed sub-skills, not ten questions on one thing
- [ ] Topic coverage across the set looks sane
- [ ] Answers and mark schemes are never shown to the learner before an attempt
