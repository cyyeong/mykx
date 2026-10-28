# myKx — agent rules

Read by the coding agent, **Claude Code** (`CLAUDE.md` imports it); Muse Code read it too while it was in use on 28 Oct. Keep it short; details live in skills and `docs/`. Start a work session with `docs/plan/HANDOFF.md` and `docs/plan/PROGRESS.md`.

## Project

myKx gives every Singapore student an AI sidekick, **Kix**: learning loops that adapt, a magical Treasure Realm, a Vibe Zone creative studio, and an evening parent summary. Built for the Meta Global AI Developer Hackathon (track: Build for Your World).

- **Deadline:** 5 Nov 2026 10:00 SGT (4 Nov 21:00 EST). Target submit 4 Nov 22:00 SGT. Feature freeze 2 Nov 22:00 SGT.
- **Priority order:** (1) visually stunning demo path → (2) the core loop works honestly (learn → mastery → Treasure → parent summary) → (3) breadth. Features can be thin. Visuals cannot be.
- **Scope:** `docs/prd/PRD_REVIEW.md` §4 overrides `docs/prd/myKx_PRD.md` wherever they differ. The Skill Engine and skills admin are specified in `docs/prd/SKILL_ENGINE.md`. MVP levels: P3, P6 and Sec 2.
- **Schedule and what to build next:** `docs/plan/IMPLEMENTATION_PLAN.md` (day-by-day tracks, checkpoints, cut order). If it disagrees with the PRD review, the plan wins.

## Single source of truth

- `docs/README.md`: index of every reference doc. Start there.
- `.agents/skills/`: all project skills (Muse loads this natively; `.claude/skills` is a symlink to it). Add new skills here only.
- `docs/design/explorations/`: approved art-direction samples.
- `LICENSE` (code, MIT) and `LICENSE-ASSETS.md` (art, Kix and content: CC BY-NC 4.0; third-party files). Never add a third-party file without its licence.

## Skills, and when to load them

| Skill | Load when |
|---|---|
| `mykx-design-system` | any UI, styling, motion or art decision (wins conflicts) |
| `frontend-design` | planning and critiquing a new screen or a restyle |
| `ui-ux-pro-max` | lookups only (never `--design-system`/`--persist`): `python3 .agents/skills/ui-ux-pro-max/scripts/search.py "<q>" --domain <d>` |
| `muse-image-assets` | generating, editing or cutting out any image; Sidekick Studio code |
| `meta-model-api` | any code that calls a Meta model; model choice; cost |
| `past-paper-scout` | crawling, downloading or adding past papers; the paper allowlist; feeding papers into a skill pack |

## Hard rules

1. **Child data → Standard models only** (`muse-spark-1.3`, never `-contributor`). Contributor mode lets Meta train on prompts. Muse Code defaults to contributor, so if it's used, give it synthetic data only and never real children's work or names.
2. **Original art only.** Never name or imitate real franchises, characters, studios, artists, idols or brands in prompts, art or copy. Never take a child's photo as image input for generation (Studio, art). The one exception to reading children's images is Home watch (rule 15).
3. **Keys are server-side only** (`MODEL_API_KEY`/`META_API_KEY`, Supabase service key). Never in client bundles, logs or git.
4. **No model-authored code is executed.** Vibe Zone renders a validated JSON spec with trusted React components.
5. **Mastery and rewards are deterministic** (PRD §6, §5 FR10). Models narrate and hint; they never change scores. No random rewards, loot boxes, rankings or money.
6. **Every kept generated asset goes in `public/art/manifest.json`** (prompt, model, refs, hash, date).
7. **Demo path never depends on live generation.** Cached fallback for every generated surface.
8. **Honest labels:** synthetic data, cached art and "limited evidence" are labelled in the UI and the video.
9. **Voice is child data.** Push-to-talk only, never always listening; clips ≤ 30 s; audio is never stored or logged (keep the transcript only, like typed text); a parent can turn voice off per child. Meta has no TTS: Kix speaks with the browser's `speechSynthesis`, and the UI says so.
10. **Skill packs are child-agnostic and original.** Never put a child's name, traits, diagnoses or progress in `content/skills/`; those live in the learner record (database) and Kix's Notebook. Raw source skills and the real-name map live outside this repository and are off limits: never look for them, ask for them or copy from them. Questions from school or exam papers are never committed or served to children; only derived archetypes and statistics are. The app never executes scripts that come inside a skill. The founder's children are named only by their stand-ins (Leonard, Abby, Jordan; not their real names) anywhere in git, in art and in the video.
11. **Progress is in the database; memory is in the Notebook.** Kix's Notebook (an LLM wiki per child) holds personality, asking patterns, language slips, events and memorable moments. It may quote mastery with a date but never stores or changes it. The Memory Keeper writes patch operations only, never labels or diagnoses a child, and every change is a revision the parent can edit or wipe. No RAG: agents read skill references and Notebook pages by id through tools.
12. **Wellbeing signals are care, not surveillance.** Show them to the parent only, as "possibly …" with evidence and confidence against the child's own baseline; never diagnose or label. No face image or video ever leaves the device: camera signals are on-device counts behind a parent toggle with a visible indicator; the only thing kept is a few seconds of face-outline points per counted moment, on that device for 7 days, so the parent can replay it as a line drawing and mark it right or not right. Mood comes only from the child's words to Kix (Standard models), apart from Home watch's visible-behaviour cues (rule 15). Family messages never reach Kix or a language model (a voice reply is only transcribed, and its audio discarded). Distress or safety words always trigger Kix's caring reply, the helplines (Tinkle Friend 1800 274 4788, SOS 1767) and an urgent parent flag. Signals never change mastery or rewards.
13. **Kids never need an email.** Kids sign in with a picture code or password set by a parent, hashed on the server and never shown again; nicknames, never full names. Admin actions go through audited server routes and never expose a child's messages, Notebook or answers.
14. Don't commit or push unless the user asks.
15. **Guardian is care, not surveillance** (founder, 28 Oct; `docs/prd/GUARDIAN.md`). Location and Home watch are parent-installed and opt-in; the child always sees a chip when they're on (a teen may pause location for 30 minutes, and the parent is told). Home watch frames from the family's own cameras are read by Muse Spark (Standard) for safety status, and SAM 3.1 outlines the people on flagged frames: never used for generation, never stored except flagged frames for 24 h; web searches (outing ideas) carry only the home area, interests and dates, never a child's name, age or location; status rows 14 days, location 30 days. Children get *visible* behaviour cues only, as "possibly"; a child may be named only from the parent's own descriptions (no face templates); adults are never named, tracked or read for mood. No cameras in bathrooms or any bedroom. Guardian data never reaches Kix, the tutor or the Notebook, and never changes mastery or rewards. Every alert needs the parent's review (Right / Not right). The video uses synthetic frames and routes only.
16. **Docs follow the code** (founder, 28 Oct). Any architectural change updates the docs in the same commit: `docs/ARCHITECTURE.md` for a new or changed agent, model, prompt contract, route, table, data flow, device input, skill-pack format, self-improvement loop, budget, cached fallback or privacy and retention rule; the matching spec too (`docs/prd/SKILL_ENGINE.md`, `docs/prd/GUARDIAN.md`, `docs/prd/PARENT_INSIGHTS.md`…), `lib/admin/hood.ts` when an agent is added or changed, and `docs/README.md` for any new doc. A change isn't done until its docs say what the code does.

## Division of work (Claude Code only, from 28 Oct afternoon)

- **Claude Code** (Anthropic) builds everything: app features from `docs/plan/HANDOFF.md`, the Claude Design canvas (only it can publish there; copies of every board are in `docs/design/boards/`, the game boards' sources in `docs/design/canvas-src/`), the checks, docs and commits.
- **Muse Code** (Meta's coding agent) built four branches on 28 Oct (kid nav, learning loop, music, grown-ups); Claude Code reviewed and fixed them on main. The founder retired it the same day; don't hand it work. `.museignore` stays in case it is ever used again. The app itself still runs on Meta's models (Muse Spark, Muse Image, SAM 3.1, Muse Voice Transcribe): those are product features, not coding agents.
- Every finished task adds a row to `docs/plan/PROGRESS.md`.
- **Trail in commits:** every commit ends with `Agent: Claude Code` and Claude Code's Co-Authored-By line (older commits may carry `Agent: Muse Code`). Commit only when the founder has said to.
- Code areas, for splitting work: **UI** (`app/(kid)`, `app/(parent)`, `components/`, theme, motion), **platform** (`lib/meta`, `app/api`, `supabase/`, `lib/domain`, `lib/auth`, `lib/signals`, fixtures, art), **skills** (`lib/skills/`, `content/skills/`, `scripts/import-skill.ts`, `app/(admin)/`, `/api/kix/tutor`, `/api/admin/*`; spec in `docs/prd/SKILL_ENGINE.md`), **games** (`lib/games/`, the Arcade; spec in `docs/prd/GAMES.md`), **print** (`lib/print/`, `components/papers/`).
- **Art:** generate with `node --env-file=.env.local .agents/skills/muse-image-assets/scripts/gen-image.mjs …` (needs the Meta key, so Claude Code or the founder runs it); every kept file goes in the manifest (rule 6). Living-art layers come from `scripts/living-art.ts`.

## Stack

Next.js 16.4 (App Router, TypeScript, Cache Components on) · Tailwind CSS v4 + CSS custom-property themes · `motion` · Tone.js (synthesised sound, lazy-loaded) · Supabase (Auth, Postgres + RLS, Storage) · OpenAI SDK pointed at `https://api.meta.ai/v1` · Vercel.

## Commands

- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test` (Vitest)
- Scripts that need keys: `node --env-file=.env.local scripts/<name>.ts` (Node 24 runs TypeScript directly).
- Dependencies are pinned to exact versions: install with `npm install --save-exact`.
- Port a canvas board (first pass, then finish by hand): `node scripts/port-board.ts docs/design/boards/<Board>.dc.html <Name>Screen components/screens/<name>` (blob ids map through `docs/design/canvas-blob-map.json`; `--map` overrides).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
