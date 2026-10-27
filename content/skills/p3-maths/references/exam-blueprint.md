# P3 end-of-year paper: format, marking and traps

Built from recent school end-of-year papers (kept as private reference) and a
school parent briefing. Use this to set papers that feel like the real thing and
to teach what the marker is looking for.

---

## 1. Paper format

School papers vary a little; the common shape is **50 marks, 1 h 15 min – 1 h 30 min, no calculator**, in three sections:

| Section | What | Typical marks |
|---|---|---|
| A (MCQ) | 10 questions, the first few 1 mark, the rest 2 marks | 15–17 |
| B (short answer) | 10–15 questions, 1–2 marks, answer in a box or on a line | 15–20 |
| C (problem sums) | 5 questions in parts, 3–4 marks each | 15–20 |

Order of difficulty inside each section is roughly increasing; the last two
MCQs and the last short-answer questions are the 2-mark "thinking" items.
Set practice papers to 50 marks so scores are directly comparable.

**Time budget:** Section A 20 min, B 30 min, C 30 min, 10 min check. One mark ≈ 1.5 minutes. If a 2-mark MCQ has eaten 4 minutes, circle it, move on, come back.

**Answer conventions to copy exactly**
- MCQ: shade/write the option number (1, 2, 3, 4) — not the value.
- Short answer: the unit is often pre-printed ("Answer: ______ m") — then write only the number. If it is not printed, write it.
- Area in cm², perimeter in cm; money with two decimal places ($6.00 is fine, $6 is accepted; $16.0 is not); time as "2 h 20 min" or "6.50 p.m." or "21 54" (24-hour, no colon, a space).
- Fractions in simplest form unless the question says otherwise.

## 2. Topic shares (150 marks across the three papers)

| topic | marks | share | mostly in |
|---|---|---|---|
| multiply_divide | 30 | 20% | Section C model problems |
| add_subtract | 23 | 15% | B and C |
| money | 15 | 10% | A (change) and C (best buy) |
| measurement | 14 | 9% | A and B |
| fractions | 12 | 8% | A and B |
| time | 12 | 8% | B and C |
| bar_graphs | 12 | 8% | one graph with 2–4 parts |
| whole_numbers | 11 | 7% | first 3 MCQs |
| area_perimeter | 11 | 7% | A (2 marks) and B/C |
| angles_lines | 10 | 7% | A and B, one drawing question |

Half of Section C is the model method (comparison, before-after, part-whole).
That is where a weak P3 pupil loses 8–10 marks in one go, and where a drawn
bar model earns method marks even when the arithmetic slips.

---

## 3. Question archetypes by topic

The recurring question shapes, with ids and exam weights, are the `archetypes` in `skill.json`. Synthesise new questions by keeping the archetype and changing the surface (numbers, context, which quantity is unknown). Difficulty: 1 easy, 2 medium, 3 hard.

## 4. How marks are awarded

Schools follow the MOE convention of **method marks (M) and answer marks (A)**.
For a 3-mark Section C question: typically M1 for the first correct number
sentence (or a correct bar model), M1 for the second step, A1 for the correct
final answer with unit. For a 2-mark part: M1 A1. For 1-mark items: answer
only.

What this means for the learner:
- A correct **bar model** with units labelled can earn M1 even if the
  arithmetic goes wrong afterwards.
- A correct answer with **no working** in Section C may get A1 only (lose 2 of 3).
- A wrong unit (or missing unit where it is not pre-printed) loses the A mark.
- An answer not in simplest form loses the A mark for fractions.
- "Follow-through" is usually allowed: if (a) is wrong but (b) uses (a)
  correctly, (b) still scores.

**The presentation that scores** (teach it as a fixed shape):
```
468 + 395 = 863                  ← one number sentence per line
1250 − 863 = 387
The learner sold 387 plates on Sunday.    ← statement with the noun/unit
```
Nothing fancier than that. No "=" chains like 12 + 5 = 17 − 3 = 14
(that is marked wrong as a false statement).

---

## 5. The traps that cost P3 pupils the most marks

1. **"fewer than" direction.** "Raj has 45 fewer than Mary" means Mary has
   *more*: Mary = Raj + 45. Half the class subtracts.
2. **Answering the wrong quantity.** Finding the greater number when the
   smaller was asked; finding the remainder when the quotient was asked.
3. **Units before calculation.** 5 m − 127 cm done as 5 − 127.
4. **Time arithmetic in base 10.** 6.00 − 3.40 = 2.60 → "2 h 60 min". The
   time line fixes this.
5. **Perimeter ≠ area.** 7 × 7 = 49 given as the perimeter.
6. **Counting only marked angles** when the question says "inside the figure".
7. **Reading the bar's top at the nearest labelled line** instead of using
   the minor gridlines.
8. **Least amount in best-buy** — rounding up to whole bundles (buying items
   nobody asked for) instead of the cheapest exact mix of bundles and singles.
9. **Not simplifying** 8/12.
10. **Leaving the statement line blank** in Section C.
