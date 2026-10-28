# Handover: state of myKx and what to build next (28 Oct)

Claude Code builds everything from 28 Oct afternoon (Muse Code retired). Read `AGENTS.md` first (rules, division of work, the trail), then this file, then `docs/plan/PROGRESS.md`. The stories and the navigation audit behind the task list are in `docs/prd/USER_STORIES.md`; the schedule is in `docs/plan/IMPLEMENTATION_PLAN.md` (feature freeze Mon 2 Nov 22:00 SGT, submit Wed 4 Nov 22:00 SGT).

## Run it

- `npm install`, then `npm run dev` (port 3000; the founder's machine uses 3100), `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- **Without `.env.local`** (a fresh clone) the dev server uses an in-memory **demo family**: any email and password signs a grown-up in; kids are Ari (P3, picture code: Kix smiling, Kix cheering, Kix the pilot, Starry Kix), Zara (P6, password `stars123`) and Mei (Sec 2, password `frogs123`). See `lib/auth/demo-family.ts`. That's all you need for UI work.
- Live Meta model calls, Supabase and art generation need keys that only the founder's machine has. Don't ask for them; leave those steps to the founder or Claude Code.
- Production: https://mykx.vercel.app (Vercel builds every push to `main`).

## What works today

- **Sign-in:** the living-city door with the time tunnel; kid doors with picture codes and passwords; Supabase Auth in production; scrypt-hashed kid secrets, lockout, audit log (`lib/auth`, `docs/prd/ACCOUNTS.md`).
- **Kid screens** (`app/(kid)`): Home (junior), the teen study deck with an interactive room, quest map, question, Treasure, Studio with the live Kix transform, Talk to Kix (voice), Me, printable practice papers (`/me/papers`). Every background has living art (`components/scene/LivingArt.tsx`, `docs/design/living-scenes.md`).
- **Grown-up screens:** Your family (`/family`, with voice and focus-camera switches and the "Focus this week" notes), practice papers (`/papers`), admin People (`/admin/people`).
- **Engines with tests:** mastery, selection, rewards ledger, companion, squadron (`lib/domain`); typing game (`lib/games`); paper builder (`lib/print`); focus signals (`lib/signals`).
- **Knowledge agent** (`/admin/knowledge`, `lib/knowledge`, `/api/admin/knowledge`): multi-PDF upload → Muse Spark reads patterns, traps and cues → routed to a pack → review → publish as the pack's next version (`skill_updates`), read by Ask Kix. Papers come from the `past-paper-scout` skill. Needs `supabase/migrations/20261028_knowledge.sql` in production.
- **Ask Kix** (`/ask`, `lib/kix/homework.ts`, `/api/kix/homework`): homework help from a typed question or a photo (face-checked on the device, never stored), explained with the pack's syllabus methods as a visual lesson, guide-first.
- **Kix as guardian** (`lib/guardian`, spec `docs/prd/PARENT_INSIGHTS.md`): heartbeats (`/api/guardian/beat`), the child's words to Kix with the safety path (`/api/guardian/words`, and question reasons), flags, sessions and the next step, the parent's Today (`components/parent/ParentToday.tsx`). Needs `supabase/migrations/20261028_guardian.sql` in production; `node scripts/guardian-sample-sql.ts` prints Ari's sample week for a demo.
- **Content:** seven skill packs in `content/skills/`, all reviewed by the founder (P6 Maths has 40 original questions in `items/original-01.json`).
- **Design:** every Claude Design board is copied into `docs/design/boards/` (open one in a browser to see it; `ds/` beside them holds the tokens and fonts). The Game Arcade boards (`Arcade`, `StarTyper`, `WordGarden`, `NeonStrike`, `TypingPath`) are the spec for the games. `scripts/port-board.ts` turns a board into a first-pass React screen; image ids map through `docs/design/canvas-blob-map.json`.

## Tasks, in order

Each task: build it, check it in the browser at 390 and 1280 px wide (Playwright screenshots are fine), make typecheck, lint and tests pass, add a row to `PROGRESS.md`, and commit with the `Agent: Claude Code` trailer when the founder says to commit.

Tasks 1–4 were built by Muse Code during its 28 Oct trial (branches `muse/kid-nav`, `muse/learning-loop`, `muse/music`, `muse/grown-ups`, PRs #1–#4) and fixed on main after Claude Code's review; see "Muse Code trial" in `PROGRESS.md`. Task 5 onwards is Claude Code's.

1. **Kid navigation bar** (USER_STORIES §8.4 fix 1) — ✅ done on `muse/kid-nav`. One bar on every kid browsing page: Home, Learn, Play (the Arcade), Treasure, Vibe; bottom bar under 600 px, side rail from 600 px (design skill §3a). The avatar menu already exists: `components/nav/KidAvatarMenu.tsx` (Me, Switch profile). Hide the bar inside a question and during an Arcade round. Mount it in `app/(kid)/layout.tsx` next to the existing pieces (keep `<FocusWatch />` in its Suspense boundary). Play and Vibe render as disabled Soon tabs (same pattern as the admin sidebar) until tasks 5–6 build `/arcade` and `/vibe`; Learn opens the demo quest until task 2/5 builds `/learn`.
2. **The learning loop** (the demo's core; fixes 2, 3) — ✅ done on `muse/learning-loop`.
   - Switch Ari's quest from P4 "Light and shadows" to the **P3 frog life cycle** (founder decision): the quest map stops and the question come from the reviewed P3 Science items (`content/skills/p3-science`, life-cycles topic) through `lib/domain/selection.ts`.
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

## Things only the founder or Claude Code do

- Publish to the Claude Design canvas (Claude Code); copy boards back into `docs/design/boards/` after.
- Run SQL on Supabase (the founder pastes files from `supabase/` and `supabase/migrations/` into the SQL editor).
- Generate art or run live Meta model calls (they need the keys in `.env.local`).
- Anything in `.museignore`.
