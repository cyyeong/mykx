# Critter Lab pets

Founder brief, 29 Oct 2026: the Critter Lab moves into the kid rail for every age. Kids raise pets through their real life cycles, groom them with the right care for each stage, see them move like real creatures, see them get happy, hungry, sad or cross, and talk to them. A specialist agent, the Critter Keeper, speaks as the pet and coaches its care. The life cycle stays in view, with the pet's stage marked. Built in `lib/pets`, `components/pets`, `app/api/pets`; architecture in [ARCHITECTURE.md §6.3b](../ARCHITECTURE.md).

## What a kid does

1. **Adopt** a frog (Bloop), a mealworm beetle (Crumbs), a butterfly (Flutter) or a chicken (Pebble). Each starts as eggs.
2. **Care for it, stage by stage.** Every stage shows three bars (from food, clean, love, warm) and a short list of jobs to grow:
   - **Feed** from the habitat's tray of four foods. Only the right food for the stage is eaten; a wrong one is turned down with the reason (a tadpole has no legs to catch flies; a pupa doesn't eat).
   - **Clean** by rubbing the dirty spots away; **Play** by moving a finger for the pet to follow; **Warm** under the lamp or the sun.
   - **The stage's own job**, taught by doing: add a rock so the froglet can leave the water, watch the mealworm moult, let the pupa or chrysalis rest, turn the egg, let the chick hatch by itself.
3. **Watch it grow.** When the jobs are done and every bar is at least halfway, it grows into the next stage on screen, and the life-cycle track moves on. An adult lays eggs and a new generation starts: the cycle closes.
4. **Talk to it.** The Critter Keeper answers as the pet at its stage, true to its science, and says what it needs when asked.

## Rules

- **Deterministic and gentle.** Bars run down by the hour; the mood follows them. A pet never gets sick, dies or shrinks, and a stage once reached is kept. A full bar takes no more of the same care, so growing takes real time, not tapping. Growth never comes from chance and never touches mastery or rewards (rule 5).
- **Education first.** Stages, foods and jobs follow the P3 Science life cycles (`lib/critters/catalog.ts`). The track shows all four stages, where the pet is, what this stage is like and what changes next.
- **Safety and privacy.** The Critter Keeper sees only the pet's facts and the child's words (Standard model). Distress words skip it: Kix's caring reply, the helplines, and an urgent flag for the parent (rule 12). Other chats aren't stored and never feed mood readings. Without a model, a cached reply answers (rule 7).
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
