# myKx implementation plan

**Written:** Tue 27 Oct 2026, 10:30 SGT (Day 1). **Replaces** the day plan in `docs/prd/PRD_REVIEW.md` §5 and tightens its scope table (§4). **Updated** 27 Oct, 11:45: Claude Code is the only coding agent (was Claude Code + Muse Code). 27 Oct, 12:00: voice and sound added to the core, Study Song added as the first stretch (PRD_REVIEW E5, E6, E10). 27 Oct, 12:30: Skill Engine, Kix's Notebook (learner memory) and skills admin added as a third stream, C; no RAG; MVP levels are P3, P6 and Sec 2 (PRD_REVIEW E11, `docs/prd/SKILL_ENGINE.md`). 27 Oct, 13:15: every screen designed for mobile, foldable, tablet and desktop (design skill §3a, `docs/design/responsive-screens.md`). 27 Oct, afternoon: parent insights, wellbeing signals, flags and family messages added as a fourth stream, D (PRD_REVIEW E12, `docs/prd/PARENT_INSIGHTS.md`); Study Song moves to the roadmap, Sky Squadron becomes static, Vibe Zone drops version 2, the admin agents matrix becomes read-only. 27 Oct, 16:30: sign-in and accounts added (PRD_REVIEW E13, `docs/prd/ACCOUNTS.md`), paid for by work finished early on Day 1 and three small cuts. 28 Oct, 17:45: Guardian (location and home cameras) added as a sixth stream, F, paid for by the build running about two days ahead (`docs/prd/GUARDIAN.md`). Designs: [myKx Screens](https://claude.ai/artifact/8crEyKVQm9QxCHLDqPXioP) · [myKx design system](https://claude.ai/artifact/Jyr5pven8EDiRRfqAZDYuX).

## 0. The budget

- **Submit by Wed 4 Nov, 22:00 SGT.** The official deadline is Thu 5 Nov 10:00 SGT (4 Nov 21:00 EST); the morning of the 5th is for emergencies only.
- **8 hours of your time per day.** Claude Code writes all the code and runs the four workstreams below in parallel inside those hours; your time (deciding, reviewing, testing, filming) is the bottleneck, so the plan is sized to it.

| | Hours | When |
|---|---|---|
| Available: today from 10:30 (≈ 5h) + Wed 28 Oct to Wed 4 Nov (8 days × 8h) | **69** | |
| **Build** | 43.5 | Days 1–6 |
| Harden and freeze (bug bash, accessibility, security, rehearsal; absorbs slips) | 10.5 | Day 7, Day 8 morning |
| Video and submission (protected; never borrowed for features) | 12 | Days 5, 6, 8, 9 |
| Final buffer | 3 | Day 9 afternoon |

**Voice and sound (added 27 Oct)** are about 7 hours of agent work. They fit without moving the freeze: Day 1's head start (the Studio picker was done by midday) takes the sound engine, the teen deck becomes a static port (saves 1.5h), and the rest goes into spare stream capacity on Days 2, 5 and 6. Your hours don't change; the mic check joins the Day 2 tablet check.

**Skill Engine, Kix's Notebook and skills admin (added 27 Oct)** are about 25 hours of agent work. They run as a third stream, **C**, from Day 2 to Day 6 (4–5h a day) as a background subagent in its own worktree, and they replace two existing tasks: hand-written fixtures (Day 2, 2h) and the plain hint route (Day 4, 2h). Your added time is about 2 hours across the week (checking the scrub, approving the demo items instead of reviewing fixtures, testing the admin flow). The freeze, hardening and video hours don't move. The price is risk: three streams mean more merging, so the checkpoints now check C too, and C has its own cut line (§6).

**Parent insights and family messages (added 27 Oct)** are about 15.5 hours of agent work, run as a fourth stream, **D**, from Day 3 to Day 6. To keep the freeze, hardening and video hours, four things move out (about 4.5h back): Study Song goes to the roadmap slide, Sky Squadron becomes a static port, Vibe Zone drops version 2, and the admin agents matrix becomes read-only. Camera signals are a stretch. Your added time is about 1.5 hours (flag and safety wording, testing messages on two devices). **The build is now at capacity: anything new goes on the roadmap slide unless something else is cut.**

**Sign-in and accounts (added 27 Oct, 16:30)** are about 12.5 hours: B 4h (Supabase Auth for parents and admins, kids' hashed picture codes and passwords, the kid session cookie, rate limits, family and admin routes, `audit_log`) and A 8.5h (the living-city door login with the time tunnel, kid doors and sign-in, Your family, Me, admin People). They're paid for by about 8.5h of Days 2–5 work already finished on 27 Oct (sound engine, voice route, hold-to-talk and read-aloud, schema with RLS tests, the transform route, the board port script) plus three cuts of about 4h: Kix-suggested messages and voice-pace signals go, "Add knowledge" takes JSON and Markdown only (no PDF extraction), and the admin role switches become read-only.

**Game Arcade and the typing game (added 27 Oct evening)** are about 17.5 hours of agent work, run as a fifth stream, **E**, from Day 2 to Day 6 (`docs/prd/GAMES.md`; designs in canvas row 10). Nothing is cut for it: the founder adds dev time each day instead (about 1 extra hour of your time a day for reviewing and testing it). E owns `lib/games/`, `components/games/` and `app/(kid)/arcade/`; its cut line, if a checkpoint goes red, is Word Garden first, then Neon Strike's own skin (teens play Star Typer's engine in the teen colours). The ghost-hands keyboard is never cut.

**Guardian: location and home cameras (added 28 Oct, 17:45)** is about 24.5 hours of agent work (28.5 with the Android stretch), run as a sixth stream, **F**, from Wed 28 Oct evening to Sun 1 Nov (`docs/prd/GUARDIAN.md` §5). Nothing on the demo path is cut for it. It's paid for by the build running about two days ahead: by Wed 28 Oct afternoon most of the Day 3–6 list was done (PROGRESS.md). Your added time is about 3 hours: the rule changes (GUARDIAN §3), alert wording, a walk with the phone, and the Android stretch. F owns `lib/location/`, `lib/home-watch/`, `components/location/`, `components/home-watch/`, `app/(parent)/where/`, `app/(parent)/home-watch/`, `app/api/location/`, `app/api/home/`, `clients/home-link/` and `sim/`. **Gate:** nothing in F starts until you approve GUARDIAN §3. Its cut line (§6) protects hardening and the video.

**All form factors (added 27 Oct).** The canvas boards are now fluid pages with phone, foldable, tablet-portrait and desktop previews, so the port script carries the responsive rules into the app. The added build work is the app shell (bottom tab bar on phones, side rail from foldable width up, bottom sheets) at about 1h on Day 3, plus a device pass during hardening on Day 7 (2h, inside the existing hours). Each daily 30-minute test now includes one phone-width check.

## 1. What we ship: the video is the spec

If a feature isn't in the 3-minute video, it isn't in this build. Screens come straight from the canvas boards.

| Screen (canvas board) | Must work for real | Live Meta call | Allowed shortcut |
|---|---|---|---|
| Sidekick Studio: picker, transform, reveal | pack and interests saved; re-skin; Kix kept; Pip adopted | Muse Image edit with the Kix reference → SAM 3.1 cutout | 25 s timeout → cached pack Kix |
| Home | profile, today's quest, Pip's stage, squadron progress from data | — | — |
| Quest map | node states from mastery | — | fixed node positions on the art |
| Question and reward | marking, hints, attempts, mastery, reward card; questions come from the quest's published skill | Kix Tutor agent: Muse Spark on the Responses API, streamed, loading skills with client `tool_search` | 3 questions per quest |
| Treasure Realm | cards from the reward ledger | — | — |
| Critter Lab | Pip's stage from the ledger | — | frog is live; mealworm tab is display-only |
| Vibe Zone | brief (spoken or typed) → spec → flashcards → save → share/revoke | Muse Spark structured output; Muse Voice Transcribe | flashcards only (no planner, no version 2) |
| Talk to Kix (in Question and Vibe Zone) | hold-to-talk → transcript to confirm; Kix reads questions, hints and cards aloud with captions | `muse-voice-transcribe-1.0` | typed box if the mic is denied or the call fails; read-aloud uses the device's voice |
| Sound layer (every screen) | per-pack SFX, optional ambience, one mute | — (Tone.js in the browser) | ambience off by default; no sound for wrong answers |
| Parent dashboard (phone first) | screen time against the limit; plan adherence; focus, mood and hesitation per session with evidence; urgent, watch and info flags; tonight's summary; controls | Muse Spark structured output (mood and safety check inside the post-session call) | in-app flags only (no push); camera signals are stretch |
| Sign-in (all devices) | living-city door login; parents and admins by email; kids pick their door and enter a picture code (junior) or password (teen); the door opens into the time tunnel | — | reduced motion crossfades; kid sign-in on their own device is roadmap |
| Accounts | Your family (add kid, reset code, remove), Me (nickname, code), admin People (search, lock, reset, audit log) | — | admin role switches read-only |
| Family messages | parent ↔ child inside the household, Kix stickers, quick encouragements, the child's reply sheet with quick replies, stickers and voice | `muse-voice-transcribe-1.0` for voice replies only (no language model ever reads them) | Kix-suggested messages are a "should" |
| Teen study deck | seeded Sec 2 learner's numbers, labelled synthetic | — | static port |
| Skills admin (laptop): catalogue, skill detail, add knowledge, agents × skills | upload → extract → review → publish a version that Kix uses next session; load/unload trace | Muse Spark vision + JSON schema (Content Curator) | JSON and Markdown parse without a model; see C's cut line |
| Sky Squadron | flip cards (static port) | — | unlocks shown from seed data |
| Guardian: Out and about (parent's phone) | the kid's location while myKx is open (or from the Android app), battery modes, possibly still/walking/running/playing, Home and School arrive/leave, a OneMap map with the trail | — (no model needed) | the video's route comes from the Home simulator; Android background app is a stretch; iOS is roadmap |
| Guardian: Home watch (parent's phone; Home Link on a laptop) | up to 10 RTSP/ONVIF cameras → frames on an interval with a motion filter → status per room, timeline, watch and urgent alerts with frames, Right / Not right | Muse Spark (Standard) vision with a JSON schema, one call per tick | the video's frames are synthetic, played by the Home simulator (a second Vercel project) through the real ingest API; a cached status if a live call fails |

**Not in this build, and not in the video:** snap-homework ingestion (dropped from PRD_REVIEW §4: it isn't on the demo path, and the Studio already shows multimodal Meta use), PDF papers, a general RAG wiki, a full skills CMS (in-app SKILL.md editor, rollback, diffs), scheduler or worker, the planner template. (Phone and foldable layouts are now in: every screen works from 320 px to desktop.) Also out: realtime voice streaming (needs a WebSocket the browser can't open without exposing the key) and any Meta voice or music output (none exists; see the `meta-model-api` skill). **Guardian is in, as stream F** (GUARDIAN.md): web location, the map, Home watch with the Home Link client, and the simulator. Its own stretch is the Android background app; iOS, signed desktop installers and push are roadmap. **Stretch only, in this order:** Baseten Muse Spark Open tagging, then camera signals on the device (PARENT_INSIGHTS §1). **Roadmap slide:** Study Song (PRD_REVIEW E10), push and email notifications.

## 2. Architecture: the smallest thing that works

- **App:** Next.js (App Router, TypeScript), Tailwind CSS v4, `motion`. Exact versions pinned at scaffold (no `^`).
- **Look:** `tokens.css`, `bundle.css` and fonts copied from the design system. Screens are ported from the canvas `.dc.html` boards, which already use the same tokens and classes.
- **Data:** Supabase Auth (parent signs in with email and password; children are profiles in the household, chosen from the profile button), Postgres with row-level security by household, Storage for Kix cutouts.
- **Content:** skill packs are the source of quests, questions, hints, references and card sets. `content/skills/` holds the scrubbed packs imported from the founder's tutor skills; published versions live in the skill tables so admin uploads work in production. The raw source skills stay in a private folder outside the repo (`MYKX_PRIVATE_DIR`). Offline activities stay as fixtures. Spec: `docs/prd/SKILL_ENGINE.md`.
- **Meta:** OpenAI SDK pointed at `https://api.meta.ai/v1`, called only from server route handlers, Standard models only (see the `meta-model-api` skill).
- **Hosting:** one Vercel project; Supabase cloud free tier. No worker, queue or cron.

**Tables:** `households`, `profiles` (role incl. admin, band, level, pack, interests, kix_url, voice_enabled, learning notes), `attempts`, `ledger` (unique idempotency key), `creations` (versions in JSONB), `shares` (revoked_at), `summaries`, `model_runs`; skills: `skills` (id, version, manifest, method, references, is_current), `skill_items`, `skill_uploads` (rights, status), `skill_events`, `agent_policies`; memory: `notebook_pages`, `notebook_revisions` (Kix's Notebook, an LLM wiki per child; it may quote mastery but never stores the truth); family: `sessions`, `signals`, `flags`, `plans`, `messages`. **Tables: 20.**

**Pure, unit-tested domain code** (`lib/domain/`): marking, the mastery recompute from PRD §6, reward rules with the 15-a-day cap, companion stage, squadron unlocks. Models never write to these.

**The live AI calls (every one logs to `model_runs` for the "under the hood" shot):**

| Route | Model | In → out | On timeout or error |
|---|---|---|---|
| `POST /api/studio/transform` | `muse-image-1.0` edits + `sam-3.1` (body noun "plush toy" plus one noun per accessory, in parallel, unioned) | pack + 2 interest chips → transparent PNG in Storage | after 35 s, or on "Show me now", the cached pack Kix (live smoke 27 Oct: edit 13–21 s, SAM 4–8 s) |
| `POST /api/kix/tutor` | `muse-spark-1.3` on the Responses API, streamed; skill namespaces with deferred tools and client `tool_search` | question + child's answer (never the key) → hint; loads and unloads skills under the agent policy; every event to `skill_events` | after 10 s, the item's reviewed hint |
| `POST /api/vibe/spec` | `muse-spark-1.3`, JSON schema | brief → flashcard deck (stretch: or a song spec), validated with zod | the fixture deck or song |
| `POST /api/voice/transcribe` | `muse-voice-transcribe-1.0`, `PUSH_TO_TALK` | 16 kHz mono WAV, ≤ 30 s → transcript; audio never stored or logged | the typed box |
| `POST /api/admin/extract` | `muse-spark-1.3` vision + JSON schema (Content Curator) | uploaded PDF or image → items in the unified schema with tags and a confidence flag | the admin enters items by hand in the review queue |
| `POST /api/session/close` | `muse-spark-1.3`, JSON schema: Memory Keeper + mood + safety check in one call | after a session: the child's words to Kix + deterministic stats + Notebook pages → Notebook patch operations, a mood reading with evidence, a safety verdict → revisions, signals, flags | deterministic signals and keyword safety flags still apply; the Notebook stays as it was |
| `POST /api/parent/summary` | `muse-spark-1.3`, JSON schema | deterministic aggregates → what happened, what it may mean, tomorrow | template text from the same aggregates |
| `POST /api/tag` (stretch) | Baseten `meta-models/muse-spark-open-1026` | brief → topic tag | skipped |

```
app/(kid)/studio, home, learn/[quest], question/[id], treasure, critters, squadron, vibe
app/(parent)/parent, dashboard, messages        app/(admin)/skills        app/api/...        app/under-the-hood (model_runs + skill events)
components/   lib/meta/   lib/domain/   lib/db/   lib/sound/   lib/skills/   fixtures/   supabase/ (schema.sql, rls.sql, seed.sql, skills.sql)
content/skills/ (public, scrubbed)   private folder outside the repo (raw skills)   scripts/import-skill.ts
public/art/   public/brand/
```

## 3. How we go fast

1. **Port, don't redesign.** A small html→JSX script turns each canvas board into a page; then wire data. Design changes after Day 3 go to the roadmap.
2. **Skill packs, not hand-written fixtures.** The demo quests come from the imported skills: P3 Science life cycles (the frog, for Terrarium), P6 Maths before-and-after ratio, Sec 2 Science electrical systems. Twelve items, each approved once by you.
3. **Five live AI touchpoints for kids and parents (transform, tutor, Vibe spec, transcribe, summary), plus the Memory Keeper after each session and admin extraction; everything else deterministic. No RAG.** Fewer things can break on camera, and every AI call has a fallback.
4. **Demo mode.** A seeded household and a "Reset demo" route let any take start clean.
5. **One agent, four workstreams.** Claude Code does all four. A is built in the main checkout; B, C and D run as background subagents in their own git worktrees when their tasks don't touch A's files; Claude merges (A, then B, C, D), and you review the result instead of merging by hand.

| Stream | Owns |
|---|---|
| A: UI | `app/(kid)`, `app/(parent)`, `components/`, theme engine, motion |
| B: Platform | `lib/meta`, `app/api` (except C's routes), `supabase/`, `lib/domain`, `fixtures/`, art (`gen-image.mjs`) |
| C: Skills | `lib/skills/`, `lib/memory/`, `content/skills/`, `scripts/import-skill.ts`, `supabase/skills.sql`, `app/(admin)/`, `/api/kix/tutor`, `/api/admin/*` |
| D: Family | `lib/signals/`, `app/(parent)/dashboard`, `app/(parent)/messages`, the child's message sheet, `/api/session/*`, `/api/messages/*`, `supabase/family.sql` |
| You | decisions, answer review, tablet testing, video |

`main` auto-deploys to Vercel. `lib/types.ts` is the contract between streams: written at the start of a day, before the streams split.

6. **Daily rhythm (8h):** 15 min plan → 3h build → 30 min review and test → 3.5h build → 30 min deploy, plus a 2-minute screen capture of what works (it becomes video material) → 15 min plan for tomorrow.

## 4. Day by day

Every day ends with something you can show on the production URL.

### Day 1 · Tue 27 Oct · ≈ 5h
- **You (done 11:30):** Standard Meta Model API key, Supabase and Vercel projects, public repo `cyyeong/mykx`, first commit `dc574c0`. Still to do: put the keys in `.env.local` (see `.env.example`).
- **A (3h):** scaffold; copy tokens, fonts and component CSS; theme provider (`data-theme`, `data-band`, view-transition switch); port the Sidekick Studio picker; deploy.
- **B (3h):** `lib/meta` client; `scripts/smoke-meta.ts` exercising Spark (chat, JSON schema, streaming), Muse Image edit with `kix-base.png`, SAM 3.1 cutout to PNG; results with request IDs in `docs/plan/smoke-log.md`.
- **A, added (2.5h, from today's head start):** sound engine in `lib/sound` (Tone.js loaded on first tap, a synthesised SFX palette per pack, optional ambience, mute in the HUD); Studio taps and pack picks make sound.
- **C (done today):** the Skill Engine spec (`docs/prd/SKILL_ENGINE.md`) and the admin design boards; the seven source skills archived privately (since 28 Oct outside the repo, in the folder named by `MYKX_PRIVATE_DIR`).
- **Exit:** the production URL re-skins the Studio picker across all five packs, with sound; the smoke log shows three Meta models answering.

- **Done on 27 Oct evening, ahead of plan (uncommitted until approved):** the stream A and C branches copied into the working tree (screens, port script, seven skill packs); the door sign-in (`/signin`), "Who's learning?" (`/doors`) and kid doors (`/doors/[id]`, picture code with first-time set-up, teen password) with the living city, door and time tunnel; the sign-in back end (`lib/auth`, scrypt secrets, 12 h kid cookie, lockout, audit log, family/me/admin routes, a dev-only demo store; 53 tests); Your family (`/family`), Me (`/me`) and admin People (`/admin/people`); `/home` routes teens to the study deck; the Studio transform and voice routes now need a signed-in family and are rate-limited (the Day 3 auth risk is closed); **living scenes** (founder feedback: pokeable backgrounds with varied reactions; `docs/design/living-scenes.md`, two Muse Image edits of the study room); the deterministic domain (`lib/domain`) and a soak test of the bank and the learner model (`docs/plan/soak-report.md`).

- **Added 27 Oct evening:** stream E, the Game Arcade with the typing game (`docs/prd/GAMES.md`, canvas row 10), built in full with extra daily dev time; the typing engine started the same evening. The figure redraw for 98 draft items is running.

### Day 2 · Wed 28 Oct
- **E (3h, started 27 Oct evening):** the typing engine in `lib/games/typing` (curriculum stages, finger map, key timing, accuracy, words a minute, deterministic stars, tests), the game registry, and `game_progress` in the schema and the demo store.
- **A (7.5h):** html→JSX port script; static ports of Home, Quest map, Question, Treasure; shared pieces (Button, HoloCard, QuestNode, KixBubble, GlassPanel) 6h; hold-to-talk button on KixBubble with level ring and a 16 kHz WAV recorder, plus a `useKixVoice` read-aloud hook with captions 1.5h. **All done early on 27 Oct** (port script and four screens on a stream-A branch; hold-to-talk, read-aloud and `/talk` in main). **Day 2 A instead:** the door login with the living city and time tunnel, kid doors and kid sign-in (4h), then Your family, Me and admin People (4.5h, may run into Day 3), ported from row 8 of the canvas.
- **B (6h):** Supabase schema, row-level security and seed (a parent who is also admin; synthetic learners Ari, P3, Terrarium; Zara, P6, Idol Stage; Mei, Sec 2, Anime Sky; `voice_enabled` on all) 2h (written early on 27 Oct: `supabase/schema.sql`, `rls.sql`, `seed.sql`, with 9 PGlite tests for household isolation; applying it waits for the Supabase keys); offline-activity fixtures 0.5h; the transform route (Image → SAM → Storage, with fallback; each pack's prompt names its accessories, and SAM gets "plush toy" plus one noun per accessory, unioned; pick the main character when the edit adds a duplicate) 3h (built early on 27 Oct without Storage: `lib/studio/`, `/api/studio/transform`; live: Terrarium + bugs + jets in 23.4 s, all three accessories cut out, 70 KB WebP; Storage upload and `kix_url` wait for Supabase); add Muse Voice Transcribe to the smoke script with a synthetic clip from macOS `say` 0.5h (done early on 27 Oct: `lib/meta/voice.ts`, 2.1 s for a 2.4 s clip; "Kix" comes back as "Kicks", so normalise it). **B, sign-in (4h, in the time the early work freed):** Supabase Auth for parents and admins, kids' picture codes and passwords hashed with scrypt, the kid session cookie (12 h, tied to the parent's session), rate limits and lockout after 5 tries, family and admin routes, `audit_log` (ACCOUNTS.md §4–5).
- **C (4h):** item and manifest types in `lib/types.ts`; `scripts/import-skill.ts` reads the seven archived skills, scrubs names, traits and dates, maps the original practice sets to the unified item schema, derives archetypes from the school-paper banks without their questions, and writes seven packs to `content/skills/`; drafts the 12 demo items with hints; a test fails if `content/` contains the real names or school-paper codes.
- **You:** approve the 12 demo items and their hints (1h); check the scrub in `content/skills/` (30 min); check on a tablet, including the mic prompt and read-aloud voice.
- **Exit:** a signed-in parent switches to Ari and browses five themed screens in production; the transform route returns a cutout or the fallback within 25 s; seven scrubbed packs are in `content/skills/`.

### Day 2 evening · Wed 28 Oct (added 17:45)
- **You (15 min):** yes or no on GUARDIAN §3 (rule changes) and the four questions in GUARDIAN §8.
- **F (4h, only after your yes):** F1, the tables with RLS tests, the demo store, Home Link pairing and device tokens, the `/api/location` and `/api/home/frames` ingest routes; generate the ~30 synthetic simulator frames with Muse Image (in the manifest) so F4 can be tested against real images.

### Day 3 · Thu 29 Oct · Checkpoint A
- **E (5h):** the on-screen keyboard with ghost hands (finger map, reach animation, hands on/fade/off, touch mode) and Star Typer wired to the engine, in `app/(kid)/arcade/star-typer`.
- **A (8h):** Studio transform and reveal wired to the real route (progress steps, re-skin, keep or try again, pack and Kix saved) 4h; question player wired to the attempts route 3h; responsive app shell (bottom tab bar under 600 px, side rail from 600 px, bottom sheets, safe areas) 1h.
- **B (7h):** domain code with Vitest tests: marking, mastery, reward rules and cap, companion stage, squadron unlocks 5h; attempts and ledger routes 2h.
- **C (5h):** skill and Notebook tables, row-level security (admins write skills; households read published versions; only the child's own household reads its Notebook) and the seed from the packs, with synthetic Notebook pages for the three demo learners 2h; `lib/skills`: registry, agent policy check, skill namespaces and tools (`read_reference`, `find_items`, `check_answer`), reference sections, Vitest tests 3h.
- **D (3h):** family tables (`sessions`, `signals`, `flags`, `plans`, `messages`) with row-level security by household; the visible-time session heartbeat; a seeded synthetic week for Ari with one watch flag and one missed planned session.
- **F (7.5h, added 28 Oct):** F4 Home analysis (the Muse Spark schema and prompt, deterministic flag rules with tests, flagged frames to a private bucket with 24 h expiry, `model_runs`) 3.5h; F7 the Home simulator as a second Vercel project, with the scripted route and afternoon posting to the real APIs 3.5h; push one simulated afternoon end to end 0.5h.
- **Exit:** the Studio flow is live end to end; answering writes an attempt and a ledger entry; the question player's items come from the published P3 Science skill. **F:** the simulator's afternoon produces room statuses and one watch flag in production.
- **If it slips:** the Studio ships with cached art, and the live Muse Image call is shown from the smoke script in "under the hood".

### Day 4 · Fri 30 Oct · Checkpoint B
- **E (3.5h):** Neon Strike (teen look, question cards, combo and speed) and the content mapping for stages 5–8: spelling lists, subject words, Answer blast through `lib/domain/marking`, Match it from reviewed items and word cards.
- **A (7.5h):** streamed hint with Kix expressions; quest map from mastery; reward card flies to Treasure; Treasure from the ledger 6h; Critter Lab from the companion stage 1.5h.
- **B (7h):** admin upload route (Storage, rights field, type and size checks, admin only) 2h; parent summary (aggregates, Spark narration, offline activity fixtures; it becomes the "Tonight" card on the dashboard) 3h; Vibe spec route (JSON schema, zod, fallback) 2h.
- **C (4.5h):** `/api/kix/tutor`: Responses API with skill namespaces and client `tool_search`, the load and unload rules, `notebook_read` with the Notebook index in the prompt, `skill_events`, streamed hint to the question player, 10 s fallback to the item's reviewed hint, and a test that the answer never leaks.
- **D (4h):** signals with Vitest tests: focus from interaction, hesitation, voice pace from transcript timing, screen time and plan adherence; flag rules (urgent, watch, info); the safety path: keyword list, Kix's caring reply with a trusted-adult nudge, the helpline card (Tinkle Friend 1800 274 4788, SOS 1767), an urgent flag.
- **F (7.5h, added 28 Oct):** F5 Home now (room tiles, timeline, alert cards with Right / Not right, settings) 4h; F3 the parent map (Leaflet + OneMap, markers, trail, places) 3.5h.
- **You:** review the flag wording and Kix's safety reply (30 min), and the Guardian alert and chip wording (30 min).
- **Exit:** the whole learning loop works in production: question → hint → mark → honest mastery change → card in Treasure → Pip grows; the trace shows the P3 Science skill loading.
- **If it slips:** Sky Squadron becomes a static port, Vibe Zone drops version 2, and the Study Song stretch is off. If `tool_search` misbehaves, the tutor preloads the quest's skill and passes the references in the prompt; the orchestrator still logs loads and unloads.

### Day 5 · Sat 31 Oct
- **E (6h):** Word Garden 2h; the Arcade hub from the registry with screen-time counting 2h; the typing path, result card and share to family (through D's messages and the Treasure shelf) 2h.
- **You (30 min):** play each typing look on the laptop and on the tablet with a keyboard.
- **A (6h):** Vibe Zone (chat brief, deck rendered from the spec, flip, save for +5, share and revoke) 4h; the "Tonight" summary card for D's dashboard 1h; "What Kix remembers": the Notebook pages with history, edit or delete a line, wipe 1h.
- **A, inside the 5h:** the Vibe brief accepts hold-to-talk.
- **B (7.5h):** shares and revoke with a cross-household test 2h; creation versions 1h; art: regenerate the froglet, SAM cutouts of the four Kix expressions 2h; "Reset demo" route 1h; `/api/voice/transcribe` (validate WAV and length, Standard key, no audio in logs or Storage, `model_runs` row) 1.5h.
- **C (4h):** admin console ported from the new boards: skills catalogue, skill detail (items, references, versions), the agents × skills matrix read-only.
- **D (4.5h):** parent dashboard ported from the new board: flags with evidence and actions, the screen-time chart against the limit, plan adherence, wellbeing this week with expandable evidence, controls (daily limit, quiet hours, camera toggle, voice).
- **F (7h, added 28 Oct):** F2 kid location sharing on the web with the motion classifier and the "sharing" chip 2h; F6 the Home Link client (local settings page, ONVIF discovery, snapshot and RTSP, motion filter and burst, pairing) 5h.
- **You (30 min):** walk a block with your phone sharing location; optionally pair Home Link with one real camera at home (real frames go to Muse Standard and are never used in the video).
- **You:** video script v1 and shot list (1h), with the Guardian beat (§5).
- **Exit:** every demo-path screen works in production, including the skills catalogue.

### Day 6 · Sun 1 Nov
- **E (1.5h):** typing sounds (a pitched "pew" per right key, the stardust chime, a level fanfare), the parent's "keys to practise" note, and the motion pass on the games.
- **A (6.5h):** Sky Squadron and the teen study deck as static ports 0.5h; voice in the question player (ask Kix by voice; Kix reads the question and hint aloud) 1.5h; motion pass (lanterns, aurora, parallax, reward flight, reduced motion) 4h.
- **B (7h):** the extraction route (Spark vision + JSON schema → items with tags and confidence) 2h; timeout and error states for every AI call 1h; the "under the hood" page with `model_runs` and the skill-event trace 2h; image sizes and page-load performance 2h.
- **C (6.5h):** add knowledge: upload, extraction progress, the review queue (source beside extracted item), publish a minor version; Kix serves the new items next session 4h. Memory Keeper as a function in `lib/memory` (patch operations applied as revisions, a check that rejects labels and diagnoses, five tricky test transcripts) 2.5h; D's `/api/session/close` calls it in the same Spark call as the mood and safety check.
- **D (4h):** `/api/session/close` (one Spark call: Memory Keeper + mood + safety) 1h; family messages: the parent chat with quick encouragements and the sticker tray, the child's "Message from Mum" sheet on Home with quick replies, stickers and a voice reply, Kix-suggested messages on a flag 2h; the Kix sticker pack (8 stills via `gen-image.mjs`, CSS animation, in the asset manifest) 1h.
- **You:** a rough recording of the whole demo path (30 min) to see what looks weak; add a fresh worksheet through the admin flow (30 min).
- **You:** send messages both ways between a phone and the tablet (30 min).
- **F stretch (4h, only if F1–F7 are done):** F8 myKx for Android (Capacitor shell, background geolocation, native upload); **you** install Android Studio and run the APK on an Android phone (1.5h). Otherwise F9, the canvas boards for the map and Home now (2h).
- **Stretch window (only if Checkpoint B was green and today's exit is met):** camera signals on the device: MediaPipe Face Landmarker in the browser, per-minute counts only (face away, eyes closed, yawns), behind the parent toggle with a visible camera dot; no frame leaves the device (3–4h). Study Song stays on the roadmap slide.
- **Exit:** the complete product is in production and a rough capture exists.

### Day 7 · Mon 2 Nov · feature freeze at 22:00
- **Morning:** bug bash from the rough capture; fixes only.
- **Afternoon:** device pass on the demo path at 344, 390, 720 (foldable, with Chrome's posture emulation), 820, 1280 and 1600 px wide, plus a real phone and tablet (2h); keyboard path, contrast and reduced-motion checks; security checks (cross-household access refused, admin routes refuse non-admins, keys only on the server, no contributor model at runtime, no real names or school-paper questions in `content/` or the bundle; family messages never reach Kix or a language model; signals never change mastery; the safety path fires for the ten test phrases); rehearse the demo path three times.
- **Exit:** freeze; three clean runs in production; tag `v1.0-freeze`.

### Day 8 · Tue 3 Nov · capture day
- **Morning (4h):** fixes only (2.5h); README (1.5h): what it is, the live link, the video, which Meta models are used where, the Muse Code art-direction round, what was built from 27 Oct to 4 Nov, synthetic data, the asset manifest and licences. Confirm the repo is public.
- **Afternoon (4h):** record every video segment in production, record the voice-over, and capture the "under the hood" shots.

### Day 9 · Wed 4 Nov · edit and submit
- **Morning (4h):** edit (assemble, burned-in captions, music, titles), export 1080p, upload unlisted, then watch it once on a phone and once on a laptop.
- **Afternoon (1h):** submission form; a 20 to 30-second cut posted on X (the viral prize counts engagement until 8 Nov).
- **3h buffer.** Submit as soon as the checklist in §7 is green, and no later than 22:00 SGT.

### Day 10 · Thu 5 Nov
Hands off. Emergency fixes only, before 10:00 SGT.

## 5. The video (12 protected hours)

Script target: about 360 words of voice-over (130 a minute), finished by Day 5.

| Time | Beat | Screen | Shows |
|---|---|---|---|
| 0:00–0:12 | "My kids have always been my sidekicks…" over the living city; Ari taps the picture code, the door swings open and the time tunnel carries us in | Sign-in | the hook |
| 0:12–0:40 | A P3 child picks Terrarium and bugs and critters; Kix transforms; the app re-skins; Pip is adopted | Studio | Muse Image + SAM 3.1, live |
| 0:40–0:50 | Home: today's quest, Pip, the squadron; a 2-second cut to the same Home on a phone and an open foldable | Home | personalisation; every device |
| 0:50–1:25 | Quest map → a "P3 Science skill loaded" chip → Kix reads the question aloud → the child asks "why?" by voice → streamed hint → correct → Kix cheers → card flies; "57, limited evidence" | Quest map, Question | Kix Tutor agent; Voice Transcribe; honest mastery |
| 1:25–1:40 | Treasure, a Sky Squadron card flip, Pip grows | Treasure, Critter Lab | earned, never random |
| 1:40–2:00 | The child *says* "I keep forgetting the frog life cycle" → flashcards → save → share with Mum | Vibe Zone | voice in; structured output; no AI code runs |
| 2:00–2:10 | The parent's phone: "Ari seemed tired in 3 evening sessions" with the evidence → Message Ari with a Kix sticker → Ari's sticker reply (no Notebook flash) | Parent dashboard, messages | care, evidence, not labels |
| 2:10–2:30 | Guardian: the map shows Ari walking home ("possibly playing" at the playground) → "Ari is home" → Home now: "Living room: Ari, reading" → a watch card, "possibly a shove", with synthetic frames → the parent taps **Not right**; lower third: "Your cameras, read by Muse Spark. Frames deleted after 24 h. Kix never sees them." | Out and about, Home now | Muse Spark vision, live; built for Singapore families |
| 2:30–2:45 | Skills admin ("same Kix, different skills"): the P3, P6 and Sec 2 catalogue → upload a new worksheet → Spark extracts six questions → approve → version 1.1 published → Kix uses them | Admin | knowledge that grows; Best Agentic |
| 2:45–3:00 | The trace: Kix loading and unloading skills; `model_runs` showing four live Meta models; built 27 Oct–4 Nov; synthetic data; "Kix speaks with your device's voice" | Under the hood | Meta tooling and honesty |

**Rules:** record in production with the seeded demo and "Reset demo" between takes. Capture app sound with the screen (the SFX are part of the wow) and duck the music under the voice-over. The spoken lines are performed by an adult or read from the script, never a real child's voice. Show at least one genuinely live transform; if it is slow, speed it up and label it. Burn in captions, since judges may watch muted. Use royalty-free music and credit it. Never show real children's names or photos.

**Tools:** macOS screen recording (⌘⇧5) or OBS with a 1280×800 browser window; edit in CapCut desktop or DaVinci Resolve (both free); record the voice-over in a quiet room.

| Video task | When | Hours |
|---|---|---|
| Script and shot list | Day 5 | 1 |
| Rough capture | Day 6 | 0.5 |
| Final capture | Day 8 afternoon | 3 |
| Voice-over | Day 8 afternoon | 1 |
| README | Day 8 morning | 1.5 |
| Edit, export, upload, check | Day 9 morning | 4 |
| Submission and X post | Day 9 afternoon | 1 |
| **Total** | | **12** |

## 6. Risks, early warnings and cuts

| Risk | Early warning | Response |
|---|---|---|
| No Model API key today | Day 1 smoke script can't run | Get the key first. If billing blocks it, ask in Discord office hours (22:00–23:00 SGT) and build against fixtures meanwhile. |
| Muse Image + SAM slow or flaky | the 27 Oct smoke runs took 18–29 s end to end | 35 s budget with the progress steps and "Show me now"; cached pack Kix fallback; pre-generate per pack; record the live transform for the video and speed it up, labelled. |
| AI routes are open to anyone before auth exists (credit drain) | any deploy before Day 3 | Every `/api/*` route that calls Meta requires a signed-in household session plus a per-household rate limit (Day 3, with Supabase auth); until then, don't connect a public deploy to a key with credit, or keep a $100 spend alert. |
| Row-level security eats time | over 3h on Day 2 | Simplest policy (household of the signed-in parent). Never ship without it. |
| Porting is slower than expected | Day 2 exit missed | Static port first, wire later; apply the Day 3 and Day 4 slip rules. |
| Parallel streams collide | merge conflicts between worktrees | Streams own separate folders; `lib/types.ts` is settled before they split; merge after each task. |
| Credit burn | Billing page over $60 | Art drafts at n ≤ 4 and only keepers re-run; long Spark tests use fixtures; spend alert at $100. |
| Mic or audio quirks on the tablet (permissions, Safari) | Day 2 tablet check | The typed box is always visible; Tone.js starts on the first tap (browsers block audio before one); record the voice beats on laptop Chrome if the tablet misbehaves. |
| Read-aloud voice sounds robotic | Day 2 tablet check | Pick the best installed voice per device from a preference list; captions always on; keep read-aloud lines short. |
| Voice transcription slow or wrong | smoke log latency over 3 s, or misheard demo lines | The transcript is always shown for the child to confirm or retype; rehearse the demo lines. |
| Responsive layouts break on small or folding screens | the daily phone-width check | Port the boards' responsive classes as they are; fix at 344 px first; the foldable posture rules and desktop margin art are the first to cut. |
| Wellbeing signals feel like surveillance, or are wrong | Day 4 wording review | Parent-only, "possibly" with evidence and confidence, compared with the child's own baseline, no labels; camera off by default and on the device only; the child's settings say what's shared. |
| The safety path misses or over-fires | Day 4 tests with ten phrases | Keyword list confirmed by the Spark call; urgent always shows the helplines; you review the wording. |
| Four streams add merge risk | a stream misses a day's exit | Each stream owns its folders; merge A, B, C, D in that order; the family cut line applies before the core. |
| Real names, notes or school-paper questions leak into the public repo | Day 2 scrub check | The importer writes only scrubbed, original content; a test scans `content/` for the real names and source-paper codes; raw skills stay in a private folder outside the repo. |
| The Memory Keeper writes something unkind, wrong or sensitive | Day 6 test transcripts | Patch operations only (no free rewrite); a check rejects labels and diagnoses; every change is a revision the parent can see, edit or undo. |
| `tool_search` behaves differently from the docs | Day 4 morning | Fallback mode: preload the quest's skill and pass references in the prompt; keep the orchestrator's load/unload trace. |
| PDF extraction quality is poor | Day 6 | The review queue is mandatory anyway; JSON and Markdown parse without a model; use a clean worksheet in the video. |
| Video overruns | script not done by Day 5 | Day 8 afternoon and Day 9 are protected; scope cuts come from the build, never from the video. |
| Guardian reads as surveillance to judges or families | the Day 4 wording review | Lead with assurance: status, not a feed; the child's chip; Kix never sees it; adults never named; 24 h frames; every alert reviewed by the parent. Synthetic frames only in the video. |
| Muse Image refuses the argument or hazard frames | Day 2 evening generation | Softer scenes (raised voices, a toppled toy; a chair by a closed window with the pane open a crack); keep a no-flag afternoon as the fallback demo. |
| Muse Spark misreads frames (play-fighting, a TV scene) | Day 3 simulator run | 2-of-3 rule, bursts, "possibly" with confidence, Right / Not right; tune the prompt on the simulator's frames before Friday. |
| Phone browsers stop sharing location in the background | Day 5 walk test | Expected: labelled "Shared while myKx is open"; the Android app is the stretch; the video uses the simulator's route. |
| OneMap tiles slow or blocked | Day 4 map build | OpenStreetMap tiles as the fallback layer, with attribution. |
| New feature requests | anything new after Day 6 | Goes on the roadmap slide, not into the build. |

**Cut order when a checkpoint slips** (the stretch items, Study Song and Baseten, only start when ahead, so they go first):
1. Baseten, then camera signals. Then Guardian's own stretch: the Android app (F8) and the canvas boards (F9).
1a. **Guardian (stream F), in this order:** the Home Link client's ONVIF discovery (keep pasted RTSP and snapshot URLs); places and arrive/leave events (keep the live dot and trail); the timeline on Home now (keep tiles and alerts); web location sharing on the kid's phone (keep the simulator's route). The last thing standing is the simulator → real ingest → Muse Spark → Home now and the map, because that's the video beat.
2. Skills admin extras: the versions list and reference counts go (the agents matrix is already read-only). The Notebook's parent view becomes read-only plus wipe (no line editing).
3. Family extras are already cut (Kix-suggested messages, voice-pace signals); next the dashboard drops the wellbeing expanders and keeps flags, screen time and the plan. Sign-in extras: the walking characters and the junior door variant (one door for everyone) go before the core sign-in.
4. Add knowledge accepts JSON and Markdown only (no PDF extraction).
5. Vibe Zone keeps make and save only.
6. Pip's growth is shown as a fixed stage.
7. Treasure particles and parallax; the ambience bed; foldable posture rules (book and tabletop) and desktop margin art.
8. Voice in the question player (keep it in Vibe Zone, where the video needs it).

**Never cut:** the Studio transform (cached fallback is fine), the learning loop with honest mastery, the tutor loading skills (fallback mode is fine), upload → review → publish, progress computed deterministically in the database (the Notebook never replaces it), the parent dashboard with flags, the safety path, household isolation, or video time.

## 7. Definition of done

- [ ] The production URL works in a fresh browser on a phone, a foldable (or its emulation), a tablet and a desktop: no horizontal scroll from 320 px up, tap targets meet the band minimum; "Reset demo" works.
- [ ] Public GitHub repo with a README: problem, live link, video, Meta models and where they're used, the Muse Code art-direction round, what was built 27 Oct–4 Nov, synthetic data, the asset manifest, licences.
- [ ] No secrets in the repo or client bundle; keys live only in Vercel environment variables.
- [ ] The cross-household access test passes; admin routes refuse non-admins.
- [ ] No real children's names, notes or school-paper questions anywhere in the repo or bundle (the `content/` scan passes).
- [ ] Parent dashboard: screen time, plan, signals with evidence and the three flag levels work from seeded data; the safety path shows the helplines and an urgent flag for the ten test phrases; messages work both ways inside the household only (the cross-household test covers them); family messages never reach Kix or a language model.
- [ ] Kix's Notebook: a parent can read every page and its history, edit or delete a line, and wipe it; the five tricky transcripts produce no labels or diagnoses; mastery shown anywhere comes from the database.
- [ ] Voice: mic denied → the typed box works; no audio in Storage, logs or `model_runs` (transcripts only); voice can be turned off for a child.
- [ ] A 3:00 video with captions, uploaded, and opening for a signed-out viewer.
- [ ] Guardian: the simulator's afternoon runs in production through the real APIs (map, Home now, one watch flag with Right / Not right); flagged frames expire after 24 h; a cross-household test covers locations and home status; the child sees the sharing and camera chips; no camera data reaches Kix, the Notebook or a contributor model; the Home Link client pairs, reads a snapshot or RTSP frame, and never sends camera passwords.
- [ ] Submitted on the Cerebral Valley platform before 22:00 SGT on 4 Nov; X post live.

## 8. Next 30 minutes

1. ~~Create the Meta Model API key, Supabase, Vercel and the GitHub repo~~ (done).
2. ~~`git init` and commit today's work~~ (done, `dc574c0`).
3. Put the keys in `.env.local` (git-ignored; names in `.env.example`) and run the smoke script; connect Vercel to the repo.
