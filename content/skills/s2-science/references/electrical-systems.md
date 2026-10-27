# Electrical systems: misconceptions, ladder, model answers

Electrical systems is where many Sec 2 students lose the most marks, and it is a good place to start
because it is unusually *fixable*: almost all of the difficulty is three
misconceptions and one piece of diagram literacy, not a large body of facts.

**Before anything else: V = IR is not in this syllabus.** If the learner is struggling
because someone has been trying to teach the learner Ohm's law, remove it. The
syllabus asks for the qualitative relationship only. Taking the formula away
usually produces immediate relief.

---

## The three misconceptions, in the order to kill them

### 1. "Current gets used up as it goes round"

This is the big one. It sits underneath wrong answers on series readings,
brightness comparisons, and ammeter placement, and a student can hold it for
years while appearing to know the topic.

**Diagnose it:** show a series circuit with two lamps and ammeters before and
after. If the learner says the second reading is smaller, this is the problem.

**Fix it with the bicycle chain.** The chain is a loop. When you pedal, every
link moves at once — the link at the back moves the same instant as the link
at the front. Nothing about the chain is consumed. What *is* consumed is your
energy, which the chain transfers to the wheel.

> Charge is the chain. Energy is what gets transferred. Current is how fast
> the chain is moving, and it is the same all the way round a single loop.

Then make the learner say it back, in their words, with their hands moving in a loop.

**Confirm the fix:** ask "does the lamp nearer the battery light more
brightly?" (No — same current, identical lamps, same brightness.) Students
who have genuinely fixed this answer instantly.

### 2. "Parallel branches affect each other"

Shows up as: remove one lamp, the learner says the other dims or brightens.

**Fix it with lanes on an expressway.** Each branch is its own lane from the
same entry point to the same exit. Closing one lane does not change what
happens in the other lane — the cars in the open lane still have the same
push. Adding a lane makes the whole road easier to flow through, so *total*
resistance falls and *total* current rises.

The two consequences students mix up:
- **Per branch:** each branch has the full pd of the supply across it, and is
  unaffected by what the other branches do.
- **Whole circuit:** more branches → lower effective resistance → more total
  current drawn from the supply.

Both are true at once. Teach them as two separate sentences and label which
is which, because the exam asks for one or the other and rewards precision.

### 3. "Voltage flows"

Shows up in phrasing rather than in multiple choice: "the voltage flows
through the lamp", "the current across the resistor".

**Fix it with prepositions.** Drill the grammar directly, it is faster than
explaining the physics again:

> Current flows **through**. Potential difference is **across**.

Never let a wrong preposition pass uncorrected, even in conversation. The
exam mark scheme is written in this grammar, and a student who says "voltage
through" writes "voltage through" under pressure.

---

## The diagram literacy problem

Separate from the misconceptions, and often the real blocker: the learner cannot
reliably read a circuit diagram. Test it before assuming the physics is wrong.

**The finger-trace drill.** Give the learner a circuit. The learner puts a finger on the
positive terminal and traces the loop out loud: "cell, wire, lamp one, wire,
ammeter, wire, back to the cell." Two questions follow:

1. *Is this one loop or more than one?* (branch point = junction dot)
2. *Which components are on the same loop as each other?*

Once the learner can answer those two questions for any diagram, most of the topic
follows. Do this drill at the start of every electrical session for a week —
it takes 60 seconds and it is the highest-return minute available.

**Symbols to overlearn** (they are on p.28 of their notes): cell vs battery,
fixed vs variable resistor, ammeter vs voltmeter, open vs closed switch,
junction dot vs wires crossing without joining. Get these to instant
recognition — a symbol the learner has to think about consumes working memory the learner needs
for the actual question.

---

## Diagnostic ladder

Work up. Stop at the first failure; that is the rung to teach.

| # | Sub-skill | R1 Recall | R2 Apply | R3 Explain |
|---|---|---|---|---|
| 1 | `circuit_symbols` | Name this symbol | Draw a circuit from a description | Spot the error in a drawn circuit |
| 2 | `current_in_series` | Unit of current? | A1 reads 0.4 A, what does A2 read? | Explain why both ammeters read the same |
| 3 | `meter_connection` | Where does an ammeter go? | Mark where the voltmeter belongs | Explain why a voltmeter must be in parallel |
| 4 | `resistance_current_relationship` | Unit of resistance? | Resistance up — current does what? | Explain the effect on lamp brightness |
| 5 | `parallel_independence` | Two paths or one? | Open S2 — what happens to P? | Explain why P is unaffected |
| 6 | `effective_resistance` | Two 10 Ω in series =? | Which arrangement draws more current? | Explain why parallel draws more |
| 7 | `current_effects` | Name the three effects | Which effect does a fuse use? | Explain how an electromagnet works |
| 8 | `power_and_energy` | What is a kWh? | Convert 2300 W and 30 min | Explain why the kettle costs less than the air-con |
| 9 | `cost_calculation` | Formula for cost? | Full calculation with conversion | Justify an energy-saving suggestion |
| 10 | `hazards_and_safety` | Name two hazards | Spot them in a picture | Explain the mechanism of each |
| 11 | `fuse_and_breaker` | Fuse rating rule? | Choose a rating for 4.2 A | Explain why too high is dangerous |

---

## Model answers — the exact phrasing that scores

Make the learner write these out, then reproduce them from memory a day later.

**Why is the current the same at every point in a series circuit? [2]**
> There is only one path for the current to flow. Charge is not used up by
> the components, so the same current passes through every component.

**Why must an ammeter be connected in series? [1]**
> So that all the current being measured passes through it.

**Why must a voltmeter be connected in parallel? [1]**
> So that it measures the potential difference across the component, between
> the two points on either side of it.

**One branch of a parallel circuit is switched off. Explain why the lamp in the other branch is unaffected. [2]**
> Each branch is a separate path across the same supply. The potential
> difference across the remaining lamp is unchanged, so the current through it
> and its brightness are unchanged.

**Explain why more current flows when two resistors are in parallel rather than in series. [2]**
> In parallel there is more than one path for the current, so the effective
> resistance of the circuit is lower than either resistor alone. A lower
> resistance allows a larger current to flow from the supply.

**Why should the fuse rating be slightly higher than the working current? [2]**
> If it were lower, the fuse would melt during normal use and the appliance
> could not be switched on. If it were much higher, a dangerously large fault
> current could flow without melting the fuse.

**Why is a shock worse with wet hands? [2]**
> Wet skin has a much lower resistance than dry skin, so a larger current
> flows through the body.

**Why is overloading a socket dangerous? [2]**
> Too many appliances on one socket draw a very large current. Because of the
> heating effect of the current, the wires overheat and can start a fire.

**Advantage of a circuit breaker over a fuse. [1]**
> A circuit breaker can be reset and reused, whereas a blown fuse must be
> replaced.

**Why is the effective resistance lower in parallel? (common follow-up)**
> Adding another branch gives the current an extra path, which makes it easier
> overall for charge to flow.

---

## The kWh calculation, step by step

The learner will meet this every year from now on, so build the habit properly.

```
Given: air-conditioner 1200 W, 6 hours a night, 30 nights, $0.32 per kWh

1. power in kW        1200 W ÷ 1000 = 1.2 kW        <- the step people skip
2. time in hours      6 x 30 = 180 h
3. energy in kWh      1.2 x 180 = 216 kWh
4. cost               216 x 0.32 = $69.12
```

**The two traps:** forgetting ÷1000 (answer comes out 1000× too big, and the learner
should notice a $69,000 electricity bill is absurd), and leaving time in
minutes. Teach the sanity check: *is this a believable amount of money?*

---

## Session sequence for this topic

Roughly one short block each, in this order. Do not move on until the rung
below is at 80%.

1. Finger-trace drill + symbol recognition
2. Current in series (bicycle chain)
3. Meter connection (through / across grammar)
4. Resistance and current, qualitative
5. Parallel independence (expressway lanes)
6. Effective resistance, both arrangements
7. Effects of current — three effects, three homes
8. Power, kWh, cost calculation
9. Hazards, fuses, circuit breakers
10. Mixed set: the pack's electrical practice set (`items/set-electrical-01.json`)

The seeded practice set covers all of these and is tagged by sub-skill, so
the results feed the learner record and show which rungs still need work.
