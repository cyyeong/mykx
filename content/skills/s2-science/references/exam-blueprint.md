# Exam blueprint: format, command words, answer templates, archetypes

## The paper

There is **no national exam** at lower secondary. Assessment is school-based:
Weighted Assessments during the year plus an end-of-year paper, and formats
vary between schools. The structure below is the common Sec 2 G3 pattern,
based on recent G3 end-of-year papers:

| Component | Typical | Notes |
|---|---|---|
| MCQ | 30 marks, ~30 questions, 1 mark each | Four options, no penalty for guessing |
| Section A — structured | ~40 marks, 6–8 questions | Short parts, 1–4 marks each |
| Section B — free response | ~30 marks, 2–3 questions | Longer, multi-part, often data-response |
| **Total** | **100 marks**, about 2 hours | Calculator permitted |

**Confirm the real format** as soon as the school publishes its exam-format
sheet (the parent records it in the learner's profile) if the topic split
differs from the default. Until then the defaults assume all eight chapters
are examinable with diagram- and calculation-heavy topics carrying slightly
more marks per question.

### What this means for strategy

MCQ is roughly a third of the paper and is the cheapest place to gain marks,
because each question is one idea and there is no writing technique involved.
For a student who loses marks on phrasing, **MCQ accuracy is the fastest
route up**. Drill it first, then move to structured.

Never leave a blank. There is no negative marking, and on structured
questions partial ideas score partial marks.

---

## Command words — what the verb obliges the learner to write

The learner loses marks by answering a different question from the one asked. Make the learner
underline the command word before writing anything.

| Command | Obligation | Length |
|---|---|---|
| **State** / **Name** / **Give** | The fact only. No reasoning wanted. | A phrase |
| **List** | Several facts, no explanation | Bullet-ish |
| **Describe** | What happens, in order. No *why*. | 1 idea per mark |
| **Explain** | The *why* — cause and mechanism | 1 idea per mark |
| **State and explain** | Both: direction first, then reason | Always ≥ 2 marks |
| **Suggest** | Apply known science to an unfamiliar case; several answers may be accepted | 1 idea per mark |
| **Compare** | Both sides, in the same sentence, on the same property | "A is …, whereas B is …" |
| **Calculate** | Show working *and* units | Working scores even if the answer is wrong |
| **Predict** | The outcome, plus the reason if marks allow | Short |
| **Identify** | Pick from the diagram or data given | A phrase |

**The single most common misread:** "state and explain" answered as "state".
Half the marks vanish. Second most common: "describe" answered with a *why*,
which wastes time and scores nothing.

---

## Marks = ideas

A mark is awarded for a distinct scoring idea, not for length. Teach this
explicitly:

- Write the mark count in the margin: `[3]`
- Plan three separate ideas before writing
- Check them off after writing

Three sentences that say the same thing three ways scores **one** mark. One
sentence containing three linked ideas scores **three**. The learner should count
ideas, not lines.

---

## The answer templates

### Explain → **State → Cause → Link**

> **State** the change or observation.
> **Cause:** because [scientific reason with the keyword].
> **Link:** so [consequence].

Worked: *"State and explain what happens to the ammeter reading when R is
increased. [3]"*

> The ammeter reading decreases. *(State)*
> This is because the effective resistance of the circuit increases. *(Cause)*
> A larger resistance opposes the current more, so a smaller current flows
> for the same supply. *(Link)*

### Compare → one sentence, both sides, same property

> "A copper rod conducts thermal energy faster than a plastic rod, **because**
> metals are better thermal conductors than non-metals."

Not: "Copper is a good conductor. Plastic is bad." That is two statements
about two objects, and often scores one mark instead of two.

### Calculate → four lines, every time

```
1  formula          cost = energy (kWh) x price
2  substitution     energy = 1.2 kW x 6 h x 30
3  working          = 216 kWh
4  answer + unit    cost = 216 x 0.32 = $69.12
```

The unit is a mark. Missing units is the most-repeated avoidable loss in the
whole paper.

### Data response → quote the data

Any answer about a table or graph must contain **a number or a named trend
from the data given**. "It increases" is weak; "the current falls from 6.0 A
to 1.0 A as resistance rises from 2 Ω to 12 Ω" is the answer.

### Experimental design → the three variables

> **Change** one thing (independent). **Measure** one thing (dependent).
> **Keep the same**: list at least two controlled variables.

Add "repeat and take an average" when marks allow.

---

## Recurring question archetypes

These are the shapes that repeat across papers. **Synthesise new questions by
re-skinning an archetype**, not by inventing from scratch — the archetype is
what transfers to the real exam. Tag each generated question with its
`archetype` field so coverage can be audited in the mark scheme.

### electrical_systems
| Archetype | The question underneath |
|---|---|
| `identical-readings-in-series` | Give one ammeter reading, ask for another in the same loop |
| `open-one-branch` | Open a switch in one parallel branch, ask about the other lamp |
| `where-does-the-meter-go` | Label positions on a circuit, ask where ammeter/voltmeter belong |
| `slide-the-variable-resistor` | Increase resistance, ask about current and brightness |
| `series-vs-parallel-effective-resistance` | Same resistors, two arrangements, compare current |
| `choose-the-fuse-rating` | Working current given, pick the rating, justify "slightly higher" |
| `match-the-effect-to-the-application` | Chemical / heating / magnetic effect to a device |
| `kwh-bill-calculation` | Power rating + hours + price, with a W→kW conversion trap |
| `spot-the-hazard-and-justify` | Scene with overloading / damaged insulation, name + mechanism |
| `draw-the-circuit` | Written description → circuit diagram using correct symbols |

### heat_transfer
`why-does-metal-feel-colder` · `vacuum-flask-feature-to-function` ·
`where-to-put-the-heating-element` · `bimetallic-strip-which-way-does-it-bend` ·
`black-vs-white-cup-data` · `cooling-curve-reading` · `expansion-gap-explanation`

### forces_and_energy_transfer
`mass-vs-weight-on-another-planet` · `maximum-or-minimum-pressure-from-a-block` ·
`is-work-done-in-this-case` · `energy-conversion-chain` ·
`GPE-to-KE-at-three-points` · `friction-and-thermal-energy`

### chemical_changes
`physical-or-chemical-change` · `complete-the-word-equation` ·
`which-gas-and-how-to-test-it` · `indicator-colour-table` ·
`name-the-reaction-type` · `mass-before-and-after`

### transport_in_living_things
`explain-the-direction-of-diffusion` · `osmosis-in-visking-tubing` ·
`artery-vein-capillary-comparison` · `xylem-or-phloem` ·
`why-villi-have-that-shape`

### human_digestive_system
`enzyme-substrate-product-chain` · `where-is-each-nutrient-digested` ·
`physical-vs-chemical-digestion` · `surface-area-to-volume-argument`

### interactions_with_environment
`complete-the-food-chain-arrows` · `what-happens-if-this-species-is-removed` ·
`energy-loss-between-levels` · `name-the-relationship` ·
`deforestation-consequence-with-mechanism` · `structural-or-behavioural`

### human_reproductive_system
`label-the-organ-and-give-its-function` · `where-does-fertilisation-occur` ·
`menstrual-cycle-day-reasoning` · `how-does-this-birth-control-method-work` ·
`bacterial-or-viral-STI`

---

## Difficulty calibration

Tag every generated question 1–5, and keep sets mostly at 2–3 with one 4.

| Level | Description |
|---|---|
| 1 | Direct recall of a stated fact |
| 2 | One-step application in a familiar context |
| 3 | Two linked steps, or a familiar idea in a new context |
| 4 | Data response, or an idea combined across two sub-skills |
| 5 | Unfamiliar context requiring transfer — one per set at most |

A set that is all level 4–5 teaches the learner that science is impossible. A set
that is all level 1–2 teaches the learner nothing. The useful zone is where the learner gets
roughly 70–80% right.
