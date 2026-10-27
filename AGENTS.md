# myKx — agent rules

Shared by **Muse Code** (reads this file) and **Claude Code** (`CLAUDE.md` imports it). Keep it short; details live in skills and `docs/`.

## Project

myKx gives every Singapore student an AI sidekick, **Kix**: learning loops that adapt, a magical Treasure Realm, a Vibe Zone creative studio, and an evening parent summary. Built for the Meta Global AI Developer Hackathon (track: Build for Your World).

- **Deadline:** 5 Nov 2026 10:00 SGT (4 Nov 21:00 EST). Target submit 4 Nov 22:00 SGT. Feature freeze 2 Nov 22:00 SGT.
- **Priority order:** (1) visually stunning demo path → (2) the core loop works honestly (learn → mastery → Treasure → parent summary) → (3) breadth. Features can be thin. Visuals cannot be.
- **Scope:** `docs/prd/PRD_REVIEW.md` §4 overrides `docs/prd/myKx_PRD.md` wherever they differ.
- **Schedule and what to build next:** `docs/plan/IMPLEMENTATION_PLAN.md` (day-by-day tracks, checkpoints, cut order). If it disagrees with the PRD review, the plan wins.

## Single source of truth

- `docs/README.md`: index of every reference doc. Start there.
- `.agents/skills/`: all project skills (Muse loads this natively; `.claude/skills` is a symlink to it). Add new skills here only.
- `docs/design/explorations/`: approved art-direction samples.

## Skills, and when to load them

| Skill | Load when |
|---|---|
| `mykx-design-system` | any UI, styling, motion or art decision (wins conflicts) |
| `frontend-design` | planning and critiquing a new screen or a restyle |
| `ui-ux-pro-max` | lookups only (never `--design-system`/`--persist`): `python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<q>" --domain <d>` |
| `muse-image-assets` | generating, editing or cutting out any image; Sidekick Studio code |
| `meta-model-api` | any code that calls a Meta model; model choice; cost |

## Hard rules

1. **Child data → Standard models only** (`muse-spark-1.3`, never `-contributor`). Contributor mode lets Meta train on prompts. Muse Code dev sessions run contributor, so use synthetic fixtures only and never real children's work or names.
2. **Original art only.** Never name or imitate real franchises, characters, studios, artists, idols or brands in prompts, art or copy. Never take a child's photo as image input.
3. **Keys are server-side only** (`MODEL_API_KEY`/`META_API_KEY`, `BASETEN_API_KEY`, Supabase service key). Never in client bundles, logs or git.
4. **No model-authored code is executed.** Vibe Zone renders a validated JSON spec with trusted React components.
5. **Mastery and rewards are deterministic** (PRD §6, §5 FR10). Models narrate and hint; they never change scores. No random rewards, loot boxes, rankings or money.
6. **Every kept generated asset goes in `public/art/manifest.json`** (prompt, model, refs, hash, date).
7. **Demo path never depends on live generation.** Cached fallback for every generated surface.
8. **Honest labels:** synthetic data, cached art and "limited evidence" are labelled in the UI and the video.
9. Don't commit or push unless the user asks.

## Default division of work (two agents, one repo)

- **Claude Code:** app UI, theme engine, motion, Treasure Realm, screen polish (screenshot → critique → fix).
- **Muse Code:** art generation rounds (`image_generation` tool), Meta API adapters and smoke tests, fixtures and content.
- Work in separate branches or worktrees and merge often. Before editing a file the other agent owns, say so in the commit message.

## Stack (planned, not yet scaffolded)

Next.js (App Router, TypeScript) · Tailwind CSS v4 + CSS custom-property themes · `motion` · Supabase (Auth, Postgres + RLS, Storage) · OpenAI SDK pointed at `https://api.meta.ai/v1` · Vercel (pending decision).

## Commands

Not scaffolded yet. Add build/test/dev commands here as soon as they exist.
