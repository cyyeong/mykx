# Licensing

myKx is open source with two licences: one for the code, one for the art and learning content.

## Code: MIT

Everything not listed below (app, API, scripts, tests, database files, design boards as code, docs) is under the MIT License in [LICENSE](LICENSE).

## Art, Kix and learning content: CC BY-NC 4.0

These are licensed under [Creative Commons Attribution-NonCommercial 4.0 International](https://creativecommons.org/licenses/by-nc/4.0/) (CC BY-NC 4.0): share and adapt them with credit, not for commercial purposes.

- Kix, the myKx sidekick, in any form or style
- all images in `public/art/`, `art-src/` and `docs/design/explorations/`
- the skill packs in `content/skills/` (questions, passages, figures, references)

The synthetic home-camera frames in `public/art/sim/` (and the Home simulator's copy of them) are Muse Image art of fictional characters in a made-up flat, one with SAM 3.1 outlines drawn on it. They show no real person or home and are labelled "Synthetic" wherever they appear.

The author's avatar and family portrait at the end of the README (`docs/readme/author.webp`, `docs/readme/family.webp`) are the founder's own pictures, under the same licence.

Credit as: "myKx by cyyeong (https://github.com/cyyeong/mykx), CC BY-NC 4.0".

Most art was made with Meta's Muse Image and cut into layers with SAM 3.1; `public/art/manifest.json` records the prompt and model for each file. These rights apply only as far as the authors hold rights in that art.

The names "myKx" and "Kix" are not licensed for use as trademarks (CC BY-NC 4.0 grants no trademark rights; the MIT License grants none either).

## Third-party files (their own licences)

| What | Where | Licence |
|---|---|---|
| Fonts: Fredoka, Grandstander, Lilita One, M PLUS Rounded 1c, Nunito, Outfit, Unbounded | `public/fonts/`, `docs/design/boards/ds/mykx/fonts/` | SIL Open Font License 1.1 (`OFL.txt` in each folder) |
| Twemoji word icons in the P3 Chinese pack | `content/skills/p3-chinese/figures/` | CC BY 4.0, Twitter, Inc. and other contributors (credited in that pack's `skill.json`) |
| Map tiles on the parent's Location map | loaded from OneMap, not stored | © Singapore Land Authority; OneMap's logo and credit are shown as its terms require |
| Leaflet 1.9.4 (map library) | npm `leaflet` | BSD-2-Clause |
| Country flags on the roadmap image (22 countries) | `docs/readme/roadmap.webp` | MIT, flag-icons 7.2.3 by Panayiotis Lipiridis |
| `ui-ux-pro-max` skill | `.agents/skills/ui-ux-pro-max/` | MIT (its `LICENSE`) |
| `frontend-design` skill | `.agents/skills/frontend-design/` | Apache-2.0 (its `LICENSE.txt`) |

npm dependencies keep their own licences and are not stored in this repository.
