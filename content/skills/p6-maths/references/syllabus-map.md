# Syllabus map: MOE 2021 statements, pack topics and items

Every P1–P6 statement of the 2021 syllabus is examinable at the PSLE. The syllabus document says it applies to
Primary 6 **from 2026 onwards**, so the 2026 cohort is the first to sit the PSLE fully on it. Use this map to
keep every question inside the syllabus and to name the statement a question assesses.

## Source documents

| Document | Version | Link | Used for |
|---|---|---|---|
| MOE, *Mathematics Syllabus, Primary One to Six* ("2021 Primary Mathematics Syllabus", implementation starting with the 2021 Primary One cohort) | updated Oct 2025 | https://www.moe.gov.sg/api/media/92bff26d-b2b4-4535-b868-b8415c744b91/2021-Primary-Mathematics-Syllabus-P1-to-P6-Updated-October-2025.pdf | content statements by level (Standard), what is left out |
| SEAB, *PSLE Mathematics (0008), for examination from 2026* | 2026 | https://isomer-user-content.by.gov.sg/334/fe51f29b-04ae-4fcb-a907-8db04c028510/0008_y26_sy.pdf (listed on https://www.seab.gov.sg/psle/psle-formats-examined-in-2026/) | paper format, item types, units rule (see `exam-format.md`) |

Statement numbers below are the syllabus's own, by level ("P5 Whole Numbers 2.2" = Primary 5, Whole Numbers, 2.2).

## What a P6 candidate is examined on

### Number and Algebra
| Sub-strand | Statements (level) | Pack topic |
|---|---|---|
| Whole numbers | numbers to 10 000 and the four operations (P1–P3); numbers to 100 000, rounding to the nearest 10, 100 or 1000, use of ≈, factors and multiples (common factors of two numbers; common multiples of two 1-digit numbers), multiplication and division algorithms (P4); numbers to 10 million in numerals and words, × and ÷ by 10, 100, 1000 and their multiples, order of operations, brackets (P5) | `number.whole_numbers` |
| Fractions | fraction of a whole, equivalent fractions, simplest form (P2–P3); mixed numbers, improper fractions, fraction of a set, + and − (P4); fraction and division, fractions as decimals, + and − of mixed numbers, × (P5); ÷ a proper fraction by a whole number, ÷ a whole number or proper fraction by a proper fraction (P6) | `number.fractions` |
| Decimals | up to 3 decimal places: place value, comparing and ordering, decimals ↔ fractions, rounding to a whole number, 1 or 2 decimal places, + and − (up to 2 d.p.), × and ÷ by a 1-digit whole number, whole number ÷ whole number as a decimal, rounding answers (P4); × and ÷ by 10, 100, 1000 and their multiples, measurements in decimal form (P5) | `number.decimals` |
| Money | counting, decimal notation, + and − (P1–P3) | inside word problems |
| Percentage | part of a whole as a percentage, percentage of a whole, discount, GST and annual interest (P5); the whole from a part and its percentage, percentage increase and decrease (P6) | `number.percentage` |
| Rate | rate as a quantity per unit of another; rate, total amount or number of units from the other two (P5) | `measurement.rate` |
| Ratio | a : b and a : b : c with whole numbers, equivalent ratios, dividing in a ratio, simplest form, ratio of given quantities, missing term, fraction ↔ ratio (P6) | `number.ratio` |
| Algebra | a letter for an unknown, simple expressions, simplifying (no brackets), substitution, simple linear equations with whole-number coefficients (P6) | `algebra.expressions` |

### Measurement and Geometry
| Sub-strand | Statements (level) | Pack topic |
|---|---|---|
| Measurement | length, mass, volume of liquid, appropriate units (P1–P2); km and ml, compound units and conversion (P3); time to the minute, hours and minutes (P2); seconds, starting time, finishing time or duration, 24-hour clock (P3) | `measurement.units_time` |
| Area and perimeter | rectangles and squares (P3); one dimension from area or perimeter, composite rectilinear figures (P4); area of a triangle, composite figures with triangles (P5) | `geometry.area_perimeter` |
| Circles | area and circumference; semicircle and quarter circle; composite figures (P6) | `geometry.circles` |
| Volume | building solids with unit cubes, cubic units (no cm³ ↔ m³), drawing cubes and cuboids on an isometric grid, volume of a cube or cuboid, liquid in a rectangular tank, ℓ and ml ↔ cm³ (P5); one dimension from the volume, edge of a cube, height from volume and base area, area of a face, use of √ and ∛ (P6) | `measurement.volume`, `geometry.solids` |
| Angles and shapes | angles, perpendicular and parallel lines (P3); naming and measuring angles, rectangle and square properties, line symmetry (P4); angles on a straight line, at a point, vertically opposite; isosceles, equilateral and right-angled triangles; parallelogram, rhombus, trapezium (P5); unknown angles in composite figures without additional construction of lines (P6) | `geometry.angles` |
| Nets and 3D solids | cube, cuboid, cone, cylinder, sphere (P2); 2D representations of cube, cuboid, cone, cylinder, prism and pyramid; nets of cube, cuboid, prism and pyramid; the solid formed by a given net (P4) | `geometry.solids` |

### Statistics
| Sub-strand | Statements (level) | Pack topic |
|---|---|---|
| Data representation | picture graphs (P1–P2); bar graphs (P3); tables, line graphs and pie charts (P4) | `statistics.data` |
| Data analysis | average as total ÷ number; average, total and number (P6) | `statistics.average` |

## Syllabus → pack topics and subskills

| Pack topic | Subskill | Statements | Status |
|---|---|---|---|
| `number.whole_numbers` | `place_value_numerals` | P4 Whole Numbers 1.1–1.3; P5 1.1 | aligned |
| | `rounding` | P4 1.5–1.6 | aligned |
| | `factors_multiples` | P4 2.1–2.5 | aligned (common multiples: of two 1-digit numbers) |
| | `order_of_operations` | P5 2.2–2.3 | aligned |
| | `number_patterns` | patterns in number sequences (P1–P4) | aligned |
| | `whole_number_word_problems` | four operations in context (P1–P5) | aligned |
| `number.decimals` | `compare_order_decimals` | P4 Decimals 1.1–1.2 | aligned |
| | `decimal_fraction_conversion` | P4 1.3–1.4; P5 Fractions 1.2 | aligned |
| | `decimal_operations` | P4 2.1, 3.1–3.2; P5 Decimals 1.1–1.2 | aligned |
| | `rounding_decimals` | P4 1.5, 3.3 | **added in v1.1.0** (rounding decimals had no subskill of its own) |
| `measurement.units_time` | `unit_conversion` | P3 Measurement 1.3; P5 Decimals 1.2 | aligned |
| | `time_schedules` | P3 Measurement 2.2–2.3 | aligned |
| | `estimation` | P2 Measurement 1.2 (appropriate units) | aligned: "estimation" means choosing a sensible measure |
| `geometry.solids` | `nets` | P4 Geometry 4.1–4.4 | aligned |
| | `unit_cubes` | P5 Area and Volume 2.1–2.3 | aligned |
| | `views` | not named in the syllabus | kept for the school-paper archetypes only; see below |
| all other topics | (unchanged) | as in the tables above | aligned |

## Not in the 2021 syllabus (keep out of questions)

- **Speed** (distance, time and speed) and **8-point compass directions**: not in the document at any level.
- **Top, front and side views** by those names: the syllabus says "2D representations" (P4) and isometric drawing (P5). Some school papers ask about views, so the `views` subskill stays for those archetypes, but new questions should test nets, unit cubes and isometric drawings instead.
- **Alternate and corresponding angles** by name (Secondary 1): angle questions use the properties of triangles and special quadrilaterals, "without additional construction of lines". Between parallel sides, the two angles on the same side of a crossing line add up to 180°.
- **Decimals without a calculator** stop at × and ÷ by a 1-digit whole number and by 10, 100, 1000 and their multiples. Decimal × decimal or ÷ by a decimal belongs in calculator (Paper 2) questions.
- **Common multiples** are for two given 1-digit numbers; larger numbers only through common factors or context.
- Ratios with fractions or decimals; converting cm³ ↔ m³ or cm² ↔ m²; simplifying expressions with brackets; equations with fractional coefficients.

## Items written from the syllabus (v1.1.0)

`items/original-02.json`, written by Claude Code from the statements above; every key re-solved independently; founder review pending.

| Item | Topic · subskill | Syllabus statement | Format |
|---|---|---|---|
| `p6math-original-02-q1` | `number.whole_numbers` · `place_value_numerals` | P5 Whole Numbers 1.1 (reading and writing numbers in numerals and in words, numbers up to 10 million) | Paper 1 Booklet A, 1-mark multiple choice |
| `p6math-original-02-q2` | `number.whole_numbers` · `rounding` | P4 Whole Numbers 1.5 (rounding numbers to the nearest 10, 100 or 1000) | Paper 1 Booklet A, 2-mark multiple choice |
| `p6math-original-02-q3` | `number.whole_numbers` · `order_of_operations` | P5 Whole Numbers 2.2–2.3 (order of operations; use of brackets; without calculator) | Paper 1 Booklet A, 1-mark multiple choice |
| `p6math-original-02-q4` | `number.whole_numbers` · `factors_multiples` | P4 Whole Numbers 2.1, 2.3 (factors and multiples; finding the common factors of two given numbers) | Paper 1 Booklet B, 2-mark short answer |
| `p6math-original-02-q5` | `number.whole_numbers` · `number_patterns` | P4 Whole Numbers 1.4 (patterns in number sequences); P6 Algebra 1.5 (simple linear equations) for the general term | Paper 2, 2-mark short answer |
| `p6math-original-02-q6` | `number.whole_numbers` · `whole_number_word_problems` | Whole numbers in context: P1–P5 Four Operations (whole numbers and money), solved with the substitution heuristic | Paper 2, 3-mark structured question |
| `p6math-original-02-q7` | `number.whole_numbers` · `whole_number_word_problems` | Whole numbers in context (P4–P5 Four Operations), solved with the before-and-after heuristic (total unchanged) | Paper 2, 4-mark structured question |
| `p6math-original-02-q8` | `number.decimals` · `compare_order_decimals` | P4 Decimals 1.1–1.2 (place values to thousandths; comparing and ordering decimals) | Paper 1 Booklet A, 1-mark multiple choice |
| `p6math-original-02-q9` | `number.decimals` · `decimal_fraction_conversion` | P4 Decimals 1.3 (expressing decimals as fractions); P3 Fractions 1.2 (simplest form) | Paper 1, 1-mark short answer |
| `p6math-original-02-q10` | `number.decimals` · `decimal_operations` | P5 Decimals 1.1 (multiplying and dividing decimals by 10, 100, 1000 and their multiples without calculator) | Paper 1 Booklet A, 1-mark multiple choice |
| `p6math-original-02-q11` | `number.decimals` · `decimal_operations` | P4 Decimals 2.1 (adding and subtracting decimals) with money (P3 Money 1.1); calculator work as in Paper 2 | Paper 2, 3-mark structured question (calculator allowed) |
| `p6math-original-02-q12` | `number.decimals` · `decimal_operations` | P4 Decimals 2.1 and 3.1–3.2 (operations on decimals); P3 Measurement 1.2 (mass); calculator work as in Paper 2 | Paper 2, 4-mark structured question (calculator allowed) |
| `p6math-original-02-q13` | `measurement.units_time` · `estimation` | P2 Measurement 1.1–1.2 (measuring mass in kilograms/grams; using appropriate units) | Paper 1 Booklet A, 1-mark multiple choice |
| `p6math-original-02-q14` | `measurement.units_time` · `unit_conversion` | P5 Decimals 1.2 (converting a measurement from a smaller unit to a larger unit in decimal form: kilograms and grams) | Paper 1 Booklet A, 1-mark multiple choice |
| `p6math-original-02-q15` | `measurement.units_time` · `unit_conversion` | P5 Decimals 1.2 (litres and millilitres in decimal form); P3 Whole Numbers 3.3 (division with remainder) | Paper 1 Booklet B, 2-mark short answer |
| `p6math-original-02-q16` | `measurement.units_time` · `time_schedules` | P3 Measurement 2.2–2.3 (finding the starting time, finishing time or duration; 24-hour clock) | Paper 1 Booklet B, 2-mark short answer |
| `p6math-original-02-q17` | `measurement.units_time` · `time_schedules` | P3 Measurement 2.2 (finishing time from starting time and duration) with P5 Rate 1.2 (finding the total amount given the rate) | Paper 2, 3-mark structured question |
| `p6math-original-02-q18` | `geometry.solids` · `nets` | P4 Geometry 4.4 (identifying the solid which can be formed by a given net: pyramid) | Paper 1 Booklet A, 1-mark multiple choice |
| `p6math-original-02-q19` | `geometry.solids` · `nets` | P4 Geometry 4.3–4.4 (identifying the nets of 3D solids: prism; the solid formed by a given net) | Paper 1 Booklet A, 1-mark multiple choice |
| `p6math-original-02-q20` | `geometry.solids` · `nets` | P4 Geometry 4.3 (identifying the nets of 3D solids: cube) | Paper 1 Booklet A, 2-mark multiple choice |
| `p6math-original-02-q21` | `geometry.solids` · `unit_cubes` | P5 Area and Volume 2.1–2.2 (building solids with unit cubes; measuring volume in cubic units) | Paper 1 Booklet B, 2-mark short answer |
| `p6math-original-02-q22` | `geometry.solids` · `nets` | P4 Geometry 4.3 (nets of a cuboid) with P5 Area and Volume 2.4 (volume of a cube/cuboid) and P6 Area and Volume 2.5 (use of square roots) | Paper 2, 3-mark structured question |
| `p6math-original-02-q23` | `number.decimals` · `rounding_decimals` | P4 Decimals 1.5 (rounding decimals to 2 decimal places) and 3.3 (rounding answers to a specified degree of accuracy) | Paper 1, 1-mark short answer |
