# Critter Lab pets

Founder brief, 29 Oct 2026: the Critter Lab moves into the kid rail for every age. Kids raise pets through their real life cycles, groom them with the right care for each stage, see them move like real creatures, see them get happy, hungry, sad or cross, and talk to them. A specialist agent, the Critter Keeper, speaks as the pet and coaches its care. The life cycle stays in view, with the pet's stage marked. Built in `lib/pets`, `components/pets`, `app/api/pets`; architecture in [ARCHITECTURE.md §6.3b](../ARCHITECTURE.md); shown in the README's Critter Lab section (`docs/readme/pets.webp`, board ReadmePets, and the recording `docs/readme/pets-grow.webp`).

## What a kid does

1. **Adopt** a frog (Bloop), a mealworm beetle (Crumbs), a butterfly (Flutter) or a chicken (Pebble). Each starts as eggs.
2. **Care for it, stage by stage.** Every stage shows three bars (from food, clean, love, warm) and a short list of jobs to grow:
   - **Feed** from the habitat's tray of four foods. Only the right food for the stage is eaten; a wrong one is turned down with the reason (a tadpole has no legs to catch flies; a pupa doesn't eat).
   - **Clean** by rubbing the dirty spots away; **Play** by moving a finger for the pet to follow; **Warm** under the lamp or the sun.
   - **The stage's own job**, taught by doing: add a rock so the froglet can leave the water, watch the mealworm moult, let the pupa or chrysalis rest, turn the egg, let the chick hatch by itself.
3. **Watch it grow.** When the jobs are done and every bar is at least halfway, it grows into the next stage on screen with a celebration that says what the new stage can do ("Bloop grew into a froglet! Froglet: grows legs; the tail gets shorter"), and the life-cycle track moves on. An adult lays eggs and a new generation starts: the cycle closes.
4. **Talk to it.** The Critter Keeper answers as the pet at its stage, true to its science, and says what it needs when asked.
5. **Touch it, and its home** (founder, 30 Oct). A tap on the pet gets its stage's own reaction and a different line each time: a tadpole darts off, a frog hops, a caterpillar curls up, an egg wobbles, a chrysalis swings; four quick taps get "Gently, please! I'm only small." Press and drag picks it up (it lifts and dangles) and carries it, but only inside the part of the habitat its stage lives in: past the edge it stretches back, and let go out there it settles home and says why ("Frogspawn has to stay in the water, or the eggs dry out"). The habitat's plants, water, rocks, bran, straw, lamp and sunlight are touchable too: that patch of the picture sways, rocks, ripples or glows, with bubbles, puffs, petals or warm light where the finger landed, a one-line life-cycle fact, a synthesised sound, and the pet turns and heads that way. A soft ring around the pet, a sparkle that visits the parts not yet touched, and a "Tap or drag" chip show it can be touched, and fade once the kid has (remembered on the device only). Touching never changes the bars, the mood or the stage.

## Rules

- **Deterministic and gentle.** Bars run down by the hour; the mood follows them. A pet never gets sick, dies or shrinks, and a stage once reached is kept. A full bar takes no more of the same care, so growing takes real time, not tapping. Growth never comes from chance and never touches mastery or rewards (rule 5).
- **Education first.** Stages, foods and jobs follow the P3 Science life cycles (`lib/critters/catalog.ts`). The track shows all four stages, where the pet is, what this stage is like and what changes next.
- **Safety and privacy.** The Critter Keeper sees only the pet's facts and the child's words (Standard model). Distress words skip it: Kix's caring reply, the helplines, and an urgent flag for the parent (rule 12). Other chats aren't stored and never feed mood readings. Without a model, a cached reply answers (rule 7).
- **Touch is play, not care.** Taps and drags animate and teach; they never change bars, mood, stage or rewards. The touchable parts and their facts are data (`SPOTS` in `components/pets/habitats.ts`, boxes measured on the habitat art); the lines are in `components/pets/touch.ts`. Every part is a real button with a label ("Touch the lily pads"), so a keyboard reaches the facts too.
- **Original art.** Stage sprites are Muse Image edits of the life-cycle sheets, cut out with SAM 3.1; foods and habitats are Muse Image renders (`public/art/manifest.json`).

## Stages and care

| Pet | Stages | Eats | Special jobs |
|---|---|---|---|
| Frog | frogspawn → tadpole → froglet → frog | tadpole: algae, boiled lettuce; froglet: fruit flies; frog: crickets, flies | froglet: add a rock; frog: lay frogspawn |
| Mealworm beetle | eggs → mealworm → pupa → beetle | mealworm and beetle: bran, carrot, apple | mealworm: moult; pupa: rest; beetle: lay eggs |
| Butterfly | eggs → caterpillar → chrysalis → butterfly | caterpillar: leaves; butterfly: nectar | eggs: keep the leaf fresh; chrysalis: rest; butterfly: lay eggs on a leaf |
| Chicken | egg → hatching → chick → hen | chick: crumbs; hen: corn, greens | egg: turn it; hatching: let it hatch alone; hen: lay an egg |

## Not yet

A parent's view of the pets, naming a pet, and Treasure cards for a completed life cycle.
