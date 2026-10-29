# Sec 2 G3 Science syllabus map

Source: school summary notes, checked line by line against the MOE *Science
Syllabus, Lower Secondary, General 2 Course / General 3 Course* (2024 edition;
details and outcome codes in the first section below). G2 and G3 share one
syllabus document; outcomes marked **(G3)** are optional for G2 and required
for G3.

**Use the exact `topic` and `subskill` tags below (they are in `skill.json`).** Inconsistent tags make the statistics meaningless.

The **depth limits** are as important as the content. Teaching above them
burns attention the learner cannot spare; teaching below them loses marks.

---

## Source document and outcome codes

**Document:** *Science Syllabus, Lower Secondary, General 2 Course, General 3
Course*, Curriculum Planning and Development Division, Ministry of Education.
Implementation starting with the 2021 Secondary One cohort; © 2024 (the April
2024 edition, written for Full Subject-Based Banding, where G2 and G3 replace
the old Normal (Academic) and Express labels). MOE lists it as "2023 G2/G3
Lower Secondary Science Syllabuses" on its Full SBB syllabus page:
https://www.moe.gov.sg/media/files/secondary/syllabuses/science/b6d63789-2ad0-4630-b847-42fd380ec404.pdf
(checked in October 2026; the file on the site was generated in January 2026).

**Which topics are Sec 2.** The syllabus has 16 topics in five themes and does
not split them by year. This pack covers the eight Interactions and Systems
topics that schools teach in Sec 2: MOE Topics 9 to 16. Topics 1 to 8
(Scientific Endeavour, Diversity, Models) are usually taught in Sec 1 and are not in this
pack.

| Pack topic | MOE topic |
|---|---|
| `chemistry.chemical_changes` | 11. Chemical Changes |
| `biology.environment` | 12. Interactions within Ecosystems |
| `physics.forces_energy` | 9. Application of Forces and Transfer of Energy |
| `physics.heat` | 10. Transfer of Heat Energy and its Effects |
| `physics.electrical` | 13. Electrical Systems |
| `biology.digestion` | 14. Human Digestive System |
| `biology.transport` | 15. Transport Systems in Living Things |
| `biology.reproduction` | 16. Human Sexual Reproductive System |

**Outcome codes.** MOE does not number its learning outcomes. In this pack,
`11.4` means the fourth outcome listed under Topic 11, reading the Core Ideas,
Practices and Values columns in the order they appear. Each topic section
below lists its codes in short paraphrase (the syllabus has the full wording),
and every item in `items/original-*.json` names the codes it assesses in its
`notes`. Values outcomes (marked *values*) are for discussion; they are not
item-tested except where a question about the environment draws on them.

**No national exam.** Lower secondary science is assessed by schools; SEAB
does not set a paper for it. The assessment section of the syllabus asks for
end-of-year papers that sample the whole syllabus at a suitable difficulty;
see `references/exam-blueprint.md` for the usual school format.

**What could not be checked.** The 2021 first edition is no longer on the MOE
site, so the content changes made in 2024 could not be listed line by line.
Everything in this map follows the 2024 edition.

---

## 1. `chemistry.chemical_changes`

| Sub-skill tag | Covers | MOE outcomes |
|---|---|---|
| `physical_vs_chemical` | New substance formed or not; reversibility; worked examples | 11.1 |
| `word_equations` | Reactants → products; naming rules; no state symbols | 11.2 |
| `conservation_of_mass` | Atoms rearrange, none created or destroyed; open vs closed containers | 11.3, 11.4 |
| `reaction_types` | Combustion, thermal decomposition, oxidation (rusting, cellular respiration), neutralisation; changes on mixing, heating, exposure to light (photosynthesis), contact with oxygen, and an electric current (electroplating) | 11.5, 11.8 |
| `acids_alkalis_ph` | pH scale, properties, common and lab examples | 11.6, 11.7 |
| `indicators` | Litmus, Universal Indicator colours, pH meter, natural indicators made from plants (red cabbage, blue pea flower) | 11.7 |
| `acid_reactions` | acid + alkali; acid + metal (G3); acid + carbonate (G3) | 11.6 |
| `gas_tests` | Limewater for CO₂ (white precipitate); lighted splint for H₂ (pop): how the gases in 11.6 are identified | 11.6 |

### MOE learning outcomes (Topic 11)

- 11.1 A change that forms new substance(s) is a chemical change.
- 11.2 Word equations represent chemical reactions (chemical equations are not required).
- 11.3 Reactions rearrange atoms; atoms are not created or destroyed.
- 11.4 Mass is conserved in a chemical reaction.
- 11.5 Types of chemical change: combustion, thermal decomposition, oxidation (rusting, cellular respiration), neutralisation.
- 11.6 Investigate reactions of acids with alkalis, with metals (G3) and with carbonates (G3).
- 11.7 Investigate the effect of acidic, alkaline and neutral solutions on indicators: litmus, Universal Indicator and natural plant indicators.
- 11.8 Investigate chemical changes on mixing, heating, exposure to light, contact with oxygen and (G3) passing an electric current (electroplating).
- 11.9 *Values:* how reactions benefit us (cooking, respiration) and harm health and the environment (rusting, decay, burning).

**Depth limits.** Word equations only — chemical (symbol) equations are not
required (MOE note to 11.2). Specific salt names are F.Y.I.; only the three
general word equations are required. No mole calculations, no reactivity
series ordering. Electroplating is only an example of a visible change: the
anode, the cathode and the reactivity series are not required (MOE note to
11.8). Electrolysis as a named process is not in the MOE outcomes.

**High-yield traps.** Dissolving is *physical*; thermal decomposition involves
*no oxygen*; oxidation here means *addition of oxygen*, nothing about electrons.
The hydrogen test is a *lighted splint extinguished with a pop* — students
routinely write "glowing splint relights", which is the oxygen test. In an
*open* container the balance reading falls when a gas escapes, even though mass
is conserved.

---

## 2. `biology.environment`

| Sub-skill tag | Covers | MOE outcomes |
|---|---|---|
| `human_impact` | Carbon emissions, water waste, plastic waste, motor vehicles and modern lifestyles | 12.1, 12.9 |
| `deforestation_effects` | Biodiversity loss, climate change, soil erosion — each with mechanism | 12.9 (with 10.10) |
| `habitat_factors` | Air, water, temperature, light, minerals, acidity/alkalinity; hot/cold desert vs rainforest | 12.2 |
| `adaptations` | Structural (a feature it has) vs behavioural (something it does); changes in conditions affect survival | 12.3 |
| `ecosystem_hierarchy` | Organism → population → community → ecosystem (a community and its physical environment) | 12.4 |
| `organism_interactions` | Predator–prey, mutualism, parasitism | 12.5 |
| `food_chains_webs` | Arrow = direction of energy flow; sun not shown in the chain | 12.6 |
| `energy_flow` | Photosynthesis brings energy in; much is lost as heat in respiration at each level | 12.6 |
| `decomposers` | Bacteria and fungi break down dead matter and return nutrients (mineral salts) to the soil (G3) | 12.7 |

### MOE learning outcomes (Topic 12)

- 12.1 Why conserving the environment matters.
- 12.2 Why physical factors (air, water, temperature, light, minerals, acidity/alkalinity) matter to survival.
- 12.3 How adaptive traits (structural and behavioural) and changing conditions affect survival.
- 12.4 An ecosystem is the interaction between a community and its physical environment.
- 12.5 Relationships in a community: predator–prey, mutualism, parasitism.
- 12.6 Energy flows through food chains and webs; photosynthesis and respiration are involved.
- 12.7 (G3) Decomposers recycle nutrients within the environment.
- 12.8 (G3) Investigate an environment with a data logger and probes (pH, temperature, light intensity).
- 12.9 Evaluate the impact of human activities and technology on the environment.
- 12.10 *Values* (G3): how some cultures live sustainably.

**Depth limits.** Decomposers returning nutrients to the soil (12.7) **is
required for G3**; named nutrient cycles (carbon, nitrogen) are not. No
population-dynamics graphs beyond reading a trend. The "about 10% passed on"
figure comes from school notes, not from the MOE outcomes: use it to read data
given in a question, and do not set calculations that depend on it.

**High-yield traps.** Arrows point *towards the eater*. Parasitism harms but
does not usually kill the host — that is the discriminator against predation.
"Energy is lost" must be qualified as *lost as heat during respiration*.
Nutrients are recycled; energy is not.

---

## 3. `physics.forces_energy`

| Sub-skill tag | Covers | MOE outcomes |
|---|---|---|
| `force_effects` | Start/stop, speed up/slow down, change direction, change shape or size, turning effects (spanners, levers) | 9.2 |
| `contact_noncontact` | Contact: applied, friction, air resistance; non-contact: gravitational, magnetic | 9.1 |
| `friction` | Opposes motion, from surface irregularities, KE → thermal energy | 9.1, 9.2 |
| `mass_vs_weight` | Mass constant, kg, electronic balance; weight varies, N, spring balance | 9.6, 9.7 |
| `pressure` | P = F/A (G3); unit Pa or N/m²; area–pressure relationship; atmospheric pressure (suction cups, straws) and liquid pressure (submarine depth limits) (G3) | 9.2, 9.3, 9.8 |
| `work_done` | Work is done when an object moves in the direction of a force (G3); joule | 9.4, 9.5 |
| `energy_types` | Chemical/elastic/gravitational potential, kinetic, light, electrical, thermal, sound; conversions | 9.9 |
| `conservation_of_energy` | Cannot be created or destroyed; total constant; GPE ↔ KE | 9.10 |
| `energy_sources` | Fossil fuels, solar, hydroelectric, wind, geothermal, biofuels, nuclear: uses and impact on the environment | 9.12 |

### MOE learning outcomes (Topic 9)

- 9.1 A force can be a contact force (friction) or a non-contact force (magnetic, gravitational).
- 9.2 Interactions transfer energy and, through forces, change an object's rest or motion, turning, size or shape, and the pressure on it.
- 9.3 (G3) Everyday pressure: high heels, knife edges; atmospheric pressure (suction cups, straws); liquid pressure (submarine depth limits).
- 9.4 The joule is the SI unit of energy and (G3) of work.
- 9.5 (G3) Work is done, as an energy transfer, when an object moves in the direction of a force.
- 9.6 Measure force in newtons.
- 9.7 Compare weight and mass.
- 9.8 (G3) Investigate pressure with pressure = force / area.
- 9.9 Energy can be converted from one form to another.
- 9.10 Energy cannot be created or destroyed; it is conserved when transferred or converted.
- 9.11 *Values:* the destructive power of forces in nature (earthquakes, tsunamis, eruptions, tropical cyclones).
- 9.12 *Values:* uses of energy sources and their impact on the environment.

**Depth limits.** `W = m × g` is stated as F.Y.I. and **calculation is not
required** — but g = 10 N/kg on Earth is used in pressure questions, so the learner
must be able to get weight in newtons when a pressure question needs it.
No KE or GPE formulas, no momentum, no moments calculation (turning effects
are qualitative). The MOE work outcome (9.5) is qualitative; `W = F × d`
calculations appear in many school notes but not in the syllabus, so set them
only when the learner's school uses them.

**High-yield traps.** Pa may only replace N/m²; if area is in cm², leave the
answer in N/cm². "Maximum pressure" means *minimum* area — this catches
almost everyone. Friction acts even when the object is stationary. No work is
done on an object that does not move, or that moves at right angles to the
force.

---

## 4. `physics.heat`

| Sub-skill tag | Covers | MOE outcomes |
|---|---|---|
| `temperature_units` | SI unit is the kelvin (K) | 10.1 |
| `expansion_contraction` | Particles gain energy, move further apart; spacing changes, size and number do not; volume up, so density down | 10.7, 10.8 |
| `expansion_applications` | Railway gaps, overhead cables, bridge rollers, bimetallic strip | 10.2 |
| `conduction` | Vibrational motion passed particle to particle; no medium movement; metals best; materials differ in rate | 10.3, 10.9 |
| `convection` | Physical movement of fluid due to density difference; kettle, heater, air-con placement | 10.3, 10.5, 10.8 |
| `radiation` | No medium needed; works in vacuum; radiant heaters, solar radiation | 10.3, 10.6 |
| `radiation_factors` | Colour and texture of the surface; surface temperature | 10.4 |
| `insulation_applications` | Vacuum flask — each feature to the transfer it blocks | 10.5 |

### MOE learning outcomes (Topic 10)

- 10.1 The SI unit of temperature is the kelvin (K).
- 10.2 Effects and applications of expansion and contraction in everyday life.
- 10.3 Explain heat transfer by conduction, convection and radiation.
- 10.4 The rate of heat loss or gain by radiation depends on (i) the colour and texture of the surface and (ii) the surface temperature.
- 10.5 Applications of conduction and convection in cooling, heating and insulation.
- 10.6 Applications of radiation (radiant heaters, solar radiation).
- 10.7 Solids, liquids and gases generally expand when they absorb heat and contract when they give it out.
- 10.8 Thermal expansion changes volume, and therefore density.
- 10.9 Different materials transfer heat at different rates (from experiments).
- 10.10 *Values:* proposed man-made and natural causes of climate change.

**Depth limits.** No specific heat capacity, no latent heat calculations, no
thermal conductivity values. Cooling-curve *reading* only, not calculation.
Surface *area* as a factor in radiation is in some school notes but not in the
MOE outcome (10.4); keep radiation questions to colour, texture and surface
temperature.

**High-yield traps.** Expansion changes *spacing*, not particle size — this
is an almost guaranteed mark. Conduction cannot occur in a vacuum because
there are no particles. Black and dull is the best absorber **and** the best
emitter; students accept the first and reject the second. Convection needs a
*density* explanation, not "hot air rises". "Cold" does not flow; heat does.

---

## 5. `physics.electrical`

| Sub-skill tag | Covers | MOE outcomes |
|---|---|---|
| `circuit_symbols` | Wire, junction, cell, battery, lamp, switch, fixed and variable resistor, ammeter, voltmeter, fuse | 13.6 |
| `current_in_series` | Rate of flow of charge; ampere; same everywhere in a series loop | 13.1, 13.7 |
| `parallel_independence` | Branches are independent paths; same pd across each branch | 13.7 |
| `meter_connection` | Ammeter in series, voltmeter in parallel across the component | 13.6 |
| `potential_difference` | Energy to move one unit of charge; volt | 13.1 |
| `resistance_current_relationship` | Higher resistance → lower current, qualitative only | 13.8 |
| `effective_resistance` | Series adds; parallel falls below the smallest; two equal resistors halve | 13.7 |
| `current_effects` | Chemical (electroplating, electrolysis), heating (kettle, fuse), magnetic (electromagnet, motor) | 13.2 |
| `power_and_energy` | Power in W = J/s; kWh as a unit of energy; 1 unit = 1 kWh | 13.5, 13.9 |
| `cost_calculation` | kW × h × price; W→kW and min→h conversions | 13.9 |
| `hazards_and_safety` | Damaged insulation, overloading, damp conditions | 13.3, 13.4 |
| `fuse_and_breaker` | Fuse melts and is replaced; breaker trips and is reset; rating slightly above working current | 13.4 |
| `energy_conservation_home` | Lower-power alternatives, switching off, efficiency ticks | 13.10 |

### MOE learning outcomes (Topic 13)

- 13.1 Describe current, potential difference and resistance, with their SI units.
- 13.2 Applications of the chemical, heating and magnetic effects of a current.
- 13.3 How changes to an electrical system can cause hazards.
- 13.4 Precautions for the safe use of electricity at home.
- 13.5 Power: what it means, its link to an output, its SI unit.
- 13.6 Draw and interpret circuit diagrams; set up circuits with sources, switches, lamps, fixed and variable resistors, ammeters and voltmeters.
- 13.7 (G3) Investigate how series and parallel arrangements of fixed resistors affect the current.
- 13.8 (G3) Investigate how varying resistance affects the current (V = IR is not required).
- 13.9 (G3) Calculate the cost of using appliances, with the kilowatt-hour.
- 13.10 *Values:* ways to reduce electrical energy use at home.

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

| Sub-skill tag | Covers | MOE outcomes |
|---|---|---|
| `nutrients` | Carbohydrates, proteins, fats — function and food examples | 14.3, 14.4 |
| `why_digest` | Large insoluble particles → simpler soluble ones that can be absorbed | 14.1, 14.3 |
| `physical_vs_chemical_digestion` | Mechanical, increases surface area to volume ratio, no enzymes vs enzymes | 14.3 |
| `enzymes` | Speed up chemical digestion; each acts on only one substance; classes only (G3) | 14.5 |
| `organ_functions` | Mouth, gullet (oesophagus), stomach, small intestine, large intestine, rectum, anus | 14.2 |
| `enzyme_products` | Carbohydrase: starch→maltose→glucose; protease: protein→amino acids; lipase: fats→fatty acids + glycerol (G3) | 14.5 |
| `absorption` | Small intestine (digested food + most water); large intestine (remaining water + mineral salts) | 14.2, 14.3 |
| `villi` | Increase surface area to volume ratio; thin walls; capillary network | 14.2 |
| `use_of_products` | Glucose→respiration; amino acids→growth and repair; fats→storage and energy (G3) | 14.4 |

### MOE learning outcomes (Topic 14)

- 14.1 Why the digestive system matters.
- 14.2 How the main parts (mouth, gullet, stomach, small intestine, large intestine, rectum, anus) work together.
- 14.3 How the digestive system digests food.
- 14.4 (G3) The end products of digestion are used for respiration, growth and tissue repair.
- 14.5 (G3) Investigate the effect of enzymes in digestion: classes only (carbohydrases, proteases, lipases); specific enzyme names are not required.
- 14.6 *Values:* sensible food and lifestyle choices against diabetes.
- 14.7 *Values:* bacteria can help digestion or cause infections.

**Depth limits.** Enzyme *classes* only: names such as amylase or pepsin are
not required (MOE note to 14.5). No enzyme rate graphs, no optimum
pH/temperature curves, no bile or pancreas detail beyond what the notes give.
Villi are not named in the MOE outcomes; they are school-notes detail of how
the small intestine absorbs (14.2), so keep to surface area, the thin wall and
the capillaries.

**High-yield trap.** The notes contain an error worth knowing about: under
"small intestine" they say nutrients "are fully digested in the stomach".
The small intestine is the main site of chemical digestion and where digestion
is completed. If the learner quotes the notes the learner will lose the mark — correct this
explicitly.

---

## 7. `biology.transport`

| Sub-skill tag | Covers | MOE outcomes |
|---|---|---|
| `diffusion` | Net movement, high → low concentration; digested food and oxygen from blood to tissues | 15.4, 15.5 |
| `osmosis` | Water molecules only, through a partially permeable membrane (G3) | 15.6 |
| `osmosis_in_plants` | Water uptake by root hair cells from the soil (G3); wilting when soil water is too concentrated | 15.6 |
| `blood_vessels` | Artery (away from the heart), vein (towards the heart), capillary (site of exchange) — functions only | 15.1 |
| `plant_transport` | Xylem — water and mineral salts from the roots upwards; phloem — food from the leaves to other parts (G3); the dye-in-stem investigation | 15.2, 15.7 |
| `gas_exchange` | Concentration-gradient explanations at lungs, muscle, leaf, stomata | 15.4, 15.5 |
| `transport_need` | Why large multicellular organisms need a transport system: diffusion alone is too slow over long distances (G3) | 15.3 |

### MOE learning outcomes (Topic 15)

- 15.1 Functions of blood vessels: arteries carry blood away from the heart, veins towards it, capillaries are the site of exchange (structures of the vessels and the heart are not required).
- 15.2 (G3) Xylem transports water and mineral salts from the roots to other parts; phloem transports food from the leaves to other parts.
- 15.3 (G3) Explain the need for a transport system in multicellular organisms.
- 15.4 How diffusion helps transport in humans (digested food and oxygen from blood to tissues).
- 15.5 How diffusion helps transport in plants (gases and mineral salts into and out of cells).
- 15.6 (G3) Osmosis helps the roots absorb water.
- 15.7 (G3) Infer from an investigation that the xylem transports water and mineral salts.
- 15.8 *Values:* drug abuse harms many body systems, including transport.
- 15.9 *Values:* ethical issues in heart transplants.

**Depth limits.** Blood vessel **structures** (wall thickness, valves) and the
heart's structure are **not required** (MOE note to 15.1): ask about function
and direction. Blood components (red cells, white cells, platelets, plasma)
are not in the MOE outcomes, so this pack has no subskill or items for them.
No double circulation, no transpiration-rate experiments, no water-potential
terminology beyond what the notes introduce.

**High-yield trap.** Every diffusion or osmosis answer needs the direction
*and* the gradient: "higher concentration of oxygen in the blood than in the
muscle cells, so oxygen diffuses from the blood into the cells". One without the other is
half marks. Note the notes carry a typo on the diffusion diagram labels
(both sides say "higher water potential") — the right-hand side is lower.

---

## 8. `biology.reproduction`

| Sub-skill tag | Covers | MOE outcomes |
|---|---|---|
| `puberty` | Sex hormones; changes in boys and girls (hormonal system details not required) | 16.4 |
| `male_organs` | Testis, scrotum, sperm duct, urethra, penis, sex glands | 16.5 |
| `female_organs` | Ovary, oviduct, uterus, uterine lining, cervix, vagina | 16.5, 16.6 |
| `fertilisation` | Takes place in the oviduct; nuclei fuse to form a fertilised egg (zygote) | 16.1, 16.5 |
| `implantation` | Fertilised egg → embryo along the oviduct; becomes embedded in the uterine lining | 16.1, 16.6 |
| `heredity` | Genetic information from both parents; each child a unique combination (G3) | 16.2, 16.3 |
| `menstrual_cycle` | Days 1–5 menstruation, 6–9 repair, 14 ovulation, 10–15 fertile, 16–28 thickening | 16.6 |
| `birth_control` | Temporary vs permanent methods and how each works | 16.10 |
| `stis` | Gonorrhoea, syphilis (bacteria, antibiotics); AIDS, caused by HIV (virus, no cure) | 16.11, 16.12 |
| `population_growth` | Reasons for the world's growing population: advances in medicine, improved sanitation (G3) | 16.9 |

### MOE learning outcomes (Topic 16)

- 16.1 The nuclei of an egg and a sperm unite to form a fertilised egg, which develops into a new individual.
- 16.2 The sexual reproductive system makes heredity possible.
- 16.3 (G3) A new individual receives a unique combination of genetic information from the mother (egg) and the father (sperm): similarities and differences with parents and among siblings.
- 16.4 Physical changes in puberty and early adolescence, caused by hormones (hormonal system details not required).
- 16.5 How the parts of the male and female systems are involved in fertilisation.
- 16.6 How parts of the female system are involved in the menstrual cycle.
- 16.7 *Values:* consequences and issues of abortion and pre-marital sex.
- 16.8 *Values:* smoking, alcohol and drug abuse can harm the foetus.
- 16.9 (G3) Reasons for the world's growing human population (advances in medicine, improved sanitation).
- 16.10 How temporary and permanent birth control methods prevent conception.
- 16.11 Harmful consequences of STIs such as syphilis, gonorrhoea and AIDS.
- 16.12 Some bacterial STIs can be cured with antibiotics; viral STIs cannot.

**Depth limits.** No hormone names or feedback loops, no pregnancy stages
beyond implantation, no ethical-debate essay. Chromosome numbers (46, 23) are
in school notes but not in the MOE outcomes: the required idea is a unique
combination of genetic information from both parents. Asexual reproduction is
not part of this topic in the MOE syllabus, so it has no subskill here.

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
