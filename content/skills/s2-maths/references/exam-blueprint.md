# Exam blueprint: papers, conventions, marking, archetypes

## The paper

There is **no national exam in Secondary Two**. Schools set their own Weighted Assessments and an end-of-year examination, and the format varies. The national G3 Mathematics examination at the end of Secondary Four (SEAB, Singapore–Cambridge SEC, syllabus K310 for 2027) has two papers, and most schools shape their lower-secondary papers after it:

| National G3 paper (K310) | Duration | Questions | Marks |
|---|---|---|---|
| Paper 1 | 2 h 15 min | about 26 short-answer questions | 90 |
| Paper 2 | 2 h 15 min | 9 to 10 questions of varying length; the last one applies mathematics to a real-world scenario | 90 |

A common Sec 2 end-of-year pattern is a smaller version of this: **Paper 1** of short-answer questions and **Paper 2** of longer structured questions, about 50 marks each and about 1 h 15 min each. Treat that as a default only: the school's own exam-format sheet (the parent can record it in the learner's profile) always wins. There are no multiple-choice questions in the national paper; this pack's multiple-choice items are for practice and quick diagnosis.

Assessment objectives (K310): **AO1** use and apply standard techniques (about 45%), **AO2** solve problems in a variety of contexts (about 40%), **AO3** reason and communicate mathematically (about 15%).

---

## Answer conventions

These are the national G3 conventions (K310 notes); schools follow them from Secondary One.

- **Calculator:** an approved calculator may be used in both papers.
- **Accuracy:** give non-exact answers **correct to 3 significant figures**, and **angles in degrees to 1 decimal place**, unless the question says otherwise. When a question asks you to show an answer to a given accuracy, first show it to a higher accuracy.
- **π:** use the calculator value of π or 3.142, unless the answer is to be left in terms of π.
- **Units:** SI units; compound units in solidus notation (5 cm/s, 13.6 g/cm³). Times may use the 12-hour or 24-hour clock (15 15 for 3.15 p.m.).
- **Formulae:** the paper gives the mensuration formulae for the cone and sphere (and others the learner does not need yet). The learner still needs to know when to use each one.
- **Working:** omitting essential working loses marks.

Practical rules for the learner:

1. **Carry full accuracy, round once.** Keep the calculator value (or at least 5 figures) in every intermediate step; round only the final answer.
2. **Write the unit on the answer line.** cm² for areas, cm³ for volumes, ° for angles.
3. **"In terms of π"** means leave π in the answer (288π cm³); otherwise give a 3-significant-figure number (905 cm³).

---

## Marks and working

Marks are given for method, not only for the final number:

| Code | Meaning |
|---|---|
| **M1** | a method mark: a correct method applied, even if an arithmetic slip follows |
| **A1** | an accuracy mark: the correct answer, which depends on the method mark before it |
| **B1** | an independent mark for a correct fact or value, with no method needed |

What this means for teaching:

- **A bare answer is a risk.** A wrong bare answer scores 0; the same wrong answer under a correct equation usually keeps the M1.
- **Write the equation before the calculator.** "tan 35° = QR/12" earns the method mark; "8.40" alone does not show it.
- **"Show that" questions** need every step, ending with the given result. A "show that" answer that only checks the result by substitution scores little.
- **"Explain" questions** (AO3) need the mathematical reason in a sentence: "the corresponding sides are not proportional because 20 ÷ 12 ≠ 28 ÷ 18".
- **Reject impossible answers in words.** "x = −8 is rejected because a width cannot be negative" is part of the answer.

---

## Recurring question archetypes

The archetypes in `skill.json`, with what each one tests and the usual trap. They are question patterns written from the syllabus outcomes, not copies of any paper.

| Archetype | Topic | Pattern | Usual trap |
|---|---|---|---|
| expand-and-simplify | expansion | expand a product of two brackets and collect like terms | sign of a cross term |
| identity-substitution | expansion | find (x ± y)² from x² + y² and xy | (x − y)² = x² − y² |
| factorise-trinomial | expansion | factorise ax² + bx + c | middle term not checked |
| factorise-by-grouping | expansion | four terms in two pairs | stopping at a sum of two terms |
| factorise-completely | expansion | common factor, then a difference of two squares | missing the common factor |
| algebraic-fraction-operations | fractions | multiply, divide, add or subtract algebraic fractions | minus sign not applied to the whole numerator |
| subject-then-substitute | fractions | make x the subject when x appears twice, then substitute | not factorising out x |
| inequality-rules | inequalities | which statement follows from p < q | multiplying by a negative |
| integer-solutions-of-inequality | inequalities | smallest or greatest integer satisfying ax + b < c | sign not reversed; boundary included |
| solve-and-show-on-number-line | inequalities | solve ax + b ≤ c and describe the number line | open or filled circle |
| intercepts-of-ax-by-c | simultaneous | where ax + by = c meets the axes | swapping the intercepts |
| read-the-intersection | simultaneous | two lines on one graph; the solution is the crossing point | reading the wrong axis |
| check-both-equations | simultaneous | substitution, with options that fit only one equation | not checking both |
| two-items-two-totals | simultaneous | two purchases, two totals, find one price | equations formed the wrong way round |
| solve-quadratic-by-factorising | quadratics | factorise and solve; interpret in context | signs of the solutions; rejecting the wrong root |
| turning-point-and-symmetry | quadratics | table of values or equation → shape, turning point, line of symmetry | y = … for the line of symmetry |
| find-k-then-use | proportion | y = kx: find k, then a new value | ratio set up the wrong way |
| workers-and-days | proportion | inverse proportion in context | treating it as direct |
| map-scale-area | proportion | map area to real area | using the length scale for area |
| congruence-correspondence | congruence | read matching sides and angles from △ABC ≡ △PQR | vertices matched out of order |
| parallel-line-similar-triangles | congruence | DE ∥ BC: find a side by proportion | using part of a side |
| similar-or-not-explain | congruence | decide whether two shapes are similar, with a reason | equal angles taken as enough |
| enlargement-image | congruence | scale factor applied to lengths, then area | scale factor applied to area |
| pythagoras-in-context | pythagoras | ladder, cable or diagonal | adding when it should subtract |
| converse-check | pythagoras | which three lengths make a right angle | not using the longest side |
| soh-cah-toa-side | pythagoras | a side from an angle and a side | wrong ratio |
| soh-cah-toa-angle | pythagoras | an angle from two sides | not using the inverse function |
| solid-volume-formula | mensuration | pyramid or cone volume | forgetting the 1/3 |
| cone-slant-height | mensuration | curved surface area needs l = √(r² + h²) | height used as slant height |
| sphere-reverse | mensuration | from surface area to radius to volume | rounding the radius early |
| composite-solid | mensuration | hemisphere and cone, or cone and cylinder | whole sphere used |
| read-stem-and-leaf | statistics | median or mode from a stem-and-leaf diagram | reading the key wrongly |
| grouped-mean-midpoints | statistics | estimate the mean from a grouped table | class boundaries instead of mid-values |
| choose-the-average | statistics | which average is typical when one value is extreme | choosing the mean |
| spot-the-misleading-diagram | statistics | a truncated axis or unequal pictures | blaming colour or chart type |
| single-event-probability | probability | equally likely outcomes, listed or counted | miscounting the outcomes |
| probability-scale | probability | probability lies from 0 to 1 | accepting values above 1 |

---

## Difficulty calibration

| Level | What it looks like | Example in this pack |
|---|---|---|
| 1 | one routine step, one idea | where 2x + 3y = 12 meets the axes |
| 2 | two routine steps, or one step with a common trap | a ladder against a wall |
| 3 | a standard multi-step question, or a trap that catches most first attempts | the smallest integer satisfying 7 − 3x < 22 |
| 4 | several steps joined by a decision (which side, which root, which method) | make x the subject when x appears twice |
| 5 | an unfamiliar context or a chain of three or more ideas | the real area of a park from its area on a 1 : 25 000 map (unit change, squared scale, then multiply) |

A healthy practice set for one topic: two level-2 items to warm up, two at level 3, one at level 4. Move up only after two clean answers in a row.
