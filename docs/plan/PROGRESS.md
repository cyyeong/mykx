# Progress and tool trail

Who built what, with which tool, and where it landed. Every agent adds a row when it finishes a piece of work (one row per commit or per finished task), so the trail stays complete for the judges and the video ("how myKx was built").

## Tools

| Tool | Maker | Used for |
|---|---|---|
| **Claude Code** (Opus) | Anthropic | Coding agent from 27 Oct: app, API, database, tests, scripts, docs; drives the Claude Design canvas and the Meta model calls below |
| **Claude Design** (canvas) | Anthropic | Screen designs and prototypes, about 30 boards ([canvas](https://claude.ai/artifact/8crEyKVQm9QxCHLDqPXioP), private; copies in `docs/design/boards/`) |
| **Muse Code** | Meta | Tried twice, then retired: an art-direction round on 27 Oct (31 images), and a coding trial on 28 Oct that built four branches (kid nav, learning loop, first music, grown-ups and the parent PIN; see the trail). Claude Code reviewed every branch, fixed what it found on main (a PIN bypass, retries counting as mastered, music that kept playing after mute) and has built everything since. See "Muse Code trial" below |
| **Muse Image 1.0** | Meta | All original art: backgrounds, Kix in five styles, cards, jets, critters, doors (44 images) |
| **SAM 3.1** | Meta | Kix cutouts in the Studio transform; living-art layers (leaves, clouds, islands, waterfalls, critter eyes); 68 cutouts |
| **Muse Spark** | Meta | Smoke tests; the planned tutor hints, evening summary and Notebook (Standard mode only) |
| **Muse Voice Transcribe** | Meta | Push-to-talk with Kix (`/talk`); audio never stored |
| sharp | open source | Living-art layers from the art's own pixels (neon lines, stars, haze), and the filled-sky plates (40 files, no model) |
| Supabase, Vercel | — | Sign-in, database with row-level security; hosting at https://mykx.vercel.app |
| Playwright | open source | Screenshots, frame-difference motion checks, flicker traces, PDF checks |

## Muse Code trial (28 Oct)

Muse Code (Meta's coding agent) was tried as a second builder on 28 Oct. The founder gave it the handover in `docs/plan/HANDOFF.md`; it worked on `muse/<topic>` branches and opened pull requests #1–#4, which the founder merged. Claude Code then reviewed all four.

- **What it built:** the kid navigation shell, the learning loop for the P3 frog life cycle (attempts, marking, ledger, question player, done page), the first background-music engine with five themes composed by Muse Code, and the grown-up area with a parent PIN.
- **What the review found and fixed** (`f364358`, `d50df86`, `63e63e7`, `aab5838`): the PIN could be skipped through Switch profile; a retry could master a stop; cards appeared without stars; Treasure lost its holographic cards; the music played outside its volume bus, kept playing after mute and hard-cut between pages; the demo label showed for every family.
- **Outcome:** the structure was useful and fast, but each branch needed review fixes. On 28 Oct the founder retired Muse Code, and Claude Code builds everything from then on. The music themes were recomposed by Claude Code (`aab5838`).

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
| 28 Oct | One kid navigation shell on every kid page: bottom bar under 600 px, side rail from 600 px (Home, Learn, Play, Treasure, Vibe; Play and Vibe show Soon until the Arcade and Vibe Zone land); hidden inside questions and Arcade rounds; Home's local tab bar removed; honesty label clears the bar | Muse Code | Muse Spark | a4fe3ed | |
| 28 Oct | The learning loop: Ari's quest is the reviewed P3 frog life cycle through selection; attempts route marks deterministically and pays the ledger under the daily cap; question player with next question, quest-complete page, leave confirm and card flight; map and Treasure read real mastery with evidence labels | Muse Code | Muse Spark | 33b6158 | |
| 28 Oct | Background music, composed by Muse Code as original work: five world themes as JSON scores (melody always on chord tones, per-mood layers and tempos) played by a seeded Tone.js sequencer on a −24 dB bus with fades; calm for learning, dreamy for Treasure, bright for Home, driving for the Arcade; Music switch beside the sound button (on for juniors, off for teens, remembered per device); ducks under Kix and the mic, pauses when hidden | Muse Code | Muse Spark | 0b13139 | Muse composed the music |
| 28 Oct | Grown-ups: sign-in lands parents on /parent and admins on People, honouring a safe ?next=; /parent shell with Today, Messages, Notebook, Family, Kids' doors and sign out here/everywhere; 4-digit parent PIN set once in Your family, asked on grown-up pages (shell and data routes) while a kid is signed in, 15-minute unlock; family back to /parent | Muse Code | Muse Spark | 5ea453b | |
| 28 Oct | Review of Muse Code's PRs, fixes on main: parent PIN can no longer be skipped through Switch profile (kids-here cookie, wrong-PIN pause from the audit log, PIN change flow); kids' focus notes need the PIN | Claude Code | — | f364358 | |
| 28 Oct | Review fixes for the kid nav and learning loop: demo line only for the demo family, quest button rides above the phone bar, a retry never masters a stop, cards only when stars are paid, HoloCards back in Treasure titled by their stop, quest-complete page redesigned (card reveal, Pip's growth track, each stop before → after) | Claude Code | — | d50df86 | The reward moment |
| 28 Oct | Map, done page and HUD polish: play glyph on untried stops, slimmer Pip track, header room for three sound buttons | Claude Code | — | 63e63e7 | |
| 28 Oct | Fit to screen on tablets and laptops: from 1024 px landscape every kid screen fills the window with no page scroll (quest map as a centred 16:10 stage over a blurred copy of its art, Home cards in one row, Treasure as a shelf whose cards size to the room left, done page in three columns, Studio, Me and the question page spaced by height); windows shorter than 720 px zoom the whole shell down instead; phones and portrait tablets still scroll | Claude Code | — | aab5838 | Same screen at 1280, 1440 and 2000 px |
| 28 Oct | Music engine fixed and the five world themes recomposed (32-bar forms, own progression per world, seeded variation); every note plays from the score on the beat grid, crossfades between worlds, bar-line mood changes, silent at once on mute; ambience is texture only (no random notes); a gentle Beat that follows the page (none while learning, energetic in games) with its own switch; the sound controls dock in the rail, and fold behind one Sound button on phones | Claude Code | — | aab5838 | The worlds' music |
| 28 Oct | Kix as guardian: screen-time heartbeats by activity (learn, play, make), the parent's limit and quiet hours, focus per session from answers, pauses and time away against the child's own usual, a first mood reading from the child's words to Kix, and urgent/watch/info flags with what we saw, what it may mean and what may help; Kix's next step balances learning, play and making and always says why; a kind break with a breathing guide and a wind-down; the safety path (caring reply, Tinkle Friend and SOS, urgent flag) on Talk to Kix and on question reasons; the parent Today view from the ParentDash board with screen time, today's balance and wellbeing; Ari's sample week labelled as sample | Claude Code | — | 6a83aaf | Kix the guardian: the parent's evening view |
| 28 Oct | Past-paper scout skill: the five admin-approved sites researched (robots.txt, terms, layouts, recency); a scout that finds the latest P3, P6 and Sec 2 papers, downloads only where robots.txt and terms allow, writes a by-hand click-list for the rest, and reports every problem; papers stay private (outside the repo) for the knowledge agent | Claude Code | — | 05285bc | |
| 28 Oct | Ask Kix (homework help): a typed question or a photo, checked for faces on the device (MediaPipe face detector; a face, or no check, means the photo isn't sent), shrunk and stripped of metadata, read once by Muse Spark (Standard, structured output) with the level's skill-pack methods; Kix guides first (hint → steps → full answer, enforced on the server) and explains as a visual lesson from a validated spec (steps, bar models, CER frame, memory hook, a fresh try-this); the safety path on the words; a cached sample when the model is unavailable; Ask Kix tab in the kid nav | Claude Code | Muse Spark | 43178c6 | Ask Kix: snap a homework question |
| 28 Oct | Knowledge agent (Admin → Add knowledge): several PDFs at once with their rights; Muse Spark (Standard, PDF input) reads each into question patterns, traps and marking cues (questions only for our own or licensed material; never from a school paper, enforced in code), routed to an existing pack or a proposed new one; approve or reject each entry; publishing makes the pack's next minor version, which Ask Kix reads straight away. Tested live on a Sec 2 mock paper (28 s, about $0.05) | Claude Code | Muse Spark | d66ac1f | The skill grows from new papers |
| 28 Oct | Paper connectors: sgexam through Google's Drive API (public files, API key, PDF-only, rate-limited, manifest with hashes); testpapersfree opens the next pages in the founder's browser, because its download sits behind reCAPTCHA and is never automated | Claude Code | — | 9212695 | |
| 28 Oct | Home on live data: stars from the ledger, the frog quest's progress, Pip's stage and what grows him next, the squadron's progress, and Kix's next step from the guardian with its reason; Home's buttons go somewhere. Studio finishable: Keep this Kix → Meet Pip → the world saved to the profile → Home; Change my Kix in the avatar menu | Claude Code | — | b3dc055 | Studio → Home |
| 28 Oct | Kix Tutor in the question player: hints and answers to "why?" streamed from Muse Spark (Standard) with the question's skill pack and worked steps, never giving the answer away (every ask counts as a hint); a "P3 Science skill loaded" chip; the question read aloud with word-by-word captions (the device's voice); "Ask Kix why" typed or by hold-to-talk; the item's own hint when the model is unavailable; the safety path on the child's words | Claude Code | Muse Spark, Muse Voice Transcribe | (this commit) | Asking Kix "why?" |

## How to add a row

- A commit can't contain its own hash: write `(this commit)`, and replace it with the hash in your next commit.
- One row per finished task or commit: date (SGT), what changed in plain words, the agent (Claude Code or Muse Code), the models and services used, the short commit hash, and a video moment if it's worth showing.
- Name Meta models exactly as above, so the video can count them.
- Never write a child's real name, a secret or a key here.
