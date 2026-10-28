# Handover: state of myKx and what to build next (28 Oct)

Claude Code builds everything from 28 Oct afternoon (Muse Code retired). Read `AGENTS.md` first (rules, division of work, the trail), then this file, then `docs/plan/PROGRESS.md`. The stories and the navigation audit behind the task list are in `docs/prd/USER_STORIES.md`; the schedule is in `docs/plan/IMPLEMENTATION_PLAN.md` (feature freeze Mon 2 Nov 22:00 SGT, submit Wed 4 Nov 22:00 SGT).

## Run it

- `npm install`, then `npm run dev` (port 3000; the founder's machine uses 3100), `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- **Without `.env.local`** (a fresh clone) the dev server uses an in-memory **demo family**: any email and password signs a grown-up in; kids are Jordan (P3, picture code: Kix smiling, Kix cheering, Kix the pilot, Starry Kix), Abby (P6) and Leonard (Sec 2), both with the password `hackmuse`. Production's sample family is the same: grown-up `demo@mykx.ai` / `hackmuse` (also the admin), published for judges (founder, 28 Oct). See `lib/auth/demo-family.ts`. That's all you need for UI work.
- Live Meta model calls, Supabase and art generation need keys that only the founder's machine has. Don't ask for them; leave those steps to the founder or Claude Code.
- Production: https://mykx.vercel.app (Vercel builds every push to `main`).

## What works today

- **Sign-in:** the living-city door with the time tunnel; kid doors with picture codes and passwords; Supabase Auth in production; scrypt-hashed kid secrets, lockout, audit log (`lib/auth`, `docs/prd/ACCOUNTS.md`).
- **Kid screens** (`app/(kid)`): Home (junior), the teen study deck with an interactive room, quest map, question, Treasure, Studio with the live Kix transform, Talk to Kix (voice), Me, printable practice papers (`/me/papers`). Every background has living art (`components/scene/LivingArt.tsx`, `docs/design/living-scenes.md`).
- **Grown-up screens:** Your family (`/family`, with voice and focus-camera switches and the "Focus this week" notes), practice papers (`/papers`), admin People (`/admin/people`).
- **Engines with tests:** mastery, selection, rewards ledger, companion, squadron (`lib/domain`); typing game (`lib/games`); paper builder (`lib/print`); focus signals (`lib/signals`).
- **Knowledge agent** (`/admin/knowledge`, `lib/knowledge`, `/api/admin/knowledge`): multi-PDF upload → Muse Spark reads patterns, traps and cues → routed to a pack → review → publish as the pack's next version (`skill_updates`), read by Ask Kix. Papers come from the `past-paper-scout` skill. Needs `supabase/migrations/20261028_knowledge.sql` in production.
- **Weekly paper scout** (`/api/cron/papers`, `vercel.json` Mondays 06:00 SGT, `lib/papers/scan.ts`): saves the approved sites' latest papers (links and decisions only) for Add knowledge → New papers found, where "auto" ones can be read by the knowledge agent in one click. Needs `CRON_SECRET` in Vercel and `supabase/migrations/20261030_paper_scout.sql`.
- **Guardian M3, the screens** (`components/location`, `components/home-watch`, `components/guardian`): the parent shell has **Where** and **Home** tabs and Your family links to `/family/guardian` (Location and home cameras); a kid sees chips on Home and `/me/sharing`. Leaflet is pinned at 1.9.4 and needs a real copy in a review worktree's `node_modules` (Turbopack won't follow a symlink out of the project). After adding routes, restart the review server with `rm -rf .next` or it loops on reload. `/api/guardian/brief` is the "Right now" line.
- **Guardian M1** (`lib/location`, `lib/home-watch`, `/api/location*`, `/api/home/*`): points, places, sharing settings and the teen pause; Home Link pairing, cameras, frames (checked and counted, read from M2) and preferences. Needs `supabase/migrations/20261028_guardian.sql`.
- **Camera replay** (Family → Focus): face-outline points kept on the kid's device 7 days, replayed as a line drawing; Right / Not right. Needs `supabase/migrations/20261030_focus_verdict.sql`.
- **Ask Kix** (`/ask`, `lib/kix/homework.ts`, `/api/kix/homework`): homework help from a typed question or a photo (face-checked on the device, never stored), explained with the pack's syllabus methods as a visual lesson, guide-first.
- **Kix as guardian** (`lib/guardian`, spec `docs/prd/PARENT_INSIGHTS.md`): heartbeats (`/api/guardian/beat`), the child's words to Kix with the safety path (`/api/guardian/words`, and question reasons), flags, sessions and the next step, the parent's Today (`components/parent/ParentToday.tsx`). Needs `supabase/migrations/20261028_guardian.sql` in production; `node scripts/guardian-sample-sql.ts` prints Jordan's sample week for a demo.
- **Family messages and Kix's Notebook** (`lib/family`, `lib/notebook`, `/api/messages`, `/api/messages/mine`, `/api/notebook`, `/api/session/close`): the parent's Messages and Notebook tabs, the kid's `/messages` with animated Kix stickers, Home's message chip, and the Memory Keeper after each quest. Tables live in production since 28 Oct.
- **Under the hood** (`/admin/under-the-hood`, `/admin/skills`, `lib/admin/hood.ts`, `/api/admin/hood`): every model call is logged through `lib/runs/log.ts` (a route calls `logRunsFor(...)` first; `lib/meta/run.ts` credits each call to it). Admins only.
- **Arcade** (`/arcade`, `/arcade/star-typer`, `/arcade/neon-strike`, `/arcade/word-garden`, `lib/games`, `components/games`, `/api/games/round`): the hub and three typing games on one engine, each with its own path (`lib/games/typing/modes.ts`) and saved progress (`game_progress`, live).
- **Content:** seven skill packs in `content/skills/`, all reviewed by the founder (P6 Maths has 40 original questions in `items/original-01.json`).
- **Design:** every Claude Design board is copied into `docs/design/boards/` (open one in a browser to see it; `ds/` beside them holds the tokens and fonts). The Game Arcade boards (`Arcade`, `StarTyper`, `WordGarden`, `NeonStrike`, `TypingPath`) are the spec for the games. `scripts/port-board.ts` turns a board into a first-pass React screen; image ids map through `docs/design/canvas-blob-map.json`.

## Tasks, in order

Each task: build it, check it in the browser at 390 and 1280 px wide (Playwright screenshots are fine), make typecheck, lint and tests pass, add a row to `PROGRESS.md`, and commit with the `Agent: Claude Code` trailer when the founder says to commit.

Tasks 1–4 were built by Muse Code during its 28 Oct trial (branches `muse/kid-nav`, `muse/learning-loop`, `muse/music`, `muse/grown-ups`, PRs #1–#4) and fixed on main after Claude Code's review; see "Muse Code trial" in `PROGRESS.md`. Task 5 onwards is Claude Code's.

1. **Kid navigation bar** (USER_STORIES §8.4 fix 1) — ✅ done on `muse/kid-nav`. One bar on every kid browsing page: Home, Learn, Play (the Arcade), Treasure, Vibe; bottom bar under 600 px, side rail from 600 px (design skill §3a). The avatar menu already exists: `components/nav/KidAvatarMenu.tsx` (Me, Switch profile). Hide the bar inside a question and during an Arcade round. Mount it in `app/(kid)/layout.tsx` next to the existing pieces (keep `<FocusWatch />` in its Suspense boundary). Play and Vibe render as disabled Soon tabs (same pattern as the admin sidebar) until tasks 5–6 build `/arcade` and `/vibe`; Learn opens the demo quest until task 2/5 builds `/learn`.
2. **The learning loop** (the demo's core; fixes 2, 3) — ✅ done on `muse/learning-loop`.
   - Switch Jordan's quest from P4 "Light and shadows" to the **P3 frog life cycle** (founder decision): the quest map stops and the question come from the reviewed P3 Science items (`content/skills/p3-science`, life-cycles topic) through `lib/domain/selection.ts`.
   - An attempts route: mark with `lib/domain/marking.ts`, update mastery (`mastery.ts`) and the rewards ledger (`rewards.ts`, 15 a day), store in Supabase (`attempts`, `ledger` tables exist; demo store for dev).
   - Question player: Next question, a quest-complete page (`/learn/[quest]/done`: Back to the map, See my Treasure, Home), a confirm before leaving mid-question, the reward card flying to Treasure.
   - Quest map nodes and Treasure cards read real mastery and the ledger, with "limited evidence" labels where the evidence is thin.
   - Left for later tasks: `/learn` quest list and Play/Vibe targets (task 5), teen sessions (task 5), streamed Kix hints (tutor route, task 7), voice in the player (K-29).
3. **Background music** (the founder wants much more than today's ambient beds). See "Music brief" below — ✅ done on `muse/music`.
4. **Grown-ups** (fixes 6, 8): sign-in sends parents to `/parent` and admins to `/admin/people`, honouring a safe `?next=`; build `/parent` (Today, Messages, Notebook, Family, Kids' doors, Sign out); a **4-digit parent PIN** (founder decision: set once in Your family, hashed on the server with the same scrypt helpers as kid codes) asked before grown-up pages when a kid is signed in on the device. — ✅ done on `muse/grown-ups`.
5. **Fill the gaps the audit found** (fixes 3–5): Home's dead buttons (Squadron, Vibe, Critter Lab); Studio reachable (first visit after a new door, "Change my Kix" on Me) and finishable (Keep → Adopt Pip → Home, Kix saved to the profile); the teen study deck with P6 or Sec 2 content instead of Sec 3 Physics, and "Start session" calling `useLearningSession(true)` (`components/camera/learningSession.ts`) so the focus camera runs during study.
6. **The Game Arcade in the app** (`docs/prd/GAMES.md`): port the five boards, wire them to `lib/games`, save progress (a `game_progress` table, with RLS like the others, and the demo store).
7. Later, by the plan: Critter Lab and Sky Squadron screens, Vibe Zone, Kix's hints route (`/api/kix/tutor`), the parent dashboard and messages, the admin skills catalogue and "add knowledge".

## Music brief

Today `lib/sound/engine.ts` plays short synthesised effects and, for some worlds, a quiet noise bed (breeze, birds, rain) with no melody. Build real background music that stays true to the design rules (`.agents/skills/mykx-design-system` §6a: sound is synthesised with Tone.js, never recorded; one mute; no sound for wrong answers):

- **One theme per world** (Dreamlight, Anime Sky, Toon Pop, Idol Stage, Terrarium) using that world's instrument palette from §6a, plus moods per place: calm for learning (60–80 BPM), dreamy for Treasure, bright for Home, driving for the Arcade (tempo and layers rise with the combo or heat, never with wrong keys).
- **Compose it as data:** each theme is a small JSON score in `lib/sound/music/` (key, chords, melody motifs, rhythm patterns, layers), validated with zod, played by a small sequencer with seeded variation so loops don't repeat bar for bar. Muse Code composed the first scores in its 28 Oct trial; Claude Code fixed the engine and recomposed all five (`aab5838`, see `PROGRESS.md`).
- **Mixing:** a music bus well under the effects (about −24 dB), a short fade in and out, ducking while Kix speaks (`speechSynthesis` start and end) and while the mic records; pause when the tab is hidden.
- **Control:** a Music switch beside the existing sound button, off by default for teens, on for juniors after their first tap; remembered per device.
- **Check:** no clicks or pops at loop edges, CPU under about 5 % on a laptop, and silence when muted.

## Keys and second deployment (28 Oct)

- **The founder signs the Vercel CLI in once:** `npx vercel@65.1.0 login`. After that, Claude Code sets keys itself:
  - `CRON_SECRET` on the main project;
  - the `mykx-sim` project (same repo, root `sim`);
  - `SIM_HOME_LINK_TOKEN` and `SIM_PASSCODE` on `mykx-sim`, with the passcode also in `.env.local`.

  Values are never printed in chat or committed.
- **Done on 28 Oct (the founder signed the CLI in; Claude Code did the rest):**
  - `CRON_SECRET` is set on `mykx` (the founder added it; both cron routes answer 401 without it).
  - The second project is `mykx-sim` (team `my-kx`), live at https://mykx-sim.vercel.app. It is deployed straight from the `sim/` folder, so a change to `sim/` goes live with `cd sim && npx vercel@65.1.0 deploy --prod`. It isn't connected to git. Vercel sign-in protection is on, so opening it asks for the founder's Vercel login, and then for the passcode.
  - Its settings are `SIM_PASSCODE`, `SIM_HOME_LINK_TOKEN` and `MYKX_URL`, all production, with the first two marked sensitive. The passcode is in the Claude Code scratchpad (`sim-pass-prod.txt`); copy it with `pbcopy < <path>`.
  - Production's demo household is set up for it by `scripts/guardian/setup-sim.ts`: Home and School pins, each kid's sharing, the parent's descriptions, camera hours open all day and every day, and a simulator device. It only touches the household if every profile in it is synthetic.
  - Tested end to end against production: a location and a live Muse Spark reading of a camera frame.
- **Re-pairing the simulator** (a lost token can't be shown again): from `sim/`, with the token going into a file and never the screen, `umask 077; node --env-file=../.env.local ../scripts/guardian/setup-sim.ts --rotate > /tmp/t; npx vercel@65.1.0 env add SIM_HOME_LINK_TOKEN production --sensitive < /tmp/t; rm /tmp/t`, then redeploy. Never pipe it with `|` in zsh next to a redirect: zsh's MULTIOS copies stdout to both.
- **Locally:** `SIM_HOME_LINK_TOKEN=… SIM_PASSCODE=… MYKX_URL=http://localhost:3200 node sim/dev.mjs` serves it on port 3300.
- **Database:** the same production Supabase. The simulator has no database; it posts to myKx's routes as the demo family. If `SUPABASE_DB_URL` is in `.env.local`, `scripts/db-migrate.ts` runs migrations; otherwise the founder pastes the SQL.

## Guardian demo and the outings (28 Oct)

- **Do something together** (`/together`, `app/api/outings`): one Muse Spark web search plus one planner call per refresh, three a day. The latest run is one JSON file per family in the private Storage bucket `outings` (no migration). `scripts/guardian/outings-seed.ts` records a real run for the production demo household as source "cached" so the page opens full; run it again if the ideas get stale (about a minute, $0.20).
- **Tonight** (`/api/guardian/tonight`, `components/parent/TonightCard.tsx`): facts come from the database and the Guardian rollups; Muse Spark only narrates, the rules' sentence stands in if it fails.
- **Between video takes:** `node --env-file=.env.local scripts/guardian/reset-demo.ts` clears the demo household's points, arrivals, readings, alerts, stored frames and pauses (refuses unless every profile is synthetic). The take itself is in `docs/plan/GUARDIAN_DEMO.md`.
- **`20261030_focus_verdict.sql` is applied** (founder, 28 Oct; `signals.verdict` and `signals.verdict_at` exist in production). The store's fallback for a database without them stays as a safety net.
- **Home Link** (`clients/home-link/`): the desktop client for the family's own cameras; see its README. It is a separate small Node package and is not part of the Next.js build.

## The Skill Engine runtime (29 Oct)

- The Kix Tutor and Ask Kix call tools (`lib/skills/runtime.ts`; design in `docs/ARCHITECTURE.md` §4.10). Tool results and the policy are code; the model only chooses.
- **The founder runs one SQL:** `supabase/migrations/20261029_skill_events.sql` in Supabase's SQL editor. Until then the agents work, but nothing is logged and Under the hood's Skill Engine card stays empty.

## Agents you can edit (29 Oct, batch F built)

- Under the hood → click an agent → `/admin/under-the-hood/agents/[agent]`: instructions (editable), guardrails (fixed in code, always appended), tools, and versions with diff, restore and delete; the built-in default (v1) can't be deleted. Code in `lib/agents/`, routes `/api/admin/agents` and `/api/admin/agents/[id]`; design in `docs/ARCHITECTURE.md` §4.11.
- **The founder runs one SQL:** `supabase/migrations/20261030_agent_versions.sql` in Supabase's SQL editor (server-only table, no browser policies). Until then every agent uses its default and Save draft or Publish answers that the table is missing.
- A publish reaches Kix within a minute (each server keeps the published text in memory for 60 s). New prompts (for example batch E's paper pairing) belong in `lib/agents/instructions.ts` with their guardrails, so they show in the editor; `lib/agents/agents.test.ts` checks the defaults against `lib/agents/today-prompts.json`.

## Founder's batch, 29 Oct (design on the canvas first, then build; freeze Mon 2 Nov 22:00)

Order: designs (canvas page "Admin and sign-in, 29 Oct") → B → C → A → F → D → E → docs and video stories.

- **A. Kids' magic name.** Every kid gets a unique `username` (the magic name, set by the parent; lowercase letters, digits, hyphens). The sign-in card's kids line becomes a dialogue: "Kids: tell me your magic name, and I shall bring your magical door". Tapping it pops a name input; Continue flies the kid's own door in while the city gives way to their world (living, moving pieces), then the door asks for the picture code or password. This is a **solo kid session**: signed like today but bound to the kid's household and secret version instead of a parent session, so it ends when a parent resets the code. Lookup is rate-limited per IP and shows only the door's look. Kid doors on a parent's device stay.
- **B. Smooth time tunnel.** The CSS tunnel animates 190–320 vmax layers with gradients and masks (about 4,600 px squares on a laptop), which flickers. Replace it with one canvas at screen size (DPR ≤ 2) drawn at 60 fps: vortex art pre-decoded, rings, streaks, flash.
- **C. Kids sign out.** A sign-out in the kid's avatar menu; after 14 minutes idle a "Still there?" card counts down, and at 15 minutes the kid is signed out.
- **D. Skills you can edit.** Skill versions in the database (`skill_versions`): the pack on disk is the default and can't be deleted. Admin can edit files, ask Muse to enhance (a proposed diff to accept), import a standard agent skill (`.zip` or `.skill`; scripts are never kept or run, rule 10), and restore, diff or delete versions. The runtime reads the published version, else the default.
- **E. Knowledge refines a skill.** A review session holds several PDFs (a question paper now, its answer sheet later); Muse pairs them, sorts papers by subject and level (admin can override level, subject and tier), cross-checks answers and spelling and flags anything unusual; every entry is editable. Publishing makes a new skill version (D). School papers still give patterns plus Kix's own new questions, never their own questions (rule 10); our own or licensed material may keep its questions.
- **F. Agents you can edit.** Under the hood: click an agent to see its instructions; edit and publish versions; diff, restore and delete; the built-in default can't be deleted. Safety guardrails stay fixed in code and are shown read-only. ✅ Built 29 Oct ("Agents you can edit" above).
- Then: ARCHITECTURE, SKILL_ENGINE, ACCOUNTS, PROGRESS, the video beat sheet.

- **Done 29 Oct:** B (canvas tunnel, e4a1ba7), C (kids sign out and idle, e4a1ba7), A (magic names). **The founder runs one SQL for A:** `supabase/migrations/20261030_kid_username.sql` (adds `profiles.username` and sets the demo kids to `jordan`, `abby` and `leonard`). Until then the magic-name door answers "I couldn't find that magic name" and everything else works.

## Things only the founder or Claude Code do

- Publish to the Claude Design canvas (Claude Code); copy boards back into `docs/design/boards/` after.
- Run SQL on Supabase (the founder pastes files from `supabase/` and `supabase/migrations/` into the SQL editor).
- Generate art or run live Meta model calls (they need the keys in `.env.local`).
- Anything in `.museignore`.
