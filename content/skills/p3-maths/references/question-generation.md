# Writing P3 maths questions

Three rules before anything else:

1. **Every diagram is a real vector figure.**
   Never ASCII art, never "imagine a bar graph where…". A P3 paper is a
   visual document; a child who has only practised on text will freeze at the
   first grid.
2. **Every answer is computed, not recalled.** Work every answer out
   independently (and check geometry such as angle counts) before it goes into
   an item. Published answer keys contain errors; yours should have none.
3. **Synthesise, don't copy.** Keep the archetype from `exam-blueprint.md`,
   change the surface (numbers, context, which quantity is unknown). Use
   the learner's interests for contexts.

---

## Writing good P3 questions

**Numbers.** Within 10 000. Tables 2–10 only. 3-digit × 1-digit, 3-digit ÷
1-digit. Money to 2 decimal places. Fractions with denominators ≤ 12 and
related (one divides the other). Measurements "within easy manipulation"
(2 kg 25 g, 1 km 660 m, not 3.275 km).

**Language.** Short sentences. One idea per sentence. The question comes last
and is a question. Avoid double negatives. Name the unit the answer must be in
("Give your answer in km and m").

**Distractors for MCQ.** Each wrong option is the result of one specific
mistake (wrong direction of "fewer", forgot to rename, read the wrong bar,
answered the quotient instead of the remainder). Write that mistake in
`distractors` — it tells you what to log.

**Section C shape.** Part (a) is a one-step entry (1–2 marks) that also hands
the learner a number the learner needs for (b). Part (b) is the model-method step (2–3 marks).
This is exactly how the real papers scaffold it, and it means a shaky pupil
still banks the (a) marks.

**Fun without losing the maths.** Swap contexts freely (bubble tea, football
rounds, sticker packs, seashells, game tokens) and use the learner's name once or
twice per paper. Do not add jokes to the stem — they cost reading effort. The fun is
in the format of the *session* (beat-the-clock, streaks, error hunting), not
in the question text.

---

## Targeted sets (the usual case)

A targeted set is 6–10 questions, 10–15 marks, on the 2–3 sub-skills that rank
highest in `learner_summary()` (clock faces in the paper, time lines in the
working), plus 2 interleaved questions from settled sub-skills.
Difficulty ladder inside each sub-skill: one D1, one D2, one D3. Keep it;
a set scored 60% on is worth re-running a week later with the numbers changed.

---

## QA checklist before delivering a set

- [ ] Looked at every figure (labels inside the
      frame, nothing overlapping, hatching visible).
- [ ] Every answer recomputed; the working matches.
- [ ] Marks per section add up.
- [ ] Units printed where the paper expects them; cm² has the superscript.
- [ ] No topic outside `syllabus-map.md` (no degrees, no composite area, no
      2-digit × 2-digit, no unrelated fractions).
- [ ] At least one drawing question (parallel/perpendicular) and one bar graph
      in any full paper.
- [ ] MCQ answer letters spread across (1)–(4) — no letter more than 3 times
      in 10. Reorder options if needed and remap the distractor notes.
- [ ] Section C stems stay with part (a).
