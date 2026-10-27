# Living scenes: backgrounds kids can poke

**Written:** Tue 27 Oct 2026 (Day 1), from the founder's feedback: "kids should be able to interact with the background elements… the desk and lamp… on/off lamp, open drawer, window… hidden easter eggs. Each time shall behave slightly differently, so it gives real-life vibes." Code: `components/scene/`. Design-system rules: `mykx-design-system` §4a.

## Principles

1. **Cosmetic only.** A poke never earns, unlocks or changes anything: no points, stars, cards, mastery or streaks (AGENTS.md rule 5). Variety is random, but only in *how* a prop reacts, never in what a child gets.
2. **Hidden, then discovered.** Hotspots are invisible until hovered or focused. Each glints once every ~11 s (staggered) so a curious kid finds them. Nothing on screen says "click here".
3. **Never the same twice in a row.** Each prop has 2–6 reactions; `useVariety().pick()` never repeats the last one. Some depend on context: the window shows stars and fireworks after 6 pm on the child's clock and birds and paper planes by day. Some are rare: the lamp sometimes flickers before it comes on.
4. **Things remember.** The study lamp stays as you left it on that device (local storage, cosmetic). Opened drawers and bloomed cactus last for the visit.
5. **Real objects, real art.** When a prop changes the painting (lamp off, drawer open), the new state is a Muse Image *edit of the same art with the same framing*, cross-faded in (only the changed patch is masked in for small props). CSS and SVG are for light, particles and small creatures, never for drawing a mascot.
6. **Calm around tasks.** Living scenes go on landing and browsing pages (sign-in, doors, Home, study deck, quest map, Treasure). The question player stays still: only Kix reacts there.
7. **Sound is synthesised** (Tone.js prop sounds: click, creak, tink, splash, croak, chime, pop, flutter, knock, rustle, beat), quiet, and follows the HUD mute. Glows and lanterns each sing one note of the world's scale, so tapping several plays a tune.
8. **Accessible.** Art hotspots are real buttons with labels ("Turn the desk lamp off") and come after the page content in tab order. Moving critters are pointer-only extras. Reduced motion: no glints, effects resolve instantly, notes fade. Clicks pass through layout containers; only panels and hotspots take them.

## Per page

| Page | Pokeable things (✓ built 27 Oct) | Reactions (varied) |
|---|---|---|
| **Sign-in city** (all three looks) | ✓ the door, ✓ lanterns/neon motes, ✓ flying Kix, ✓ walking Kix | knock-knock (2 or 3 knocks), the seam flares and the door answers with one of three lines per look; a lantern flares and sings its note; a flyer loops; a walker hops |
| **Who's learning?** | ✓ lanterns, ✓ flying Kix | as above; the doors themselves already open a crack and Kix peeks on hover |
| **Study deck** (teen landing; study room) | ✓ lamp, ✓ window, ✓ drawer, ✓ headphones, ✓ plant, ✓ cactus | lamp: on/off cross-fade to a Muse "lamp off" edit, sometimes flickers on, remembered; window: shooting star, bird flock, paper plane, firework, crescent moon or city lights twinkling (time-of-day weighted); drawer: opens (Muse "drawer open" edit), the paper star sometimes glints, a sticky note line ("Breaks are part of the plan."); headphones: two bars of lo-fi with floating notes; plant: a leaf falls or a ladybug crawls across the desk; cactus: blooms, then sparkles |
| **Home** (junior; terrarium) | ✓ Kix, ✓ fern, ✓ glass (both edges), ✓ fireflies, ✓ dragonfly | Kix: hop, spin, wiggle or squish plus a line (a hello, a hint at an easter egg, or a true critter fact); fern: spores puff or dew drops fall; glass: a shine sweeps across, or it fogs and a smiley gets drawn in it; fireflies zip and sing; the dragonfly loops |
| **Quest map** | ✓ singing sparks | next: crystals on the islands chime the scale; the waterfall splashes |
| **Treasure Realm** | ✓ singing lanterns | next: crystals chime; the aurora shifts colour when dragged. Chests stay closed: no loot-box look |
| **Studio** | (Kix transform is the moment) | next: tap Kix on the stage for the same reactions as Home |
| **Question player** | none on purpose | Kix's expressions only |
| **Vibe Zone, Critter Lab, Sky Squadron** (later screens) | next: Pip wiggles and blows a bubble; a jet does a barrel roll when tapped | |
| **Parent and admin** | none | calm, editorial |

## Living art: the painting itself moves

Overlays alone feel pasted on, so the parts of a background that would move in real life are cut out of the art and move by their kind, exactly where they are painted (`scripts/living-art.ts` → `public/art/living/<art>.json`; drawn by `components/scene/LivingArt.tsx` in the app and `livingArtHtml` on the canvas, both from `lib/scene/livingArt.ts`; styles in `components/scene/livingArt.css`).

| Kind | What moves | Made from |
|---|---|---|
| sway | fern fronds and leaves swing from their base | SAM 3.1 instances ("fern") |
| waver | reeds and grass tufts skew in the wind | SAM ("reeds", "grass"), taller than wide |
| breeze | a band of light runs over wide grass (lawns and island tops never skew) | SAM grass wider than tall |
| mist | clouds drift, swell and breathe | SAM ("cloud") |
| haze | one whole-frame layer of painted nebula or stage haze drifts and swells (no strips, so no seams or pulsing) | bright soft pixels |
| bob | planets float | SAM ("planet") |
| flow | water streaks fall inside the waterfall's own shape; foam, splash puffs and droplets at the foot | SAM ("waterfall") as a mask |
| shimmer | pond ripples drift toward you with a passing glint | SAM ("pond water") as a mask |
| glint | light sweeps over dew, crystals and comet trails | SAM unions, or colourful pixels |
| runway | stepping stones light up one after another along the path | SAM ("glowing stepping stone") as a mask |
| float | floating islands (with the chests that sit on them) drift up and down on a plate that has the sky filled in behind them, so no ghost shows | SAM ("floating island", chests joined to their island) |
| orbit | stars circle a point (the vortex core), turning against the art's own swirl | near-white pixels outside the core |
| flicker | lanterns and chest glow flicker in four groups, each on its own beat | warm pixels |
| pulse | a core of light breathes | bright pixels inside a circle |
| (whole art) | `.la-swirl-art` on a wrapper sways the whole art ±3° and breathes, zoomed 1.12–1.16× so no corner ever shows on any screen shape | — |
| neon | thin pink and cyan bands run from the horizon toward you, speeding up, so light travels along every grid line (no full-floor flashes) | bright pixels below the horizon, faded in under it |

A recipe can also build a **plate**: the art with the sky filled in behind parts that move a lot (a normalised blur that only samples what is outside them), drawn first under every layer. Each layer gets its own speed, swing and phase from its place in the list, so nothing moves in step, and the result is the same on every load. Every file is in `public/art/manifest.json`. To add an art: add a recipe to `scripts/living-art.ts`, run it with `--sheet <dir>` and check the sheet, then place `<LivingArt>` right after the `<Art>` it belongs to, inside the same box and with the same object-position. CSS masks need same-origin images, so a `file://` preview shows no light effects; serve it over HTTP.

## How to add one

1. Grid the art: `node <scratch>/grid.cjs public/art/scenes/<art>.webp out.png x0 x1 y0 y1` and read off the prop's box in art percentages.
2. If the painting must change, make an edit of the same art with `gen-image.mjs --ref` ("keep every object, the framing… only change: …"), check alignment, then save `-800`/1600 WebP and add a manifest entry.
3. Inside `<LivingScene art aspect>`: `<SceneLayer>` for art states, `<Hotspot box label onTap>` for the button, effects as `ls-fx` elements positioned in art percentages; `useBursts` for one-shot effects, `useVariety` for picks, `useSceneFlag` for remembered state.
4. Put the scene last in the screen's DOM; give the layout `pointer-events: none` and its panels `auto`.
5. Check at 390, 720 and 1280 that every real button is still clickable (the Playwright "blocked" check) and that reduced motion is calm.
