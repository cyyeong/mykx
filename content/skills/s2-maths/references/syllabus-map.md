# Sec 2 G3 Maths syllabus map

Source: MOE, *G2 and G3 Mathematics Syllabuses, Secondary One to Four*, implementation starting with the 2020 Secondary One cohort (Curriculum Planning and Development Division, 2024 edition), Section 3 "G3 Mathematics Syllabus", Content by Levels, **Secondary Two**. Under Full Subject-Based Banding, G3 is the level of the former Express course. Public PDF: https://www.moe.gov.sg/api/media/d415c25d-cf29-4b05-83da-9713f38edd14/2020-G2-and-G3-Mathematics-Syllabuses.pdf

The outcome codes below (N5.9, G4.3, S1.10…) are the syllabus's own numbering. Answer conventions for the national G3 paper come from SEAB's *Singapore–Cambridge Secondary Education Certificate G3 Mathematics (Syllabus K310)* for 2027; they are in `references/exam-blueprint.md`.

**Use the exact `topic` and `subskill` tags below (they are in `skill.json`).** Every item names the outcome it assesses in its notes. Anything the syllabus places in Secondary One or Secondary Three/Four is listed under each topic's depth limits; it may be used as a tool, but it is never the point of a Sec 2 question.

---

## 1. `algebra.expansion_factorisation`

Syllabus strand: Number and Algebra, N5 Algebraic expressions and formulae.

| Sub-skill tag | Syllabus outcome (Secondary Two) | Items |
|---|---|---|
| `expand_products` | N5.9 expansion of the product of algebraic expressions | q1 |
| `algebraic_identities` | N5.12 use of (a + b)² = a² + 2ab + b², (a − b)² = a² − 2ab + b² and a² − b² = (a + b)(a − b) | q2, q5 |
| `factorise_by_grouping` | N5.13 factorisation of linear expressions of the form ax + bx + kay + kby | q4 |
| `factorise_quadratic` | N5.14 factorisation of quadratic expressions ax² + bx + c | q3 |

**Depth limits.** Extracting a common factor is Secondary One (N5.8) and is expected as a first step. Completing the square is Secondary Three/Four (N7.11). No cubic expressions.

**High-yield traps.** (a + b)² written as a² + b²; a sign lost when a negative term multiplies a bracket; stopping after one step when the question says "factorise completely".

---

## 2. `algebra.fractions_formulae`

Syllabus strand: Number and Algebra, N5 Algebraic expressions and formulae.

| Sub-skill tag | Syllabus outcome (Secondary Two) | Items |
|---|---|---|
| `change_subject` | N5.10 changing the subject of a formula | q8a |
| `evaluate_formula` | N5.11 finding the value of an unknown quantity in a given formula | q8b |
| `multiply_divide_fractions` | N5.15 multiplication and division of simple algebraic fractions | q6 |
| `add_subtract_fractions` | N5.16 addition and subtraction of algebraic fractions with linear or quadratic denominator | q7 |

**Depth limits.** The syllabus examples for N5.16 include denominators such as x − 2, x² − 9 and (x − 3)². Solving fractional equations that reduce to quadratic equations is Secondary Three/Four (N7.12).

**High-yield traps.** A minus sign in front of a fraction must multiply the whole numerator; fractions are never added "top plus top over bottom plus bottom"; when x appears twice in a formula, collect the x terms and factorise before dividing.

---

## 3. `algebra.inequalities`

Syllabus strand: Number and Algebra, N7 Equations and inequalities.

| Sub-skill tag | Syllabus outcome (Secondary Two) | Items |
|---|---|---|
| `inequality_concept` | N7.5 concept of equation and inequality | q9 |
| `solve_simple_inequalities` | N7.6 solving simple inequalities in the form ax + b ≤ c and ax + b < c | q10 |
| `number_line` | N7.6 representing the solutions on the number line | q11 |

**Depth limits.** One inequality with x on one side only. Linear inequalities in general form and simultaneous inequalities are Secondary Three/Four (N7.13). Solving linear equations, fractional equations that reduce to linear ones, and formulating a linear equation are Secondary One (N7.2–N7.4): they are tools here, not Sec 2 outcomes.

**High-yield traps.** Forgetting to reverse the sign when multiplying or dividing by a negative number; an open circle where the end point is included (≤, ≥); "smallest integer" answered with the boundary value itself.

---

## 4. `algebra.simultaneous_equations`

Syllabus strand: Number and Algebra, N7 Equations and inequalities.

| Sub-skill tag | Syllabus outcome (Secondary Two) | Items |
|---|---|---|
| `linear_graphs_two_variables` | N7.7 graphs of linear equations in two variables (ax + by = c) | q12 |
| `substitution_elimination` | N7.8 solving simultaneous linear equations in two variables by substitution and elimination methods | q14 (q15 also uses elimination) |
| `graphical_method` | N7.8 solving simultaneous linear equations in two variables by the graphical method | q13 |
| `formulate_pair` | N7.10 formulating a pair of linear equations in two variables to solve problems | q15 |

**Depth limits.** Graphs of y = ax + b and the gradient as vertical change over horizontal change are Secondary One (N6.3–N6.5). Finding a gradient from two coordinates, the length of a segment and the equation y = mx + c are coordinate geometry, Secondary Three/Four (G6).

**High-yield traps.** Substituting without brackets (3x + 2·2x − 1); a pair that fits one equation but not the other; reading the wrong axis at the point of intersection.

---

## 5. `algebra.quadratics`

Syllabus strand: Number and Algebra, N6 Functions and graphs and N7 Equations and inequalities.

| Sub-skill tag | Syllabus outcome (Secondary Two) | Items |
|---|---|---|
| `quadratic_functions` | N6.6 quadratic functions y = ax² + bx + c | q17 |
| `quadratic_graph_properties` | N6.7 graphs of quadratic functions and their properties: positive or negative coefficient of x², maximum and minimum points, symmetry | q17, q18 |
| `solve_by_factorisation` | N7.9 solving quadratic equations in one variable by factorisation | q16, q19 |

**Depth limits.** Sketching from y = (x − p)² + q or y = (x − a)(x − b), solving by formula, by completing the square or by the graphical method, and formulating a quadratic equation from a word problem are all Secondary Three/Four (N6.8, N7.11, N7.14). At Sec 2 the quadratic equation is given; the learner solves it and interprets the solutions in context (q19 rejects a negative width).

**High-yield traps.** Giving the numbers inside the brackets as the solutions (x = −7 from x − 7 = 0); writing the line of symmetry as y = …; answering with the width when the question asks for the length.

---

## 6. `number.proportion`

Syllabus strand: Number and Algebra, N2 Ratio and proportion.

| Sub-skill tag | Syllabus outcome (Secondary Two) | Items |
|---|---|---|
| `map_scales` | N2.4 map scales (distance and area) | q22 |
| `direct_proportion` | N2.5 direct proportion | q20 |
| `inverse_proportion` | N2.5 inverse proportion | q21 |

**Depth limits.** The syllabus names direct and inverse proportion without powers, so this pack's items use y = kx and xy = k. Some schools also teach y = kx² or y = k/x² at Sec 2; add such questions only when the learner's scheme of work includes them.

**High-yield traps.** Treating an inverse situation (workers and days) as direct; using the length scale for an area (6 × 0.25 instead of 6 × 0.0625); mixing cm, m and km in one line.

---

## 7. `geometry.congruence_similarity`

Syllabus strand: Geometry and Measurement, G2 Congruence and similarity.

| Sub-skill tag | Syllabus outcome (Secondary Two) | Items |
|---|---|---|
| `congruent_figures` | G2.1 congruent figures | q23 |
| `similar_figures` | G2.2 similar figures; G2.3 properties of similar triangles and polygons (corresponding angles are equal, corresponding sides are proportional) | q25 |
| `enlargement_reduction` | G2.4 enlargement and reduction of a plane figure | q26 |
| `congruence_similarity_problems` | G2.5 solving simple problems involving congruence and similarity | q24 |

**Depth limits.** Determining whether two triangles are congruent or similar (the tests), scale drawings, constructions of bisectors, and ratios of areas and volumes of similar figures are Secondary Three/Four (G2.6–G2.10). At Sec 2 the congruence or similarity is given or follows from the shape (rectangles have equal angles); the work is matching corresponding parts and using proportional sides.

**High-yield traps.** Matching the wrong vertices (the order in △ABC ≡ △PQR matters); using part of a side (DB) where the whole side (AB) corresponds; multiplying an area by the scale factor instead of each length.

---

## 8. `geometry.pythagoras_trigonometry`

Syllabus strand: Geometry and Measurement, G4 Pythagoras' theorem and trigonometry.

| Sub-skill tag | Syllabus outcome (Secondary Two) | Items |
|---|---|---|
| `pythagoras` | G4.1 use of Pythagoras' theorem | q27, q30b |
| `right_angle_test` | G4.2 determining whether a triangle is right-angled given the lengths of three sides | q28 |
| `trig_ratios_sides` | G4.3 use of trigonometric ratios (sine, cosine and tangent) of acute angles to calculate unknown sides in right-angled triangles | q29 |
| `trig_ratios_angles` | G4.3 use of trigonometric ratios of acute angles to calculate unknown angles in right-angled triangles | q30a |

**Depth limits.** Obtuse angles, the area formula ½ab sin C, the sine and cosine rules, angles of elevation and depression, bearings and three-dimensional problems are Secondary Three/Four (G4.4–G4.7). Sec 2 questions name the angle inside a right-angled triangle instead of using "angle of elevation".

**High-yield traps.** Adding squares when the hypotenuse is known; labelling opposite and adjacent from the wrong angle; rounding in the middle of a two-step question.

---

## 9. `measurement.mensuration`

Syllabus strand: Geometry and Measurement, G5 Mensuration.

| Sub-skill tag | Syllabus outcome (Secondary Two) | Items |
|---|---|---|
| `pyramid` | G5.6 volume and surface area of pyramid | q31 |
| `cone` | G5.6 volume and surface area of cone | q32 |
| `sphere` | G5.6 volume and surface area of sphere | q33 |
| `composite_solids` | G5.6, in composite solids (composite solids are first met in Secondary One, G5.5) | q34 |

**Depth limits.** Prisms and cylinders are Secondary One (G5.3) and may appear as parts of a composite solid. Arc length, sector area and radians are Secondary Three/Four (G5.7–G5.8). The cone and sphere formulae are given on the national paper.

**High-yield traps.** Using the height where the slant height belongs (πrl); forgetting the 1/3 for a pyramid or cone; using a whole sphere for a hemisphere.

---

## 10. `statistics.data_analysis`

Syllabus strand: Statistics and Probability, S1 Data handling and analysis.

| Sub-skill tag | Syllabus outcome (Secondary Two) | Items |
|---|---|---|
| `statistical_diagrams` | S1.5 analysis and interpretation of dot diagrams, histograms and stem-and-leaf diagrams; S1.6 purposes and uses, advantages and disadvantages of the different forms of statistical representations | q35 |
| `misinterpretation` | S1.7 explaining why a given statistical diagram leads to misinterpretation of data | q38 |
| `averages` | S1.8 mean, mode and median as measures of central tendency; S1.9 purposes and use of mean, mode and median | q37 |
| `grouped_mean` | S1.10 calculation of the mean for grouped data | q36 |

**Depth limits.** Quartiles, percentiles, range and interquartile range as measures of spread, standard deviation, cumulative frequency diagrams and box-and-whisker plots are Secondary Three/Four (S1.11–S1.16). Histograms have equal class intervals.

**High-yield traps.** Taking the median of unsorted data or the middle row of a stem-and-leaf diagram; using class boundaries instead of mid-values for a grouped mean; calling the mean "best" when one extreme value pulls it.

---

## 11. `statistics.probability`

Syllabus strand: Statistics and Probability, S2 Probability.

| Sub-skill tag | Syllabus outcome (Secondary Two) | Items |
|---|---|---|
| `measure_of_chance` | S2.1 probability as a measure of chance | q41 |
| `single_events` | S2.2 probability of single events (including listing all the possible outcomes in a simple chance situation to calculate the probability) | q39, q40 |

**Depth limits.** Combined events, possibility diagrams, tree diagrams and the addition and multiplication of probabilities are Secondary Three/Four (S2.3–S2.4).

**High-yield traps.** Miscounting the outcomes (10 to 30 is 21 numbers, not 20); counting 21, 25 or 27 as prime; a probability greater than 1.

---

## Not Sec 2: taught in another year

Secondary One (G3): primes, HCF and LCM; integers and real numbers; approximation; ratio, percentage, rate and speed; algebraic notation, linear expressions and common factors; Cartesian coordinates, y = ax + b and gradient; linear and simple fractional equations; angles, triangles and polygons; area of parallelogram and trapezium; prisms and cylinders; tables, bar graphs, pictograms, line graphs and pie charts.

Secondary Three/Four (G3): standard form and indices; sketching quadratics, power and exponential graphs; quadratic formula, completing the square, graphical solutions; general and simultaneous linear inequalities; set language; matrices; congruence and similarity tests, scale drawings, areas and volumes of similar figures; properties of circles; obtuse angles, sine and cosine rules, elevation, depression and bearings; arcs, sectors and radians; coordinate geometry; vectors; quartiles, spread, standard deviation, cumulative frequency and box plots; combined events.

A Sec 2 question may use Secondary One skills as tools. It must never require a Secondary Three/Four outcome.
