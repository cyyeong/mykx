# Progress and tool trail

Who built what, with which tool, and where it landed. Every agent adds a row when it finishes a piece of work (one row per commit or per finished task), so the trail stays complete for the judges and the video ("how myKx was built").

## Tools

| Tool | Maker | Used for |
|---|---|---|
| **Claude Code** (Opus) | Anthropic | Coding agent from 27 Oct: app, API, database, tests, scripts, docs; drives the Claude Design canvas and the Meta model calls below |
| **Claude Design** (canvas) | Anthropic | Screen designs and prototypes, about 30 boards ([canvas](https://claude.ai/artifact/8crEyKVQm9QxCHLDqPXioP), private; copies in `docs/design/boards/`) |
| **Muse Code** | Meta | Art-direction round on 27 Oct (31 images); coding agent from 28 Oct |
| **Muse Image 1.0** | Meta | All original art: backgrounds, Kix in five styles, cards, jets, critters, doors (44 images) |
| **SAM 3.1** | Meta | Kix cutouts in the Studio transform; living-art layers (leaves, clouds, islands, waterfalls, critter eyes); 68 cutouts |
| **Muse Spark** | Meta | Smoke tests; the planned tutor hints, evening summary and Notebook (Standard mode only) |
| **Muse Voice Transcribe** | Meta | Push-to-talk with Kix (`/talk`); audio never stored |
| sharp | open source | Living-art layers from the art's own pixels (neon lines, stars, haze), and the filled-sky plates (40 files, no model) |
| Supabase, Vercel | — | Sign-in, database with row-level security; hosting at https://mykx.vercel.app |
| Playwright | open source | Screenshots, frame-difference motion checks, flicker traces, PDF checks |

## Trail

Dates are SGT. "Agent" is who did the work; "Tools" are the models and services it used.

| Date | Work | Agent | Tools | Commit | Video moment |
|---|---|---|---|---|---|
| 27 Oct | PRD review, plan, design system, first art | Claude Code | Muse Image, Claude Design | `db8d39d` | |
| 27 Oct | Art-direction round: Kix styles, Treasure vault, cards, jets | Muse Code | Muse Image | `db8d39d` | Kix in five worlds |
| 27 Oct | Next.js scaffold, theme engine, Sidekick Studio picker | Claude Code | — | `4860d1d` `cee008e` | Studio re-skin |
| 27 Oct | Meta model client and live smoke test (Spark, Image, SAM, Voice) | Claude Code | Muse Spark, Muse Image, SAM 3.1, Muse Voice Transcribe | `34774ea` `26158cd` | Under the hood |
| 27 Oct | Skill Engine, Notebook, parent insights and messages in the PRD | Claude Code | — | `1d31d86` `69ae43b` | |
| 27 Oct | Responsive boards for phone, foldable, tablet, desktop | Claude Code | Claude Design | `cce33dc` | |
| 27–28 Oct | Sign-in (door, time tunnel, kid doors), accounts, Supabase schema and RLS, mastery and rewards engine, soak test | Claude Code | — | `3c16a0b` | The door opens |
| 27–28 Oct | Seven child-agnostic skill packs, importer, safety scanner, 62 redrawn figures | Claude Code | — | `7ac067c` | |
| 27–28 Oct | Kid screens, living scenes with easter eggs, living art on every background, typing engine | Claude Code | Muse Image, SAM 3.1, Claude Design | `fc54578` | Waterfalls flow, islands float |
| 27–28 Oct | Game Arcade boards (Star Typer, Word Garden, Neon Strike, typing path) with numbered ghost hands | Claude Code | Claude Design, SAM 3.1 | `fc54578` | Ghost hands |
| 28 Oct | Founder approved 110 questions; synthetic-data label | Claude Code | — | `844530a` | |
| 28 Oct | Teen sign-in light beams, picture names on the code pad | Claude Code | SAM 3.1 | `8cbcb11` | |
| 28 Oct | 40 original P6 Maths questions (founder approved) | Claude Code | — | `6f66a24` | |
| 28 Oct | User stories (157), journeys, navigation audit | Claude Code | — | `6f66a24` | |
| 28 Oct | Printable practice papers with answer guide (PDF) | Claude Code | — | `6f66a24` | Print a mock paper |
| 28 Oct | On-device focus camera (counts only; parent note) | Claude Code | Face landmarks in the browser (MediaPipe) | `6f66a24` | Kix suggests a break |
| 28 Oct | Navigation fixes: sign-in checks, not-found and error pages, admin sidebar, kid avatar menu | Claude Code | — | `6f66a24` | |
| 28 Oct | Handover to Muse Code: all canvas boards and game-board sources in the repo (canvas v41), private material outside the repo, `.museignore`, this trail, music brief | Claude Code | Claude Design | `ac1d1eb` | How myKx was built |
| 28 Oct | Licences: code MIT; art, Kix and skill packs CC BY-NC 4.0; font and icon notices | Claude Code | — | 85ead93 | |
| 28 Oct | The learning loop: Ari's quest is the reviewed P3 frog life cycle through selection; attempts route marks deterministically and pays the ledger under the daily cap; question player with next question, quest-complete page, leave confirm and card flight; map and Treasure read real mastery with evidence labels | Muse Code | Muse Spark | 33b6158 | |

## How to add a row

- A commit can't contain its own hash: write `(this commit)`, and replace it with the hash in your next commit.
- One row per finished task or commit: date (SGT), what changed in plain words, the agent (Claude Code or Muse Code), the models and services used, the short commit hash, and a video moment if it's worth showing.
- Name Meta models exactly as above, so the video can count them.
- Never write a child's real name, a secret or a key here.
