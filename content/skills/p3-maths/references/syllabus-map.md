# P3 Maths syllabus map

Source: MOE *Mathematics Syllabus Primary One to Six, Implementation starting
with 2021 Primary One Cohort* (updated Dec 2023), Primary Three section, plus
school briefings (topics by term; the end-of-year exam is usually most of the year's grade).
Everything below is examinable in the end-of-year paper. P2 content is also
fair game ("summative assessment may also assess learning outcomes from the
previous year") — in practice that means tables of 2–5 and 10, like fractions,
and reading time to the minute.

Use the **tag** (topic / sub-skill) exactly as written; they are the topic
`source_tag` and `subskills` in `skill.json`. The tags are what make the statistics mean anything.

---

## Term order in school (2026)

| Term 1 | Term 2 | Term 3 | Term 4 |
|---|---|---|---|
| Numbers to 10 000 · Addition & Subtraction · Money | Tables of 6, 7, 8, 9 · Multiplication & Division · Four-operation word problems · Bar graphs | Angles · Perpendicular & parallel lines · Fractions · Length, mass & volume | Area & perimeter · Time |

Term 4 topics (area/perimeter, time) are the freshest and the least practised
— they show up disproportionately as lost marks.

---

## NUMBER AND ALGEBRA

### `number.whole_numbers` — Numbers up to 10 000 (≈7% of marks)
| sub-skill tag | learning outcome |
| --- | --- |
| `place_value` | thousands/hundreds/tens/ones; value of a digit |
| `numerals_words` | read/write numerals ↔ words; compose from "9 thousands 34 ones" |
| `compare_order` | compare and order 4-digit numbers |
| `number_patterns` | patterns in sequences incl. alternating steps |
| `digit_value` | sum/difference of digit values across numbers |

**Depth limits.** Numbers to 10 000 only (a 5-digit number occasionally slips into a
paper — treat 5-digit reading as a bonus, not core). No rounding, no ≈ (P4).

### `number.add_subtract` — Addition and Subtraction (≈15%)
| tag | outcome |
| --- | --- |
| `algorithm_4digit` | column + and − up to 4 digits with renaming |
| `missing_number` | find the box in 2615 + □ = 8510 |
| `missing_digit` | find a missing digit inside a column sum |
| `fewer_more_than` | "34 fewer than", "45 fewer than Mary" — direction of the comparison |
| `two_step` | add then subtract, or subtract twice |
| `part_whole_model` | whole = parts; find the missing part |
| `sum_difference_model` | two numbers with a given sum and difference |
| `working_backwards` | "had some money… in the end had $X; at first?" |

**Depth limits.** Mental calc: two 2-digit numbers only. Problems are at most
2 steps (3 steps appear only in Section C with the model drawn).

### `number.multiply_divide` — Multiplication and Division (≈20%, the biggest slice)
| tag | outcome |
| --- | --- |
| `tables_6_9` | tables of 6, 7, 8, 9 (2–5, 10 from P2) to automaticity |
| `multiply_3d_by_1d` | algorithm up to 3-digit × 1-digit |
| `divide_3d_by_1d` | algorithm up to 3-digit ÷ 1-digit |
| `division_remainder` | quotient and remainder; "left unpacked"; "which leaves remainder 3" |
| `equal_groups` | share/group word problems |
| `two_step_mul_div` | × then ÷ (or the reverse) |
| `comparison_model_times` | "A is 3 times as heavy as B"; units |
| `comparison_model_extra` | "twice as many blue as red, 8 more green than red" — units plus an extra |
| `before_after` | quantity changes then becomes n times another |
| `simultaneous_compare` | two purchases differing in one item |

**Depth limits.** No 2-digit × 2-digit (P4). No factors/multiples language
(P4) — "no remainder when divided by 4" is asked, "multiple of 4" is not.
Division answers in the form "161 R2"; no fractions or decimals as quotients.

### `number.money` — Money (≈10%)
| tag | outcome |
| --- | --- |
| `add_money` | add in decimal notation |
| `subtract_money` | subtract in decimal notation |
| `change` | change from $10 / $100 / two $50 notes |
| `multiply_price` | n items at one price |
| `best_buy_grouping` | bundle price vs single price; "least amount"; free items |

**Depth limits.** Only + and − in decimal notation are in the syllabus;
multiplication of money appears as repeated addition of whole dollars.
No decimals outside money.

### `number.fractions` — Fractions (≈8%)
| tag | outcome |
| --- | --- |
| `equivalent_fractions` | find equivalent fractions; given numerator or denominator |
| `simplest_form` | reduce |
| `compare_order_unlike` | order unlike fractions, denominators ≤ 12 |
| `number_line` | read a fraction from a 0–1 number line |
| `add_related` | add two related fractions (one denominator a multiple of the other), answer within 1 |
| `subtract_related` | subtract related fractions |
| `subtract_from_whole` | 1 − a fraction |

**Depth limits.** Related denominators only (one divides the other), both
≤ 12, results within one whole, always simplest form. No mixed numbers, no
improper fractions, no fraction of a set, no unrelated denominators like
1/3 + 1/4 (all P4). Comparing unlike fractions is done by equivalent fractions
or by benchmarking against ½ and 1 — not by decimals.

---

## MEASUREMENT AND GEOMETRY

### `measurement.length_mass_volume` — Length, Mass, Volume (≈9%)
| tag | outcome |
| --- | --- |
| `convert_length` | km ↔ m, m ↔ cm, compound units |
| `convert_mass` | kg ↔ g |
| `convert_volume` | ℓ ↔ ml |
| `compound_units` | express an answer in km and m / kg and g |
| `read_scale` | read a measuring container / jug |
| `measure_word_problem` | 1–2 step problems in any unit |
| `routes_compare` | add legs of a route map; choose the shorter |

**Depth limits.** "Numbers within easy manipulation": no 3.25 km style
decimals. No conversion between cm² and m².

### `measurement.time` — Time (≈8%)
| tag | outcome |
| --- | --- |
| `convert_h_min` | hours ↔ minutes |
| `tell_time_24h` | 24-hour clock notation, a.m./p.m. ↔ 24 h |
| `duration` | finishing − starting |
| `end_time` | start + duration |
| `start_time` | end − duration |
| `across_midnight` | duration crossing 00 00 |
| `two_step_time` | total time − one part = other part, then start/end |

**Depth limits.** Seconds are measured (stopwatch) but not converted in
problems. Every duration question is expected to show a **time line** — the
3 papers say "draw a timeline to show your working".

### `geometry.area_perimeter` — Area and Perimeter (≈7%)
| tag | outcome |
| --- | --- |
| `area_counting_squares` | area on a 1 cm grid, half-squares count ½ |
| `area_rectangle_square` | length × breadth; side × side; cm², m² |
| `perimeter_rectangle_square` | add all four sides |
| `perimeter_rectilinear` | perimeter of an L/T shape or figure of identical rectangles |
| `area_vs_perimeter` | same perimeter, different area (and vice versa) |
| `wire_reshaped` | wire of fixed length bent into a square |

**Depth limits.** Area of composite figures and "find the missing side from
the area" are P4. Only rectangle/square area; perimeter of any rectilinear
figure. Units: cm² and m², written with the superscript.

### `geometry.angles_lines` — Angles; Perpendicular and Parallel Lines (≈7%)
| tag | outcome |
| --- | --- |
| `right_acute_obtuse` | right angle; smaller (acute) / greater (obtuse) than a right angle |
| `count_angles_in_figure` | count acute/obtuse/right angles inside a figure |
| `identify_parallel` | lines that never meet, same "slope" on a grid |
| `identify_perpendicular` | lines meeting at a right angle (⊥) |
| `draw_parallel` | draw a parallel line through a given point on a grid |
| `draw_perpendicular` | draw a perpendicular through a point |

**Depth limits.** No degrees, no protractor, no naming as ∠ABC (P4). Angles
are compared to a right angle by eye or with the corner of a paper.

---

## STATISTICS

### `statistics.bar_graphs` — Bar Graphs (≈8%)
| tag | outcome |
| --- | --- |
| `read_scale` | read bars on scales of 1, 2, 5, 10 |
| `read_minor_gridlines` | read a value between labelled lines using minor lines |
| `difference_between_bars` | how many more/fewer |
| `double_bar_compare` | two series (hatched + dotted) on one graph; which day had 5 more mugs than bottles |
| `total_from_graph` | sum across bars or series |
| `graph_to_money` | total items × price |

**Depth limits.** Vertical and horizontal bar graphs only; no line graphs,
tables with blanks, or pie charts (P4).

---

## What is NOT in P3 (do not teach, do not set)
- Rounding, ≈, factors and multiples, 2-digit × 2-digit, 4-digit ÷ 1-digit
- Mixed numbers, improper fractions, fraction of a set, unrelated denominators
- Decimals other than money
- Degrees, protractors, angle names like ∠ABC, line symmetry, nets
- Area of composite figures, finding a side from area, cm² ↔ m²
- Line graphs, pie charts, tables to complete
- Algebra of any kind — "units" in the model method are the P3 way to say it
