# Sec 2 G3 Science syllabus map

Source: school summary notes, aligned to MOE *Science Syllabus,
Lower Secondary, General 2 / General 3 Course* (2021, updated April 2024).
G2 and G3 share one syllabus document; they differ in depth and in the demand
of the learning outcomes, not in topic list.

**Use the exact `topic` and `subskill` tags below (they are in `skill.json`).** Inconsistent tags make the statistics meaningless.

The **depth limits** are as important as the content. Teaching above them
burns attention the learner cannot spare; teaching below them loses marks.

---

## 1. `chemistry.chemical_changes`

| Sub-skill tag | Covers |
|---|---|
| `physical_vs_chemical` | New substance formed or not; reversibility; worked examples |
| `word_equations` | Reactants → products; naming rules; no state symbols |
| `conservation_of_mass` | Atoms rearrange, none created or destroyed |
| `reaction_types` | Combustion, thermal decomposition, oxidation, electrolysis, electroplating, neutralisation |
| `acids_alkalis_ph` | pH scale, properties, common and lab examples |
| `indicators` | Litmus, universal indicator colours, pH meter, natural indicators |
| `acid_reactions` | acid+alkali, acid+carbonate, acid+metal general equations |
| `gas_tests` | Limewater for CO₂ (white precipitate); lighted splint for H₂ (pop) |

**Depth limits.** Word equations only — no balanced symbol equations required.
Specific salt names are F.Y.I.; only the three general word equations are
required. No mole calculations, no reactivity series ordering.

**High-yield traps.** Dissolving is *physical*; thermal decomposition involves
*no oxygen*; oxidation here means *addition of oxygen*, nothing about electrons.
The hydrogen test is a *lighted splint extinguished with a pop* — students
routinely write "glowing splint relights", which is the oxygen test.

---

## 2. `biology.environment`

| Sub-skill tag | Covers |
|---|---|
| `human_impact` | Carbon emissions, water waste, plastic waste, deforestation |
| `deforestation_effects` | Biodiversity loss, climate change, soil erosion — each with mechanism |
| `habitat_factors` | Air, water, temperature, light, minerals, pH; hot/cold desert vs rainforest |
| `adaptations` | Structural (born with) vs behavioural (learnt to do) |
| `ecosystem_hierarchy` | Organism → population → community → ecosystem |
| `organism_interactions` | Predator–prey, mutualism, parasitism |
| `food_chains_webs` | Arrow = direction of energy flow; sun not shown in the chain |
| `energy_flow` | ~90% lost as heat in respiration at each stage; ~10% passed on |

**Depth limits.** No nutrient cycles, no population-dynamics graphs beyond
reading a trend, no trophic-efficiency calculation beyond the 10% rule.

**High-yield traps.** Arrows point *towards the eater*. Parasitism harms but
does not usually kill the host — that is the discriminator against predation.
"Energy is lost" must be qualified as *lost as heat during respiration*.

---

## 3. `physics.forces_energy`

| Sub-skill tag | Covers |
|---|---|
| `force_effects` | Start/stop, speed up/slow down, turn, change shape, change direction |
| `contact_noncontact` | Applied, friction, air resistance, elastic vs gravitational, magnetic |
| `friction` | Opposes motion, from surface irregularities, KE → thermal energy |
| `mass_vs_weight` | Mass constant, kg, electronic balance; weight varies, N, spring balance |
| `pressure` | P = F/A; unit Pa or N/m²; area–pressure relationship |
| `work_done` | W = F × d; no work if no motion or if force ⟂ motion |
| `energy_types` | Chemical/elastic/gravitational potential, kinetic, light, electrical, thermal |
| `conservation_of_energy` | Cannot be created or destroyed; total constant; GPE ↔ KE |

**Depth limits.** `W = m × g` is stated as F.Y.I. and **calculation is not
required** — but g = 10 N/kg on Earth is used in pressure questions, so the learner
must be able to get weight in newtons when a pressure question needs it.
No KE or GPE formulas, no momentum, no moments calculation.

**High-yield traps.** Pa may only replace N/m²; if area is in cm², leave the
answer in N/cm². "Maximum pressure" means *minimum* area — this catches
almost everyone. Friction acts even when the object is stationary.

---

## 4. `physics.heat`

| Sub-skill tag | Covers |
|---|---|
| `temperature_units` | SI unit is the kelvin (K) |
| `expansion_contraction` | Particles gain energy, move further apart; spacing changes, size and number do not |
| `expansion_applications` | Railway gaps, overhead cables, bridge rollers, bimetallic strip |
| `conduction` | Vibrational motion passed particle to particle; no medium movement; metals best |
| `convection` | Physical movement of fluid due to density difference; kettle, heater, air-con placement |
| `radiation` | No medium needed; works in vacuum |
| `radiation_factors` | Colour/texture, surface area, surface temperature |
| `insulation_applications` | Vacuum flask — each feature to the transfer it blocks |

**Depth limits.** No specific heat capacity, no latent heat calculations, no
thermal conductivity values. Cooling-curve *reading* only, not calculation.

**High-yield traps.** Expansion changes *spacing*, not particle size — this
is an almost guaranteed mark. Conduction cannot occur in a vacuum because
there are no particles. Black and dull is the best absorber **and** the best
emitter; students accept the first and reject the second. Convection needs a
*density* explanation, not "hot air rises".

---

## 5. `physics.electrical`

| Sub-skill tag | Covers |
|---|---|
| `circuit_symbols` | Wire, junction, cell, battery, lamp, switch, fixed and variable resistor, ammeter, voltmeter, fuse |
| `current_in_series` | Rate of flow of charge; ampere; same everywhere in a series loop |
| `parallel_independence` | Branches are independent paths; same pd across each branch |
| `meter_connection` | Ammeter in series, voltmeter in parallel across the component |
| `potential_difference` | Energy to move one unit of charge; volt |
| `resistance_current_relationship` | Higher resistance → lower current, qualitative only |
| `effective_resistance` | Series adds; parallel falls below the smallest; two equal resistors halve |
| `current_effects` | Chemical (electroplating, electrolysis), heating (kettle, fuse), magnetic (electromagnet, motor) |
| `power_and_energy` | Power in W = J/s; kWh as a unit of energy; 1 unit = 1 kWh |
| `cost_calculation` | kW × h × price; W→kW and min→h conversions |
| `hazards_and_safety` | Damaged insulation, overloading, damp conditions |
| `fuse_and_breaker` | Fuse melts and is replaced; breaker trips and is reset; rating slightly above working current |
| `energy_conservation_home` | Lower-power alternatives, switching off, efficiency ticks |

**Depth limits — read these before writing any question.**
- **V = IR is explicitly NOT required.** The syllabus says so. Never set a
  question that needs it. Resistance–current questions are *qualitative*.
- The parallel reciprocal formula is **not** required. Two equal resistors in
  parallel halving is the only quantitative parallel case in their notes.
- Series effective resistance by addition **is** required.
- kWh cost calculation **is** required, including unit conversion.
- Conventional current direction and electron flow are not examined here.

See `references/electrical-systems.md` for the full teaching sequence.

---

## 6. `biology.digestion`

| Sub-skill tag | Covers |
|---|---|
| `nutrients` | Carbohydrates, proteins, fats — function and food examples |
| `why_digest` | Large insoluble particles → simpler soluble ones that can be absorbed |
| `physical_vs_chemical_digestion` | Mechanical, increases surface area to volume ratio, no enzymes vs enzymes |
| `enzymes` | Speed up chemical digestion; each acts on only one substance |
| `organ_functions` | Mouth, oesophagus, stomach, small intestine, large intestine, rectum, anus |
| `enzyme_products` | Carbohydrase: starch→maltose→glucose; protease: protein→amino acids; lipase: fats→fatty acids + glycerol |
| `absorption` | Small intestine (digested food + most water); large intestine (remaining water + mineral salts) |
| `villi` | Increase surface area to volume ratio; thin walls; capillary network |
| `use_of_products` | Glucose→respiration; amino acids→growth and repair; fats→storage and energy |

**Depth limits.** No enzyme rate graphs, no optimum pH/temperature curves,
no bile or pancreas detail beyond what the notes give.

**High-yield trap.** The notes contain an error worth knowing about: under
"small intestine" they say nutrients "are fully digested in the stomach".
The small intestine is the main site of chemical digestion and where digestion
is completed. If the learner quotes the notes the learner will lose the mark — correct this
explicitly.

---

## 7. `biology.transport`

| Sub-skill tag | Covers |
|---|---|
| `diffusion` | Net movement, high → low concentration; anything that is not water |
| `osmosis` | Water molecules only, through a partially permeable membrane |
| `osmosis_in_plants` | Water uptake from soil, stem firmness, turgid fruits and leaves |
| `blood_components` | Red cells, white cells, platelets, plasma — one function each |
| `blood_vessels` | Artery (away, thick wall, high pressure), vein (towards, thin wall, low pressure), capillary (one cell thick, exchange) |
| `plant_transport` | Xylem — water and mineral salts, upwards; phloem — sugar, both ways |
| `gas_exchange` | Concentration-gradient explanations at lungs, muscle, leaf, stomata |

**Depth limits.** No heart chambers or double circulation detail, no
transpiration-rate experiments, no water-potential terminology beyond what the
notes introduce.

**High-yield trap.** Every diffusion or osmosis answer needs the direction
*and* the gradient: "higher concentration of oxygen in the lungs than in the
blood, so oxygen diffuses from lungs to blood". One without the other is
half marks. Note the notes carry a typo on the diffusion diagram labels
(both sides say "higher water potential") — the right-hand side is lower.

---

## 8. `biology.reproduction`

| Sub-skill tag | Covers |
|---|---|
| `asexual_vs_sexual` | One parent, identical vs two parents, not identical |
| `puberty` | Sex hormones; changes in boys and girls |
| `male_organs` | Testis, scrotum, sperm duct, urethra, penis, sex glands |
| `female_organs` | Ovary, oviduct, uterus, uterine lining, cervix, vagina |
| `fertilisation` | Takes place in the oviduct; nuclei fuse to form a zygote |
| `implantation` | Zygote → embryo along the oviduct; implants in uterine lining |
| `heredity` | 46 chromosomes; gametes carry 23; combination of both parents |
| `menstrual_cycle` | Days 1–5 menstruation, 6–9 repair, 14 ovulation, 10–15 fertile, 16–28 thickening |
| `birth_control` | Temporary vs permanent methods and how each works |
| `stis` | Gonorrhoea, syphilis (bacteria, antibiotics); HIV (virus, no cure) |

**Depth limits.** No hormone names or feedback loops, no pregnancy stages
beyond implantation, no ethical-debate essay.

Handle this topic factually and matter-of-factly, in the same register as the
school notes. It is a biology topic with marks attached.

---

## Cross-cutting: `scientific_endeavour`

Threaded through every topic rather than examined alone: variables
(independent / dependent / controlled), fair-test design, reading and drawing
tables and graphs, sources of error, and drawing a conclusion that refers to
the data given. Tag these as `subskill: experimental_design` under whichever
topic the question sits in. Data-response questions on unfamiliar experiments
are where confident students lose marks — practise them deliberately.
