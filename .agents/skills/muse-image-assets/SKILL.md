---
name: muse-image-assets
description: Generate, edit, cut out and catalogue myKx art with Meta Muse Image (muse-image-1.0) and SAM 3.1 — mascot (Kix) variants, style-pack backgrounds, Treasure collectible cards, Vibe Zone art, sticker cutouts. Load before generating or editing any image, writing a prompt for art, adding a file under public/art, or building the in-app Sidekick Studio generation flow. Covers the two generation routes (Muse Code image_generation tool vs. direct API script), the Kix canon, per-pack prompt suffixes, IP/child-safety rules, the asset manifest, optimisation and budget.
---

# Muse Image assets

Muse Image costs **$0.01 per image**. Failed or safety-filtered images are not billed, and the rate limit is 150 RPM. Credits are not the constraint. Consistency, safety and dev time are.

## Two routes

| Route | Use for | Control | How |
|---|---|---|---|
| **A. Muse Code `image_generation` tool** | fast exploration, art-direction rounds | prompt + optional `image_paths` (edit/compose). **No size control:** it returned 1920×1280 JPG for every request on 27 Oct, even when asked for 1024×1024 | `muse exec --reasoning-effort low --prompt-file p.txt` in a trusted workspace; files land in `./generated_images/` |
| **B. Direct API script** | final production assets, exact sizes, n>1, reference edits | `size` (`"WxH"` sets aspect ratio), `n` 1–10, `output_format` webp/png/jpeg, reference images (≤10) | `node .agents/skills/muse-image-assets/scripts/gen-image.mjs …` (needs `MODEL_API_KEY`) |

**Default is route B** (Claude Code is the only coding agent and has no image tool). Route A is optional, for loose exploration only.

Route B request shape (from dev.meta.ai docs):
- Generate: `POST https://api.meta.ai/v1/images/generations` `{model:"muse-image-1.0", prompt, n, size, response_format:"b64_json", output_format:"webp"}` → `data[].b64_json`
- Edit/compose: `POST /v1/images/edits` with JSON `{model, prompt, images:[{image_url:"data:image/png;base64,…"}]}` (1–10 items; each item has `image_url` or `file_id`)
- Multi-turn refinement: Responses API with `previous_response_id`
- **No transparent backgrounds** (`background` is always `opaque`). For stickers, see "Cutouts".

## Kix canon (keep identical in every prompt)

> Kix: an ORIGINAL small sidekick creature — a round, soft five-point star-shaped sprite with a glowing four-point sparkle on its forehead, big friendly dark eyes with highlights, small rosy cheeks, gentle smile, stubby arms, soft lavender body fading to mint at the bottom.

Text-only prompts drift: shape, texture and eye style varied across the 27 Oct samples. Once the base is approved:
1. Save the approved base as `public/art/kix/kix-base.png` (plain background, front view, full body).
2. Generate **every** Kix variant via edits with `kix-base.png` as `images[0]` and the prompt "The same character as in the image, identical shape, proportions and face; restyle as …". Add **"exactly one character, no other creatures or copies"**: in the 27 Oct live smoke test the Terrarium edit added a second, smaller Kix.

## Pack prompt suffixes

Append one suffix to the subject prompt. Pack definitions live in `mykx-design-system` §2.

- **dreamlight:** "dreamy magical twilight fantasy illustration, pastel lavender, mint and peach light, soft bokeh, glowing stars, gentle aurora, painterly, calm"
- **anime-sky:** "modern Japanese anime key-visual style, cel shading, crisp clean line art, dramatic sky with light rays, floating petals and light motes"
- **toon-pop:** "chunky playful 3D cartoon render, soft clay and vinyl toy materials, rim light, pastel studio backdrop, high-quality animated-feature look"
- **idol-stage:** "original K-pop-inspired concert stage aesthetic, neon magenta and cyan beams, holographic iridescent materials, lightstick glow, confetti, glossy poster lighting"

- **terrarium:** "lush miniature terrarium world, moss, ferns, smooth pebbles, a lily-pad pond, sparkling dewdrops, warm amber sunlight through glass, soft picture-book 3D illustration"
- **critters (any pack):** real species only (ants, mealworm beetles, geckos, tree frogs, tadpoles); "scientifically accurate for its life stage, friendly cute picture-book style, not gross, not scary". Life-cycle sheets: "four separate stages evenly spaced left to right in one row on a plain flat pale cream background, no arrows, no text".

- **jets (Sky Squadron):** "ORIGINAL sleek display jet inspired by a <insect>, with a real <insect> flying alongside as a cameo, thrilling cinematic stunt flight, glossy semi-realistic 3D render". Always add "no weapons, no missiles, no guns, no military or national insignia, no flags, no registration numbers, do not copy any real aircraft model or any film".

Always add: "no text, no letters, no logos, no watermark". For UI backgrounds also add: "calm uncluttered negative space in the centre for interface overlay".

## Safety and IP rules (hard)

- Original characters only. Never name or reference an existing character, franchise, studio, artist, idol, group, celebrity or brand. Use aesthetic words, not names.
- Never generate real people or children's likenesses. **Never accept a child's photo as input.** Personalisation comes from chips (pack, interests, colour).
- In-app generation is **server-side only**, built from a fixed template plus allow-listed chips. Junior band gets no free text. Teen band may add ≤ 40 chars of "flair", which Muse Spark (Standard) screens before use.
- In-app calls use the Standard API key and never send child names or personal data in prompts.
- Handle refusals and safety filtering: show the cached pack default and log it. Never retry-loop.

## Cutouts (transparent stickers)

1. Generate on a plain, contrasting, single-colour background ("isolated on a plain flat light-grey background").
2. SAM 3.1 via `POST /v1/responses`, `model:"sam-3.1"`, content `[input_text "plush toy", input_image <data URL>]`. Prompt with a short, common noun phrase. Tested live on 27 Oct: "plush toy", "toy" and "cartoon character" all find Kix (use `select: "best"` when there are several); "star-shaped mascot" finds nothing; "star" finds only the forehead sparkle. The response gives boxes plus one-bit masks; decode with `@meta-sam/parser` `decodeMaskToRaster` → `Uint8Array` W×H.
3. Use the mask as the alpha channel (sharp/canvas), feather 1–2px, crop to the box, and export WebP with alpha. SAM costs $0.0025 per image and took 4–5 s live. **SAM treats accessories as separate objects:** "plush toy" drops a leaf garland or a held pencil, leaving holes through the body. Recipe, tested 27 Oct: ask SAM for the body ("plush toy", `select: "best"`) and, in parallel, for one concrete noun per accessory the edit prompt asked for ("garland", "hat", "magnifying glass"). Union the accessory masks whose boxes touch the body's box (5% margin). Broad nouns don't work: "leaves" also catches background ferns, and "scarf" found nothing because the model drew a garland. `cutoutFromMasks` also fills fully enclosed holes by default. Muse Image edits sometimes add a second, smaller copy of the character (2 of 3 live runs), so select the largest body mask. **Validated end to end on 27 Oct** in `lib/studio/transform.ts`: accessories chosen to sit ON Kix (hat, goggles, magnifying glass; see `lib/studio/prompt.ts`) all came back in the union, giving a clean sticker in 23.4 s.
4. Fallback if SAM fails: circular or blob-frame the image with a CSS mask. Never ship a grey box.

## Asset manifest (provenance, required)

Every kept asset gets an entry in `public/art/manifest.json`:

```json
{ "id": "kix-idol-stage", "path": "public/art/kix/idol-stage.webp", "pack": "idol-stage",
  "kind": "kix|background|card|sticker|vibe", "model": "muse-image-1.0", "route": "api|muse-code",
  "prompt": "…full prompt…", "refs": ["public/art/kix/kix-base.png"], "size": "1792x1024",
  "created": "2026-10-27", "sha256": "…", "cut_by": "sam-3.1|null" }
```

The manifest supports the hackathon requirement to show rights-cleared assets built during the event, and it feeds the demo's "under the hood" slide.

## Optimise before committing

- Backgrounds: WebP q≈80, 1920w plus a 960w variant, ≤ 300 KB. Cards: 768w ≤ 120 KB. Stickers: WebP with alpha ≤ 120 KB.
- `npx sharp-cli` or `cwebp`. Keep originals out of git (`art-src/` is gitignored); commit the optimised files and the manifest.

## Production asset list (generate once, cache)

| Set | Count | Notes |
|---|---|---|
| Kix base + 4 pack variants | 5 | edits from base |
| Kix expressions (idle, thinking, hint, cheer) × 4 packs | 16 | edits from each pack variant; cut out with SAM |
| Pack backgrounds: home + learn map/deck | 8 | 1792×1024, centre negative space |
| Treasure vault per pack | 4 | Dreamlight first |
| Collectible cards: demo topics × packs | ~12 | P4 Light & Shadows, Sec 3 Forces |
| Vibe Zone flashcard/planner art | ~8 | |

That is about 55 images, roughly $0.55. Expect 3× that with iteration, which is still under $2.

## Budget guard

- Exploration: ≤ 100 images/day. Log each batch in the manifest or in `docs/design/explorations/prompts-*.txt`.
- Runtime (Sidekick Studio): ≤ 3 generations per child per day, cached by `(pack, chips, template_version)` hash.
