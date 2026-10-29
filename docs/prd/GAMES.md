# Game Arcade (proposed): learning games, starting with typing

**Written:** Tue 27 Oct 2026 (Day 1), from the founder's request. **Status:** design for review ([myKx Screens](https://claude.ai/artifact/8crEyKVQm9QxCHLDqPXioP), row 10 "Game Arcade"). Not yet in the build plan; see "Cost and where it fits".

## 1. Goal

A games section that can keep growing, where every game practises the child's own syllabus (their level, subjects and skill packs), feels like a real game, and stays honest: stars come from how you played, never from luck.

The first game teaches **touch typing**: a see-through pair of "ghost hands" over an on-screen keyboard shows which finger presses which key, from the home row up to typing answers to real questions.

## 2. The Arcade

- **One hub per child** (Junior and Teen looks), reached from Home's tab bar or the study deck. Games are cabinets; each shows its syllabus tag ("P3 English · spelling list 6"), the child's progress (stage, stars) and "Continue".
- **Game registry** (`lib/games/registry.ts`): each game declares its id, subjects, syllabus tags per level, modes, where its content comes from (skill packs through the Skill Engine's `find_items`, or a built-in curriculum) and its progress shape. **Every game is open to every child** (founder, 28 Oct): only its words, questions and difficulty follow the child's level. Adding a game is adding a registry entry and a screen.
- **First games:** typing, in three looks (below). Next in line: Number Dash (P3 number bonds and times tables), Stroke Quest (P3 Chinese stroke order, from the 420 word cards), Ratio Rescue (P6), Circuit Builder (Sec 2). They show as "coming soon" cabinets.
- **The Arcade is part of screen time.** It counts toward the daily limit, a parent can switch it off, and it never interrupts a planned learning session.

## 3. The typing game

### The typing path (the levels)

| Stage | What you type | Content source |
|---|---|---|
| 1 Home row heroes | a s d f, j k l ; then mixes | built-in |
| 2 Reach up | top row: e i r u, then w o t y q p | built-in |
| 3 Reach down | bottom row and shift | built-in |
| 4 Little words | short everyday and sight words | built-in, levelled by length |
| 5 My spelling words | the child's English spelling and vocabulary lists | p3-english pack (P3); vocabulary lists for P6/Sec 2 |
| 6 Subject words | words from their subjects: *tadpole, magnet*; *photosynthesis, resultant* | the child's science and maths packs |
| 7 Answer blast | a question appears; type the answer to fire | reviewed short-answer items, marked by `lib/domain/marking` |
| 8 Match it | a picture or definition appears; type the matching word | reviewed items and word cards |
| 9 Sentence sprint (boss) | a short sentence from their reading level | built-in and English pack |

Juniors start at stage 1; teens take a 60-second placement and usually start at stage 4. Each stage has 3–5 levels of about two minutes each.

### Shoot only when you type right

- Each correct key fires a bolt that chips the target; finishing the word bursts it into stardust (a chime from the world's scale).
- A wrong key fires nothing: the letter wobbles, the ghost hand shows the right finger, and you try again. **No sound and no penalty for a wrong key** (the kindness rule). Targets that reach the bottom just drift away.
- **Calm mode** (Junior default): no timer, targets wait for you. **Challenge mode** (Teen option): targets speed up with your rhythm, with a three-shield round you can restart any time.

### Ghost hands (the "invisible hands")

- Two translucent hands rest on the home row (fingers on A S D F and J K L ;, thumbs on space). Every key is tinted by the finger that owns it.
- Fingers are numbered **1–10 left to right**, the way a child counts with both hands flat: left pinky 1 to left pointer 4, thumbs 5 and 6, right pointer 7 to right pinky 10. Each fingertip carries its number on a soft badge (on the key it rests on, under the letter), each key shows its finger's number faintly in the corner, and the caption leads with the number ("④ Left pointer → R"). The key numbers hide with the hands at the "Off" level.
- Before each key, the right finger lifts, glows and reaches toward the key, with a caption ("Left pointer → R"). After a wrong key the finger replays the reach, slower.
- Training wheels: hands are **on** at a new stage, **fade** to a faint outline after a 2-star level, and can be switched **off**. Teens start with them faded.
- A posture card before stage 1: sit tall, wrists up, eyes on the screen, home-row bumps on F and J.

### Three looks (for review)

| Look | For | Theme | Target | Feel |
|---|---|---|---|---|
| **Star Typer** | Junior | Dreamlight space (Muse art) | word meteors | Kix flies a Sky Squadron jet; bolts on each right key; calm and sparkly |
| **Word Garden** | Junior, calmer | Terrarium | seeds | no shooting: each right word grows a flower; best for match mode and quieter kids |
| **Neon Strike** | Teen | Idol Stage neon arena (Muse art) | drones | question cards, combo meter, words per minute, a rhythm pulse; sleek and fast |

### Living backgrounds

Every game scene keeps moving and reacts to play (the living-scenes rule in `docs/design/living-scenes.md`). Only transform and opacity animate, and everything stops under reduced motion. Underneath the effects below, the art itself moves (living art, same doc): the garden's ferns sway, reeds waver and the pond ripples; the space clouds drift and breathe, comet trails glint and the planets bob; light runs along the arena's neon grid and its haze drifts; and the quest map's waterfalls flow and splash, its clouds drift, its grass waves and its stepping stones light up in turn.

| Look | Always moving | Heats up as you play well | Hidden taps (a different reaction each tap) |
|---|---|---|---|
| **Neon Strike** | four sweeping spotlights, light running along the grid lines, a pulsing horizon, drifting fog, rising sparks | combo 1/4/8: brighter spots and floor, then a laser fan | light rig (colour swap, a gentle double pulse, laser fan, spotlight search); fog machines in both corners (puff, smoke ring, burst) |
| **Star Typer** | three parallax star layers, nebula fog, shooting stars, drifting sparkles | words done 3/6/9: more sparkles, then warp-speed lines | the sky (a constellation draws itself: frog, rocket, crown; or a meteor shower); the planet (a moon swings round, the ring glints, a sparkle) |
| **Word Garden** | swaying sun rays, low mist, dust in the light, fireflies, drops sliding down the glass, a falling leaf | blooms 2/4/6: brighter rays, more fireflies | the pond (ripple, bubbles, double ripple, plip); the fern (spores, dew sparkles, fireflies) |
| **Arcade hub** | the living space scene, chasing marquee bulbs on every cabinet | — | — |

Every hit sends a soft bloom behind the action. Heat follows the round's own numbers, never mastery or rewards.

### Stars, saving and sharing

- **Stars are deterministic:** ★ finish the level, ★★ accuracy ≥ 90 %, ★★★ accuracy ≥ 96 % (teens also need their stage's speed: 15, then 25 words a minute). Same play, same stars. No random drops, no shop, no lives to buy.
- **Saved progress** per child and game (`game_progress`: stage, level, stars, best accuracy, best speed, per-key accuracy, updated). In the demo store until Supabase is set up.
- **Personal bests only.** No leaderboards or rankings between children (rule 5).
- **Share with family:** a result card (stars, accuracy, new keys learned, a ghost-hand badge) goes to the family's messages and the parent dashboard, and can be pinned to the Treasure creations shelf. Never public; the parent can delete it.
- **Parents see** the keys a child slips on most ("often swaps B and N"), as information only, like other signals.
- **Games never change mastery.** Answer blast and Match it use reviewed items and the same marking, but they record game results only; they're not mastery evidence (keeps the learner model honest and avoids gaming it).

### Devices

Built for a laptop or a tablet with a keyboard. On a touch screen the on-screen keyboard takes taps, and the ghost hands become a single glowing finger dot. Phones get a "best with a keyboard" note, with Word Garden match mode playable by tapping.

### Accessibility

Big, high-contrast keys; a dyslexia-friendly letter style option (more spacing); captions on everything spoken; reduced motion swaps meteors for cards that slide in; no flashing: never more than three flashes a second (WCAG 2.3.1), so the light rig's "strobe" is a slow double pulse. On phones, foldables and portrait tablets (founder, 29 Oct: flicker) each game fits the small viewport exactly (no page scroll under the keys), the keys have no tap flash or double-tap zoom, blurred backdrops and the fine moving line patterns (warp rings, the neon floor's lines) are off, and finishing a word replaces only its own meteor.

## 4. Sound

Synthesised as before: a soft "pew" per bolt (pitched to the world's scale, so words play little tunes), stardust chime on a finished word, a level fanfare. Wrong keys stay silent.

## 5. Cost and where it fits

| Piece | Hours (agent) |
|---|---|
| Arcade hub, registry, screen-time hook | 2 |
| Typing engine (key timing, accuracy, WPM, stars), on-screen keyboard and ghost hands | 5 |
| Star Typer | 3 |
| Neon Strike (same engine, new skin and question cards) | 2 |
| Word Garden | 2 |
| Progress saving, result card, share to family | 2 |
| Content mapping for stages 5–8 | 1.5 |
| **Total** | **17.5** |

The build is at capacity. Suggested: build the Arcade, Star Typer and Neon Strike (about 12.5 h) on Days 5–6 by moving Vibe Zone's chat brief to a fixed template, and put Word Garden and the "coming soon" games on the roadmap slide. Founder to decide after reviewing the designs.
