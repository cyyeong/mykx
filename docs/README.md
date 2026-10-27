# myKx reference hub

One index for humans and agents. If a reference isn't linked here, it isn't canonical.

## Product

> **Names:** the founder's children appear in this repo only as **Leonard** (Sec 2), **Abby** (P6) and **Jordan** (P3). These are stand-in names, not their real names. The real names stay in the git-ignored `content-private/names.json`; the skill importer swaps them for the stand-ins on read (`lib/skills/private-names.ts`).

| Doc | What it is |
|---|---|
| [prd/PRD_REVIEW.md](prd/PRD_REVIEW.md) | **Current scope and plan.** Gaps, enhancements, re-scope, day plan, video, budget. Overrides the PRD where they differ. |
| [plan/IMPLEMENTATION_PLAN.md](plan/IMPLEMENTATION_PLAN.md) | **The build schedule.** Hour budget, demo-path scope, architecture, workstreams, day-by-day exits, video plan, cut order. |
| [prd/SKILL_ENGINE.md](prd/SKILL_ENGINE.md) | **Skill Engine and skills admin.** Skill pack format, unified item schema, agents that load and unload skills via `tool_search`, upload → review → publish, privacy and copyright rules. |
| [prd/PARENT_INSIGHTS.md](prd/PARENT_INSIGHTS.md) | **Parent dashboard, wellbeing signals, flags and family messages.** Signal sources, flag levels and the safety path, Kix stickers, privacy rules. |
| [prd/ACCOUNTS.md](prd/ACCOUNTS.md) | **Sign-in and accounts.** Parents and admins by email, kids by door with a picture code or password; the living-city door login and time tunnel; Your family, Me, admin People; rules. |
| [prd/GAMES.md](prd/GAMES.md) | Game Arcade (proposed): learning games that follow each child's syllabus, starting with a touch-typing game with ghost hands; designs in canvas row 10 |
| [prd/myKx_PRD.md](prd/myKx_PRD.md) | Original PRD (26 Oct). Still canonical for the mastery maths (§6), reward ethics (FR10), parent summary rules (FR07) and data model (§9). |

## Design

| Doc | What it is |
|---|---|
| [../.agents/skills/mykx-design-system/SKILL.md](../.agents/skills/mykx-design-system/SKILL.md) | Theme engine (band × pack), style packs, Treasure Realm spec, motion, a11y and perf gates |
| [design/responsive-screens.md](design/responsive-screens.md) | How every screen adapts to phone, foldable, tablet and desktop (rules in the design skill §3a) |
| [design/living-scenes.md](design/living-scenes.md) | Backgrounds kids can poke: lamp, drawer, window, terrarium glass, singing lanterns (rules in the design skill §4a) |
| [design/explorations/](design/explorations/) | Muse Image art-direction samples (27 Oct) and their prompts |

## Claude Design (claude.ai)

| Artifact | What it is |
|---|---|
| [myKx design system](https://claude.ai/artifact/Jyr5pven8EDiRRfqAZDYuX) | Five style-pack themes, two bands, tokens, fonts, Button / QuestNode / HoloCard, brand marks, all Muse Image art by group. Agents read its `project/README.md` and `project/tokens.json`. |
| [myKx Screens](https://claude.ai/artifact/8crEyKVQm9QxCHLDqPXioP) | Design canvas: Sidekick Studio, quest map, question and reward, Treasure Realm, teen study deck, parent summary, Critter Lab, Sky Squadron. |

Art source of truth stays in the repo: `public/art/` (optimised WebP) and `public/art/manifest.json` (prompts, refs, hashes). Originals are in `docs/design/explorations/`.

## Engineering

| Doc | What it is |
|---|---|
| [../AGENTS.md](../AGENTS.md) | Agent rules, priorities, hard rules, division of work (`CLAUDE.md` imports it) |
| [../.agents/skills/meta-model-api/SKILL.md](../.agents/skills/meta-model-api/SKILL.md) | Meta Model API: model IDs, Standard vs Contributor, structured output, SAM, Baseten, pricing |
| [../.agents/skills/muse-image-assets/SKILL.md](../.agents/skills/muse-image-assets/SKILL.md) | Art pipeline: Kix canon, pack prompts, IP/safety rules, SAM cutouts, manifest, budget |

## Vendored third-party skills

| Skill | Source | Licence |
|---|---|---|
| `ui-ux-pro-max` v2.15.0 | github.com/nextlevelbuilder/ui-ux-pro-max-skill @ `28b3b8d` (26 Oct 2026); tests removed, script paths made repo-relative, description scoped to lookup-only (see note at top of its SKILL.md) | MIT |
| `frontend-design` | anthropics/claude-plugins-official `plugins/frontend-design` | Apache-2.0 |

## External

- Hackathon guide (saved copy): `~/Downloads/Details – Meta Global AI Developer Hackathon – Cerebral Valley (26_10_2026 23：17：25).html`
- Meta docs: https://dev.meta.ai/docs/overview · models https://dev.meta.ai/docs/models · pricing https://dev.meta.ai/docs/pricing-rate-limits
- Baseten chat completions: https://docs.baseten.co/reference/inference-api/chat-completions (model alias `meta-models/muse-spark-open-1026`)
