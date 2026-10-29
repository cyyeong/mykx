---
name: mykx-design-system
description: myKx visual direction and theme engine — the source of truth for how myKx looks, moves and feels. Load before creating or restyling ANY myKx screen or component (Home, Learn & Revise, question player, Treasure Realm, Vibe Zone, Sidekick Studio, Parent view), choosing colours/fonts/motion, adding art, or reviewing UI polish. Covers age bands (Junior/Teen), style packs (Dreamlight, Anime Sky, Toon Pop, Idol Stage, Terrarium), critter companions, tokens, signature effects, accessibility and performance budgets. Use together with ui-ux-pro-max (lookups) and frontend-design (process); this skill wins on any conflict.
---

# myKx Design System

**North star:** myKx must look like a place kids *want* to visit, not a worksheet with a chatbot. Judges score "Demo — is it genuinely cool to watch?" and "creative use of Meta tooling" equally with impact and engineering. When a feature and a visual moment compete for time, protect the visual moment on the demo path.

Reference art (Muse Image, 27 Oct 2026): `docs/design/explorations/` — `kix-anime.jpg`, `kix-3d-cartoon.jpg`, `kix-idol-stage.jpg`, `treasure-vault.jpg`. Match that quality bar.

## 1. Theme model: band × pack

Every screen renders under two attributes on `<html>`:

```html
<html data-band="junior|teen" data-pack="dreamlight|anime-sky|toon-pop|idol-stage|terrarium">
```

- **Band** (from enrolment, never from a guess at age) controls density, type size, copy tone, target size and how much Kix appears.
- **Pack** (the child's choice in Sidekick Studio) controls palette, display font, radii, texture, particles, background art and Kix's look.
- Packs are CSS custom-property sets. Components only read semantic tokens. No raw hex in components.
- Switching pack is the hero moment: wrap it in `document.startViewTransition()` (fallback: 400 ms cross-fade) so the whole UI re-skins on screen.

### Token layers

```css
/* primitive (per pack) → semantic (what components read) */
--surface, --surface-raised, --surface-glass   /* backgrounds, cards, frosted panels */
--ink, --ink-muted, --ink-on-accent            /* text */
--accent, --accent-2, --glow, --success, --warn
--radius-sm|md|lg|pill, --border-w
--font-display, --font-body
--motion-snappy (120ms), --motion-base (240ms), --motion-hero (600ms), --ease-bounce, --ease-soft
--art-bg (url), --particle (stars|petals|confetti|bubbles)
```

## 2. Style packs (original — no real IP)

Pack names and art are original. Never name or imitate an existing franchise, studio, artist, idol group or real performer, in prompts or in UI copy. "Anime-inspired" and "K-pop-inspired" describe an aesthetic only.

| Pack | Feel | Palette (start point) | Display / body font | Shape & texture | Particles | Kix look |
|---|---|---|---|---|---|---|
| **Dreamlight** (default) | magical, dreamy twilight; the Treasure aesthetic | twilight `#2B2A5C`, lavender `#B9A7F5`, mint `#A8F0D4`, peach glow `#FFC9A8`, star gold `#FFE38A`, mist `#EDE9FF` | Fredoka / Nunito | soft radii (20–28px), frosted glass, glow edges | drifting stars + lanterns | soft lavender-mint star sprite, forehead sparkle |
| **Anime Sky** | cel-shaded skies, wind, light rays | dusk navy `#1B2350`, sky `#5AA9F0`, sakura `#F7B6CF`, cloud `#F8FAFF`, flare `#FFD36E` | M PLUS Rounded 1c / Nunito | crisp 2px ink outlines, speed-line accents | petals + light motes | cel-shaded, sharp highlights |
| **Toon Pop** | chunky 3D vinyl toy, bouncy | grape `#7C5CFF`, bubblegum `#FF7EB6`, lime soda `#B6F36A`, sunny `#FFD23F`, cream `#FFF6E0`, ink `#2A1E5C` | Lilita One / Nunito | claymorphism: thick borders, double soft shadows, squash-and-stretch | bubbles | clay/vinyl toy render |
| **Idol Stage** | concert neon, holographic, lightsticks | stage `#120C2B`, magenta `#FF3DCB`, cyan `#3DF5FF`, holo lilac `#C9B8FF`, lightstick mint `#8CFFC9`, chrome `#E6E8F0` | Unbounded / Outfit | holographic foil gradients, chrome bevels, glow | confetti + beam sweeps | plush star in holographic jacket with lightstick |
| **Terrarium** | lush glass-tank nature world for critter fans (ants, mealworms, geckos, tadpoles, frogs) | moss ground `#EEF5E4`, deep moss ink `#1D3324`, leaf `#2C7A47`, amber `#F2A93B`, sun gold `#FFD34D`, pond teal `#1C6C84` | Grandstander / Nunito | soft organic radii, leaf and pebble shapes, dewdrop highlights | drifting spores + fireflies | young explorer: hat, magnifying glass, leaf scarf |

Exact token values for every pack live in the published myKx design system (`tokens.json`); the hexes above are the identity colours.

Fonts are a starting point. Confirm pairings with `python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<mood>" --domain typography`, and load only two families per pack via `next/font`.

## 3. Age bands

| | **Junior** (P1–P4, ~7–10; MVP: P3) | **Teen** (P5–Sec 4, ~11–16; MVP: P6 and Sec 2) |
|---|---|---|
| Layout | one task per screen; quest map | denser "study deck" dashboard |
| Type | body 18–20px, display 40–56px | body 16px, display 32–44px |
| Targets | ≥ 56px | ≥ 44px |
| Kix | large, reacts on every action, speech bubbles | small HUD companion; speaks only when asked |
| Copy | short, warm, concrete ("Nice thinking! Try one more.") | peer tone, no baby talk ("Solid. One fresh question to lock it in.") |
| Default pack | Dreamlight / Toon Pop | Dreamlight / Anime Sky / Idol Stage; dark surfaces default |
| Extras | read-aloud button (browser SpeechSynthesis) | focus timer, wallpaper/accent choice |

Teens reject anything that looks childish. Junior screens must still feel premium, never clip-art.

## 3a. Form factors: mobile, foldable, tablet, desktop (added 27 Oct)

Every screen works on all four. Design at the native frame, then reflow; never scale a fixed canvas down.

| Class | Viewport width | Devices | Canvas frame |
|---|---|---|---|
| **Compact** | < 600 px | phones; foldable cover screens (≈ 344–430) | Phone 390 × 844 |
| **Medium** | 600–1023 | foldables open (≈ 690–884, near-square); tablet portrait (768–834) | Foldable 720 × 840 · Tablet portrait 820 × 1180 |
| **Expanded** | 1024–1599 | tablet landscape (1024–1366); laptops | native boards: 1280 × 800 (kids), 1440 × 900 (admin) |
| **Desktop** | ≥ 1600 | monitors | Desktop 1600 × 1000 |

CSS: `@media (max-width: 599px)` compact, `@media (min-width: 600px) and (max-width: 1023px)` medium, expanded is the default, `@media (min-width: 1600px)` desktop. Minimum supported width 320 px (no horizontal scroll at 344).

**Layout rules**
- Content sits in a centred container, `max-width: 1440px`; on desktop, ambient art and glows fill the margins instead of stretching cards.
- **Fit to screen (kid pages, landscape from 1024 px; founder's call, 28 Oct):** no page scroll. The shell is the window's height and each screen fills `var(--screen-h)` with a layout that flexes to it (inside these rules use `cqh`/`cqw` from `.kid-shell-main`, never `vh`/`vw`). Fit first; only windows shorter than `--fit-min-h` (720 px) zoom the whole shell down, never up. Art-anchored layouts (the quest map) keep their board ratio as a centred stage over a blurred copy of the art. Long lists scroll inside their own shelf, not the page. Phones and portrait tablets keep reflow and normal scrolling. See `components/nav/kid-tabs.css`.
- Two-pane screens (stage + task: Studio, Question, Vibe Zone, Talk to Kix, Add knowledge): side by side on expanded and desktop; stacked on medium with the stage shortened; on compact the task comes first and the stage becomes a header.
- Card collections use `repeat(auto-fill, minmax(…, 1fr))`: 2 columns compact, 3 medium, 4–5 expanded.
- Maps and rows that rely on horizontal space (Quest map, Squadron, pack tiles) become a vertical trail or a horizontal snap carousel on compact.
- Dialogs, hints and the reward reveal become bottom sheets on compact; primary actions sit in a sticky bottom bar above the safe area (`env(safe-area-inset-bottom)`).
- Admin tables become card lists on compact; anything still wide scrolls inside an `overflow-x: auto` box, never the page.

**Navigation and Kix**
- Kids: bottom tab bar on compact (Home, Learn, Treasure, Vibe, Me; 64 px + safe area); a left rail with icons and labels from medium up. Admin: sidebar on expanded; icon rail on medium; top bar with a menu button on compact.
- Kix: hero 360–440 px on expanded and desktop, 240–280 medium, 160–200 compact; the HUD companion is 56–72 px and docks above the answer bar on compact. Speech bubbles go beside Kix when there's room, otherwise under it.

**Foldables**
- Cover screen = compact; open = medium, so the near-square shape favours side-by-side panes from 700 px when height allows.
- Postures (progressive enhancement): spanning in book posture, `@media (horizontal-viewport-segments: 2)`, puts the stage left of the hinge and the task right, with the gap from `env(viewport-segment-left 1 0)`. Tabletop, `@media (vertical-viewport-segments: 2)`, puts Kix, art or video on the top half and controls on the bottom. Never place text or a tap target across the fold.

**Type, touch and motion**
- Fluid display type with `clamp()` (Junior display `clamp(32px, 6vw, 56px)`; body never below 18 px for Junior, 16 px for Teen). Targets stay ≥ 56 px Junior and ≥ 44 px Teen at every size.
- Hover is never the only affordance; desktop gets keyboard focus and shortcuts. Art uses the `-800` variants below 1024 px.
- On compact, particles are capped at 60 and parallax is off by default.

**In the canvas:** every screen board is a fluid PAGE (`"expand": "fill"`); layout properties that change between classes live in prefixed `<helmet>` classes with these media queries (inline styles would override them), visual styling stays inline. The **Devices** page shows each screen at the four frames through small wrapper boards that `<dc-import>` the screen.

## 4. Surfaces and their signature moment

Each surface gets **one** memorable moment. Keep everything around it calm.

| Surface | Signature moment | Build notes |
|---|---|---|
| **Sidekick Studio** (onboarding) | Kix transforms into the chosen pack and the whole UI re-skins live | Muse Image edit from locked Kix reference → SAM 3.1 cutout → palette extract → view transition. Cached fallback per pack. |
| **Home** | Kix greets by name over pack background art; today's quest glows | parallax art layer + one CTA |
| **Learn & Revise** | Junior: winding quest path whose nodes glow with mastery. Teen: study deck with mastery rings | nodes = subskills; honest labels ("limited evidence") |
| **Question player** | correct answer → sparkle burst; a reward card flies toward the Treasure icon | Kix expression states: idle, thinking, hint, cheer |
| **Treasure Realm** | dreamy vault: floating crystal islands, aurora, drifting lanterns; holographic collectible cards tilt with pointer; skill constellation lights up | see §5 |
| **Vibe Zone** | brief → planner/flashcards appear with generated art in the child's pack | trusted React renderer from a JSON spec, never model-authored HTML |
| **Critter companion** (Terrarium; Pip on Home) | the adopted tadpole or mealworm grows to its next real life-cycle stage, with the growth track showing the whole cycle | stages keyed to reward-ledger milestones; never sick or dying; the growth track doubles as the life-cycle diagram |
| **Critter Lab pets** (every band; founder, 29 Oct) | the pet really moves in its habitat (a tadpole swims with a swaying tail, wings flap, frogs hop, larvae inch, chicks peck), and growing to the next stage is a flash that lands on the life-cycle track's next step | the life cycle is always in view with the stage marked; moods (happy, hungry, sad, cross) come from care bars and show as posture, pace and an emote bubble, never a sick or dying pet; growth comes from each stage's own care, decided by code; sprites are Muse Image edits of the life-cycle sheets, cut out with SAM |
| **Parent view** | calm, editorial evening summary; evidence chips; one offline activity card | Dreamlight palette, low motion, no game chrome |

## 4a. Living scenes (added 27 Oct)

Backgrounds are places, not wallpaper: kids can poke things in the art (the study lamp, a drawer, the window, the terrarium glass, lanterns, fireflies, Kix). Full spec and per-page list: `docs/design/living-scenes.md`; code: `components/scene/`.

- **Cosmetic only.** A poke never earns or changes anything (rule 5). Random variety is allowed only in *how* a prop reacts.
- **Hidden, then discovered:** invisible hotspots with a rare glint; 2–6 reactions per prop that never repeat back to back; time-of-day and rare variants for a real-life feel; some state is remembered (the lamp).
- **Real art:** a changed painting (lamp off, drawer open) is a Muse Image edit of the same framing, cross-faded in; CSS/SVG only for light, particles and small creatures.
- **Calm around tasks:** landing and browsing pages only; the question player stays still except Kix.
- **Accessible:** art hotspots are labelled buttons after the content in tab order; moving critters are pointer-only extras; reduced motion resolves effects instantly. Layout containers pass clicks through (`pointer-events: none`), panels take them.

## 5. Treasure Realm spec (magical and dreamy)

- **Backdrop:** full-bleed Muse Image vault scene (`treasure-vault.jpg` direction) with an empty centre for UI. Layers: art → animated aurora gradient (CSS `@property` hue drift, 30–60 s loop) → canvas particles (stars, lanterns rising slowly) → UI.
- **Parallax:** 2–3 depth layers shifting with pointer/device tilt (max 12px). Off under reduced motion.
- **Collectible cards:** each earned reward is a card showing Muse Image art of the topic in the child's pack ("Light & Shadows": Kix making torch shadow-puppets). Holographic foil: pointer-tracked `radial-gradient` glare + `conic-gradient` foil with `mix-blend-mode: color-dodge`, 3D tilt ≤ 10°.
- **Constellation:** mastered subskills are stars in an SVG constellation; new mastery draws the connecting line.
- **Unlocks are deterministic** (from the reward ledger). No random drops, no loot boxes, no rankings, no money.
- **Creations shelf:** Vibe Zone projects as framed polaroids, with share/revoke.
- **Interest collections:** themed card sets earned on the same deterministic ledger, e.g. **Sky Squadron**: four original insect-inspired display jets (Dragonfly, Bumblebee, Firefly, Rhino Beetle), each card's back pairing an insect fact with a flight idea. Display flying only: no weapons, insignia, real aircraft models or film references.

## 6. Motion and sound

- Library: `motion` (Framer Motion) for components, CSS for ambient loops, a small canvas loop for particles. Pause particles when the tab is hidden.
- Motion answers actions: press squash (120 ms), card flip, reward fly-to-Treasure (600 ms arc), pack re-skin (view transition). Ambient motion only in Treasure and Home backgrounds.
- `prefers-reduced-motion`: no parallax, no particles, no tilt; keep fades ≤ 200 ms; show static art.
- Sound: see §6a.

## 6a. Voice and sound (added 27 Oct)

**Sound is synthesised, never recorded.** Tone.js (lazy-loaded on the first tap; browsers block audio before a gesture) plays every effect, so there are no audio files to license or download. Master at full level through a gentle compressor and a −1 dB limiter (founder, 29 Oct: −12 dB was too soft on phone and tablet speakers), the music bed about 16 dB under it; effects ≤ 600 ms except the transform; no sound for wrong answers (kindness rule); one mute button in the HUD; SFX on by default for Junior and off for Teen; ambience off by default. The HUD holds Sound (the one mute), Music, Beat and the ambience bed: docked in the rail from 600 px, folded behind one Sound button on phones. Ambience beds are texture only (no pitched or random notes); music plays from its score on the beat grid, and the Beat (drums and bass) follows the place: none on learning screens, light on Home and Treasure, energetic in games.

| Pack | Instrument palette | Ambience bed (optional) |
|---|---|---|
| Dreamlight | music box / celesta, soft pad, wind chimes | night breeze and distant chimes |
| Anime Sky | bright piano, glockenspiel, airy strings | wind and synth birdsong |
| Toon Pop | marimba, slide whistle, boing, woodblock | none (it's loud enough) |
| Idol Stage | synth pluck, claps, sparkle arpeggios | stage hum (texture only, no beat) |
| Terrarium | kalimba, wood blocks, FM frog croak | rain, crickets, pond drips |

Events, same everywhere, voiced by the pack's palette: tap (soft tick), pack pick (the pack's signature chord), correct (rising three notes), hint (two gentle notes), reward card (sparkle arpeggio and shimmer), transform (two-second rising whoosh, then a reveal chord), card flip (swish), Pip grows (pond bloop and chime).

**Talk to Kix (voice in).** A mic button sits on the Kix speech bubble, at least 64 px for Junior. *Hold* to talk; never a toggle that keeps listening. States: idle (mic glyph) → listening (accent ring that pulses with the mic level, "Listening…", Kix leans in with the thinking expression) → transcribing (three dots in the bubble) → heard (the transcript in the bubble with ✓ "That's right" and ↺ "Say it again"). The typed box is always visible beside it. Mic denied: show a calm one-line note and keep typing available.

**Kix speaks (voice out).** Browser `speechSynthesis`, with the best installed voice from a preference list; Junior rate 0.95 and pitch 1.2, Teen rate 1.0 and pitch 1.0. Captions are always on: the spoken line shows in the bubble with the current word highlighted in the reward colour. A small speaker button replays the line. Small print in Settings and Under the hood: "Kix speaks with your device's voice."

**Study Song (stretch).** A karaoke card in Vibe Zone: four lyric lines, the current syllable lifts and glows in the reward colour, a beat dot pulses in the accent colour, and Kix bobs on every beat (respect reduced motion: no bobbing, highlight only). Play and pause, and a loop button.

## 7. Accessibility and performance gates

- Text over art always sits on a scrim or glass panel. Contrast ≥ 4.5:1 body, ≥ 3:1 large text, checked in every pack.
- Visible focus ring in pack accent; full keyboard path through the question player.
- Icons: SVG (Lucide/Phosphor), never emoji as icons.
- Images: WebP/AVIF; backgrounds ≤ 300 KB at 1920w with `srcset`; stickers ≤ 120 KB; `next/image` with explicit sizes; LCP < 2.5 s on tablet.
- Particle canvas ≤ 120 particles, DPR capped at 2, ≤ 2 ms per frame.
- Target devices: tablet landscape first, then phone portrait, then desktop.

## 8. Anti-patterns

- Generic SaaS card grid, grey shadows, blue primary button: the "AI default" look.
- Clip-art, stock emoji, Comic Sans/Comic Neue.
- Real franchises, characters, idols, logos or brand names in art, copy or prompts.
- Text baked into generated art. Put text in HTML.
- Runtime dependency on live image generation for the demo path. Always have a cached asset.
- Random or variable-ratio rewards.

## 9. Workflow for any UI task

Each design skill has one job, so they don't overlap:

| Skill | Role | Not for |
|---|---|---|
| `mykx-design-system` (this) | **What** myKx looks like: tokens, packs, bands, surfaces | — |
| `frontend-design` | **How** to design a screen: plan → check against generic defaults → build → screenshot critique; copy tone | choosing palette or fonts (§2 already decides them) |
| `ui-ux-pro-max` | **Lookups**: a11y rules, interaction patterns, GSAP, icons, Next.js/Tailwind tips | `--design-system` / `--persist` (never run them here) |
| Muse built-in `taste` | anti-slop filter (Muse only) | overriding §2 (see below) |

Steps:

1. Read this skill, then follow `frontend-design`'s process.
2. Query `ui-ux-pro-max` with `--domain`/`--stack` for specific rules.
3. Need art? Use the `muse-image-assets` skill. Never draw mascots in CSS or SVG.
4. Build, take a screenshot in the browser, critique against §4 to §8, fix, and repeat once.

**Deliberate exceptions to generic anti-slop lists** (Muse `taste`, `frontend-design`'s calibration list): lavender/violet in Dreamlight, aurora gradients, glow and frosted glass are brand choices for a magical kids' product. Keep them earned, not everywhere: aurora only in Treasure and Home backgrounds, glow only on interactive or reward elements, glass only on panels over art. The other anti-slop rules still apply (no single radius on everything, no fade-up on every section, no hover-lift on every card, no gradient headline text, no emoji icons).
