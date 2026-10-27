# myKx PRD review: gaps, enhancements and a visual-first re-scope

**Reviewed:** `docs/prd/myKx_PRD.md` (decision date 26 Oct 2026) · **Review date:** 27 Oct 2026, Day 1
**New direction from the founder:** time is tight; the app must be visually stunning, not a simple page; features can be thin. Treasure = magical and dreamy. Learn = age-aware, with the customisation kids love (anime, cartoon, K-pop).

---

## 0. Verdict

The PRD is a careful safety and data spec, but it optimises for the wrong half of the scorecard and won't fit the calendar.

1. **Wrong half of the scorecard.** Judging has four equally weighted criteria. Two of them, *Use of Meta AI tooling* ("surprise us") and *Demo* ("genuinely cool to watch"), are mostly about visible creativity. Three bonus prizes also reward visuals: Best Creative Build (Muse Image/Wonder, $5k), Most Viral ($20k) and Community Vote ($10k). The PRD gives the whole visual layer **2 of 56 hours** (FR05), calls Muse Image "one Kix/theme/reward asset… no runtime art requirement", and makes generated art the **second item cut**. That priority is now inverted.
2. **It won't fit the calendar.** 56 P0 hours across 12 FRs, for one developer, with security gates, nine enrolment combinations, a 36-item reviewed bank, an ingestion pipeline, RAG/wiki self-improvement, PDF variants, sandboxed code generation and provider switching. Add a visual layer that's actually stunning and the plan breaks. Cut roughly half the backend breadth and keep one deep, beautiful vertical slice.
3. **Muse Image works and is cheap.** Today's test produced four high-quality style samples in about a minute (§1). Images cost $0.01 each. Credits aren't the constraint; dev time is.

Keep from the PRD: the deterministic mastery model (§6), honest uncertainty labels, the parent summary loop, household isolation, the no-loot-box reward ethics, and the anti-chatbot framing. They're good, and they're what makes the visuals credible rather than fluff.

---

## 1. Evidence: Muse Image style test (27 Oct, via Muse Code `image_generation`)

Files are in `docs/design/explorations/`. Prompts are in `prompts-2026-10-27.txt`.

| Sample | Result |
|---|---|
| `kix-anime.jpg`: anime key visual | Excellent. Cel shading, dramatic sky. It also rendered **legible text** in a book ("Chapter 1: Starlight & Motion"): impressive, but unwanted in educational art, so prompts must say "no text". |
| `kix-3d-cartoon.jpg`: 3D vinyl/clay | Excellent and very kid-appealing. Clean background, close to cutout-ready. |
| `kix-idol-stage.jpg`: original K-pop-inspired | Excellent. Neon, holographic jacket, lightstick, no real performers. This will land with teens. |
| `treasure-vault.jpg`: dreamy vault | Excellent. Floating crystal islands, aurora, lanterns, glowing chests, and a **clean centre for UI** as requested. It's ready to be the Treasure backdrop. |

Technical findings:
- Through Muse Code, the tool **ignored size**: all outputs were 1920×1280 JPG. Production assets need the direct API (`size`, `n`, `output_format`). A script is in place: `.agents/skills/muse-image-assets/scripts/gen-image.mjs`. It's untested until a Model API key is set.
- **Kix drifts** between styles (body shape, fur vs clay, eye style). Fix: lock one approved `kix-base.png` and make every variant through `/v1/images/edits` with it as the reference.
- **No transparent output.** Stickers need SAM 3.1 masks as alpha. That's a genuinely novel two-model pipeline worth showing judges.
- Cost of the test: 4 images × $0.01, plus a small amount of Spark contributor tokens (exact figure on the dev.meta.ai Billing page).

---

## 2. Gaps (most severe first)

| # | Gap | Why it matters | Fix |
|---|---|---|---|
| G1 | **No visual direction anywhere.** No design system, art bible, motion, layout or hero moments. FR05 = 2h. | Two of four criteria and three bonuses are visual. A beautiful demo is the difference between "another edu chatbot" (an organiser anti-project) and a finalist. | New skill `mykx-design-system` (band × pack theme engine, surface signature moments, Treasure spec). Visual foundation starts Day 1–2, not Day 6. |
| G2 | **Scope vs calendar.** 80 provisional hours, calendar "reconciliation pending", Day 10 partial. | The deadline is **5 Nov 10:00 SGT** (4 Nov 21:00 EST). Today is Day 1. There's no slack for 12 FRs plus visuals. | Re-scope (§4) and a revised 9-day plan (§5). Target submission **4 Nov 22:00 SGT** with a 12-hour buffer. |
| G3 | **Judging and bonus misalignment.** The PRD chases the open-weight bonus (Baseten access unconfirmed) but ignores Creative Build, Viral and Community Vote. | Creative Build is directly earned by the Sidekick Studio and Treasure art. Viral and Community Vote are earned by shareable visuals. | Make Muse Image + SAM central (Sidekick Studio, collectible cards). Add a shareable "My Sidekick" card (no PII). Keep Baseten as a 2-hour, best-effort item. |
| G4 | **Age bands are copy and density only.** "9–11/12–15 fixed copy… mature styling" is undefined. No fandom customisation at all. | Teens bounce off childish UI. Juniors need big, warm, mascot-led UI. Fandom styles are the requested hook. | Two bands (Junior/Teen) × five original style packs (Dreamlight, Anime Sky, Toon Pop, Idol Stage, Terrarium), defined as tokens + art + Kix variant. |
| G5 | **Treasure is a ledger, not a place.** FR10 is points, badges, versions and share grants. | The founder wants magical and dreamy. Reward screens are the most re-watched demo moment. | Treasure Realm spec: parallax dream-vault art, aurora, particles, holographic collectible cards with Muse Image art, and a skill constellation. Rewards stay deterministic. |
| G6 | **No IP, likeness or child-safety rules for generated art.** | "Anime" and "K-pop" invite prompts naming real idols or franchises. That's both a legal risk and a disqualification risk ("rights-cleared assets"). Children's photos as input would be a privacy risk. | Original characters only; aesthetic words, never names; no child photos ever; server-side templated prompts from chips; Junior band gets no free text; teen flair (≤ 40 chars) screened by Spark Standard; refusals fall back to cached art. |
| G7 | **No asset pipeline or provenance for generated art.** | Judges must see event-built, rights-cleared assets. Unoptimised 400 KB JPGs would hurt load time. | `public/art/manifest.json` (prompt, model, refs, hash, date); WebP optimisation budgets; generate once, cache, and never depend on live generation on the demo path. |
| G8 | **Budget model is wrong in two ways.** (a) "Muse Code excluded", yet Muse Code bills the same $150 credit (`muse usage`: no subscription allowance). (b) No Standard vs Contributor distinction. | Contributor Spark is **12.5× cheaper** ($0.10/$0.20 per 1M tokens), but Meta may train on those prompts. Your Muse Code default is `muse-spark-1.3-contributor`. | Dev in Muse Code on contributor with synthetic data only. All app runtime and child data on **Standard**. Set a Billing spend alert at $100. Split in §7. |
| G9 | **Vibe Zone security cost is out of proportion.** Model-authored spec → compiled HTML/JS → cookie-free origin, CSP hashes, one-use tokens, adversarial tests (FR09 + Day 8 gates). | About 6h build plus about 3h of security testing for one demo segment. One leak blocks the capability. | Render the validated JSON spec with **trusted React components inside the app**. No model-authored code means no iframe origin or CSP machinery. Muse Image supplies the flashcard and planner art. Same user loop, a fraction of the risk. |
| G10 | **Demo video leads with the least visual part.** 0:15–0:45 is upload, review and provenance. | Final-round judges watch videos live, and the first 30 seconds decide attention. | Open on the Sidekick transformation, then learning, then Treasure (§6). Show provenance as a quick overlay. |
| G11 | **No device target or performance budget for heavy art.** | Kids use tablets. Big art plus particles can stutter, and a poor first load hurts the live demo. | Tablet landscape first; LCP < 2.5s; WebP budgets; particle cap; reduced-motion path. (Design system §7.) |
| G12 | **Two coding agents, no source of truth or ownership split.** | Claude Code and Muse Code will collide on files and drift on conventions. | One rules file (`AGENTS.md`; `CLAUDE.md` imports it), one skills folder (`.agents/skills`, symlinked for Claude), and one docs hub (`docs/README.md`). Default split in `AGENTS.md`. |
| G13 | **Nine enrolment combinations and 36 reviewed items** are P0 and "never cut". | About 8h of content review that doesn't show on screen. | Demo two combinations deeply (P4 Science junior, Sec 3 Physics teen). Keep the selectors for all nine, with honest "content coming soon" states. Use 10 + 4 reviewed items. |
| G14 | **The ingestion pipeline is a full production system.** Resumable batches, SHA versioning, allowlisted fetch, shingle dedup, review queue. | About 9h with little visual payoff. | Keep one "snap homework" moment: photo → Spark vision → extracted question in a review card → publish. Seed the rest as reviewed fixtures. Cut remote fetch, dedup and stale propagation. |
| G15 | **Small but real.** Env var naming (`MODEL_API_KEY` in docs vs `META_API_KEY` in the CLI). Responses API uses `text.format`, not `response_format`. Meta has no TTS. The PWA adds little. Mermaid shows SAM on the critical path. | Avoidable Day-1 friction. | Captured in the `meta-model-api` skill. Browser `speechSynthesis` for read-aloud. Drop PWA to P1. |

---

## 3. Enhancements: the "stunning" layer

### E1. Sidekick Studio (hero moment, Creative Build bonus)
Onboarding where a child creates *their* Kix:
1. Pick a **style pack** (Dreamlight, Anime Sky, Toon Pop, Idol Stage, Terrarium), **two interests** (bugs and critters, jets and flight, space, animals, music, football, dance, robots…) and a colour. Picking "bugs and critters" also offers a critter companion (E7).
2. Server builds a templated prompt. Muse Image `/images/edits` uses the locked `kix-base.png` reference and returns 2 variants (≈ $0.02); the child picks one.
3. **SAM 3.1** cuts Kix out into a transparent sticker (≈ $0.0025).
4. Deterministic palette extraction → pack tokens → the **whole UI re-skins live** via a View Transition.
5. Kix's sticker becomes the companion across every screen, and the first collectible card lands in Treasure.

This uses Image + SAM + Spark together, the kind of "capabilities that surprised even us" the rubric asks for. Each pack has a cached fallback.

### E2. Theme engine: two age bands × five style packs
Defined in `.agents/skills/mykx-design-system` §2–3. One React tree with CSS custom properties: `<html data-band="junior|teen" data-pack="…">`. Each pack swaps palette, display font, radii and texture, particles, background art and the Kix variant. Teens default to dark surfaces and a small HUD Kix; juniors get a large, reactive Kix and 56px targets.

### E3. Treasure Realm (magical and dreamy)
Full-bleed dream-vault art with an aurora drift, rising lanterns, pointer/tilt parallax, **holographic collectible cards** (pointer-tracked foil and glare) illustrated by Muse Image in the child's pack, and a **skill constellation** that draws a new line when mastery evidence lands. Every unlock comes from the existing reward ledger. No randomness.

### E4. Learn & Revise by band
- **Junior:** a winding quest path over pack art; nodes glow by mastery; one question per screen; Kix reacts (idle, thinking, hint, cheer); read-aloud.
- **Teen:** a sleek study deck with mastery rings, focus timer and "limited evidence" labels; Kix as a quiet HUD.
- **Correct answer:** a sparkle burst, then a reward card flies to the Treasure icon. This is the visual link between learning and Treasure.

### E5. Motion and sound (sound promoted to core, 27 Oct)
One orchestrated moment per screen (see the design system). **Sound layer:** every pack has its own synthesised sound palette (Dreamlight music box, Anime Sky glockenspiel, Toon Pop marimba and boings, Idol Stage synth pluck, Terrarium kalimba, wood blocks and frog croaks) for taps, correct answers, reward cards, the transform and Pip growing, plus an optional ambient bed (Terrarium rain and crickets, Dreamlight night chimes). Built with Tone.js in the browser: no audio files, nothing to license, loaded on first tap. SFX on by default for Junior and off for Teen; ambience off by default; one mute button. No sound for wrong answers.

**Research (27 Oct):** Meta's Model API has no music, sound-effect or text-to-speech model, so sound is synthesised and music is "written" by Muse Spark as data (E10). Details in the `meta-model-api` skill.

### E6. "Talk to Kix" voice (promoted to core, 27 Oct)
**Voice in:** hold-to-talk on the Kix bubble → the browser records up to 30 s, encodes 16 kHz mono WAV → our `/api/voice/transcribe` route → `muse-voice-transcribe-1.0` → the transcript shows in the bubble for the child to confirm. Used for the Vibe Zone brief ("I keep forgetting the frog life cycle") and for asking Kix for a hint. **Voice out:** Kix reads questions, hints and flashcards aloud with the browser's `speechSynthesis`, with captions and word highlighting; labelled "Kix speaks with your device's voice". Big impact for younger and weaker readers, and the fourth live Meta model in the product. Costs cents ($0.18 per audio hour). **Child-data rules:** push-to-talk only, audio never stored or logged, transcript only, parent can turn voice off per child.

### E7. Critter world: the Terrarium pack and a companion that grows (added 27 Oct, founder's youngest)
The youngest loves the exotic side of nature: ants, mealworms, lizards, tadpoles and frogs. That lines up with lower-primary Science, where life cycles (frog, mealworm beetle) and classifying animals (insects, amphibians, reptiles) are core topics, so the interest becomes the lesson, not decoration.
- **Terrarium pack (fifth style pack):** a lush glass-tank world of moss, ferns, pebbles, a lily-pad pond, dewdrops and warm amber light. Leaf-green accent, amber reward and the Grandstander display face. Kix appears as a young explorer with a hat and magnifying glass. Junior band first.
- **Critter companion:** the child adopts a tadpole or a mealworm in Sidekick Studio. It grows through its *real* life-cycle stages as learning evidence lands. Frog: spawn → tadpole → froglet → frog. Mealworm beetle: eggs → larva → pupa → beetle. Growth is deterministic, keyed to reward-ledger milestones (first attempt, fresh-question success, mastery band), so it is never random. The companion never gets sick, sad or dies when a child takes a break: no guilt mechanics.
- **Critter quest (P3/P4 Science content):** order a life cycle, spot the insect (ant: six legs, three body parts; mealworm: a beetle larva), sort amphibians (frog, tadpole) from reptiles (lizard, gecko). The companion's growth track doubles as the life-cycle diagram the child is learning.
- **Treasure:** critter collectible cards (gecko and tree frog, ant colony) plus a terrarium shelf where companions live.
- **Rules:** cute but scientifically accurate stages; no gross-out or scary art; never real pets' photos as input; real species names only (no franchise creatures).
- **Cost:** about 4h build and about 12 images (≈ $0.12). It reuses the theme engine, HoloCard and QuestNode.

### E8. Sky Squadron: an insect-inspired jet collection (added 27 Oct, founder's youngest)
The same child loves fighter jets, especially the ones in big action films. We can't copy a film's aircraft (studio IP, and our original-art rule), so the set captures that high-speed stunt energy in original designs.
- **The set:** four original display jets, each inspired by an insect that flies alongside as its cameo: **Dragonfly** (teal, long wings, skims a lake), **Bumblebee** (chubby yellow, barrel rolls over sunflowers), **Firefly** (midnight night-flyer with glowing edge lights), **Rhino Beetle** (bronze powerhouse with horn canards). Plus a squadron hero banner and Kix as a jet pilot (a sidekick outfit).
- **Science hook:** each card's back pairs one true insect fact with one flight idea. Dragonflies move four wings independently to hover; bumblebee wings beat about 200 times a second; fireflies make light with a chemical reaction; rhinoceros beetles lift many times their own weight. For Sec 3 the same set illustrates thrust, drag, lift and weight in Forces.
- **Unlocks:** deterministic. One jet per four fresh-question successes; the hero banner after the full set. No random packs.
- **Rules:** display and stunt flying only. No weapons, missiles, combat, national insignia, flags, registration numbers or real aircraft models, and no film references in prompts or copy. This also keeps clear of the organiser's "anything involving war" anti-project.
- **Cost:** about 2h (the art is generated; it reuses HoloCard and the Treasure shelf). It's the first thing to cut after Baseten.

### E9. Shareable sidekick card (Viral and Community Vote)
Export a 1080×1350 card: the child's Kix in their pack plus a first name chosen by the parent (optional) and no school or other personal data. Feeds the X post required for the viral prize.

### E10. Study Song: Kix turns notes into a song (stretch, 27 Oct)
A second Vibe Zone template. The child says or types "make the frog life cycle a song" → Muse Spark returns a zod-validated **song spec** (title, tempo, scale, groove, four lyric lines with one note per syllable) → trusted Tone.js code plays it with the child's pack instruments while the lyrics bounce karaoke-style and Kix bobs to the beat. Muse Spark writes the music; the app only plays validated data (hard rule 4). Mnemonic songs are a proven memory aid, and it's a strong "surprise us" and viral beat. Fixture fallback song for the demo. Built only after Checkpoint B is green (implementation plan §6).

---

## 4. Re-scope: keep, simplify, cut

| PRD item | Decision | New version | Hours |
|---|---|---|---|
| FR01 accounts/households/enrolments | **Simplify** | Supabase Auth; seeded demo household (parent + junior + teen); RLS on child data; nine-combination selector UI with "coming soon" for seven | 3 |
| FR02 syllabus/banks | **Simplify** | 10 reviewed P4 Light & Shadows items + 4 Sec 3 Forces items as fixtures with source labels | 3 |
| FR03 ingestion | **Simplify** | "Snap homework": one photo → Spark vision → extracted question → review card → publish | 2 |
| FR04 Kix tutor + mastery | **Keep (core)** | deterministic marking, the §6 mastery maths, hints via Spark Standard (streamed), fresh-family check | 6 |
| FR05 personalised home/themes | **Expand (core)** | theme engine, two bands, five packs, Home, Sidekick Studio | 10 |
| FR06 RAG/wiki/self-improvement | **Cut** | show a source label on each item; no wiki | 0 |
| FR07 parent summary | **Keep (core)** | "Generate tonight's summary" button + Spark narration of deterministic aggregates + offline activity; no scheduler/worker | 4 |
| FR08 skills/PDF/variants/patterns | **Cut** (P1: one print-CSS practice sheet) | — | 0 |
| FR09 Vibe mini factory | **Simplify** | brief → Spark JSON spec → trusted React flashcards/planner with Muse Image art → revise → save → share/revoke | 5 |
| FR10 Treasure/rewards/shares | **Expand (core)** | Treasure Realm visuals + ledger + collectible cards + share/revoke | 8 |
| FR11 provider switching | **Best-effort** | one adapter interface; Baseten Spark Open tagging only if access arrives (≤ 2h) | 2 |
| FR12 admin | **Cut** | use the Supabase dashboard and seed scripts | 0 |
| FR13 SAM science activity | **Replaced** | SAM sticker cutouts in Sidekick Studio | (in FR05) |
| Critter world (new, E7) | **Add** | Terrarium pack, critter companion with life-cycle growth, 6 reviewed life-cycle and classification items | 4 |
| Sound layer (E5) | **Add (core)** | Tone.js SFX per pack, optional ambience, mute; lazy-loaded | 2.5 |
| Talk to Kix (E6) | **Add (core)** | hold-to-talk → Muse Voice Transcribe; browser read-aloud with captions | 4.5 |
| Study Song (E10) | **Stretch** | Vibe Zone song template: Spark song spec → Tone.js karaoke player | 3.5 |
| Sky Squadron (new, E8) | **Add, cuttable** | four insect-inspired jet cards + hero banner + Kix pilot outfit on the Treasure shelf | 2 |
| Art production (new) | **Add** | ~70 production images, cutouts, optimisation, manifest | 5 |
| Polish, a11y, perf, deploy (new) | **Add** | screenshots and critique passes; tablet checks | 6 |
| Video, README, X post (new) | **Add** | | 5 |
| **Total** | | | **≈ 65h** (about 7h buffer inside 9 × 8h days) |

Architecture simplification: a single Next.js app (App Router, TypeScript, Tailwind v4, `motion`) plus Supabase (Auth, Postgres/RLS, Storage). **No worker, no scheduler, no isolated preview origin.** Deploy on Vercel (fastest for Next.js) unless Render is already set up. Pre-generated art ships in `/public/art`; runtime Sidekick generations go to Supabase Storage.

---

## 5. Revised day plan (Day 1 = Tue 27 Oct; deadline Thu 5 Nov 10:00 SGT)

> **Superseded on 27 Oct by [`docs/plan/IMPLEMENTATION_PLAN.md`](../plan/IMPLEMENTATION_PLAN.md)**, which re-budgets to 8 hours a day and protects 12 hours for the video. Kept for history.

| Day | Date | Exit criteria |
|---|---|---|
| 1 | Tue 27 Oct | ✅ PRD review, skills and agent rules. Model API key; smoke-test Spark (Standard), Image API, SAM. **Lock Kix base** and the five pack directions. Scaffold Next.js + Tailwind + Supabase. |
| 2 | Wed 28 | Theme engine (band × pack tokens, view-transition switch); app shell and nav; Home; generate pack backgrounds and Kix variants via edits. |
| 3 | Thu 29 | Learn: junior quest map + teen study deck; question player with fixtures; deterministic marking and mastery; Kix hint (Spark streaming). |
| 4 | Fri 30 | **Sidekick Studio** end to end (Image edit → SAM cutout → palette → re-skin) with cached fallbacks. Kix expression set. Critter companion pick (tadpole or mealworm) and its growth stages. |
| 5 | Sat 31 | **Treasure Realm**: vault scene, particles, parallax, holo cards, constellation, reward fly-in from the question player. |
| 6 | Sun 1 Nov | Parent summary + offline activity; "snap homework" extraction; household/RLS checks. |
| 7 | Mon 2 | Vibe Zone (spec → React render → art → save → share/revoke). Baseten tagging if access exists. **Feature freeze 22:00.** |
| 8 | Tue 3 | Polish passes on every surface (screenshot → critique → fix); a11y and reduced motion; tablet perf; deploy; seed demo data. |
| 9 | Wed 4 | Record the video (two takes), README with event-built boundaries and the asset manifest, X post draft. **Submit by 22:00 SGT.** |
| 10 | Thu 5 | Buffer until 10:00 SGT only. |

Cut order if Day 4 slips: Vibe Zone → Baseten → Sky Squadron → snap homework → teen study deck (keep the teen *skin*) → Kix expressions (one pose). Never cut: Sidekick Studio, Treasure Realm, the learning loop with honest mastery, the parent summary, or household isolation.

---

## 6. Revised 3-minute video

| Time | Beat |
|---|---|
| 0:00–0:12 | Founder hook ("my kids have always been my sidekicks") over the Treasure Realm flythrough |
| 0:12–0:40 | **Sidekick Studio live:** a junior picks Toon Pop and a teen picks Idol Stage; Kix transforms; the UI re-skins (caption: Muse Image + SAM 3.1) |
| 0:40–1:20 | Learn: quest map → question → Kix hint (Spark) → fresh-family check → honest "57/100, limited evidence"; quick cut to the teen deck, same engine, different world |
| 1:20–1:45 | Correct answer → card flies to Treasure; holo cards; constellation line draws |
| 1:45–2:10 | Vibe Zone: "I forget my revision" → planner with generated art → save → share with Mum → revoke |
| 2:10–2:35 | Parent: tonight's summary with evidence and uncertainty, plus a 12-minute torch-and-shadows activity |
| 2:35–3:00 | Under the hood: model-run log (Spark Standard, Image, SAM, Spark Open if live), asset manifest, what was built during the event, synthetic data disclosure |

---

## 7. Budget ($150 Meta credit)

| Bucket | Estimate | Cap |
|---|---|---|
| Muse Code dev (contributor, synthetic data only) | $10–25 | $40 |
| Art: ~150–300 images incl. iterations + SAM | $2–4 | $10 |
| Runtime + rehearsals (Spark Standard, live Studio) | $5–15 | $30 |
| Reserve | | $70 |

Set a Billing spend alert at $100. Credits aren't the bottleneck; avoid running Muse Wonder or Standard Spark in long Muse Code sessions.

---

## 8. Decisions needed from you

1. Approve the re-scope in §4, especially the **Vibe Zone simplification** (no model-authored code) and **cutting RAG/wiki, PDF variants and admin**.
2. Confirm the five pack names: Dreamlight, Anime Sky, Toon Pop, Idol Stage, Terrarium.
3. Create a **Model API key** at dev.meta.ai (Standard) and export `MODEL_API_KEY` so the production art script and app runtime work. Muse Code's device login doesn't give Claude Code API access.
4. Hosting: Vercel (recommended) or Render.
5. `git init` and a public GitHub repo name. Commit early so judges can see event-built history.
6. Approve the Kix base design. Pick one of today's samples as the direction for `kix-base.png`; the 3D cartoon one is the cleanest to use as a reference.
7. Junior demo topic: keep P4 Light and shadows as the main quest, with the critter quest as the second junior world (current plan)? Or add P3 Science (life cycles, classification) as an enrolment so the critter quest matches the youngest's own syllabus? The second costs about 1h more in fixtures.
