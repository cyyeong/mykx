# myKx user stories, journeys and navigation audit

**Written:** Wed 28 Oct 2026 (Day 2). **Why:** pages lack a clear flow (missing back buttons, dead ends, unclear next steps). This doc lists what every kid, parent and admin needs to do, then checks every page against it. **Code snapshot:** the app as it stood on the morning of 28 Oct (13 pages, 12 API routes) and the 30 canvas boards in [myKx Screens](https://claude.ai/artifact/8crEyKVQm9QxCHLDqPXioP). **Sources:** `AGENTS.md`, `PRD_REVIEW.md` §3–4, `myKx_PRD.md` §4–6, `ACCOUNTS.md`, `PARENT_INSIGHTS.md`, `GAMES.md`, `SKILL_ENGINE.md`, `living-scenes.md`, `IMPLEMENTATION_PLAN.md` §1 and §4–5.

All names are synthetic demo learners (Jordan, Abby, Leonard) and the "Demo Parent". Never use real children's names in stories, tests or copy.

**Status words used below**

| Word | Meaning |
|---|---|
| **Built** | Works in the app now |
| **Partial** | In the app, but static, incomplete or with a gap named in the row |
| **Board** | Designed on the canvas, not in the app yet |
| **Spec** | Written in a PRD doc, not designed yet |
| **New** | New in this doc; needs design |

---

## 1. Personas

| Persona | Who | Device and setting | Signs in with | Lands on | Must never |
|---|---|---|---|---|---|
| **Jordan** (Junior) | P3, about 9. Loves frogs, bugs and jets. Short bursts of focus. Reads slowly; likes being read to. | Family tablet, landscape; sometimes the parent's phone | Door, then a 4-picture code | Home (Terrarium world) | see another child's work; meet a dead end with no picture to tap |
| **Abby** (Teen) | P6, about 12. PSLE year. Music and dance. Wants it to look grown-up. | Laptop with a keyboard, tablet | Door, then a password | Study deck (Idol Stage world) | be shown childish UI; be ranked against anyone |
| **Leonard** (Teen) | Sec 2, about 14. Space and drawing. Self-directed, studies late. | Laptop, phone | Door, then a password | Study deck (Anime Sky world) | be watched without knowing; have her messages read by a model |
| **Demo Parent** ("Mum") | Owns the household. Busy; checks in at 8 pm on a phone. Also an admin in the demo. | Phone first; tablet for handing over to a kid | Email and password | Parent dashboard (target) | see a diagnosis or label; lose an urgent safety flag to quiet hours |
| **Admin** | Platform content and support team. In the demo, the same Demo Parent account with the admin flag. | Laptop | Email and password (same door) | Skills catalogue (target) | see a child's messages, Notebook, answers or secrets |

---

## 2. Navigation model (target)

One rule for every page: **you can always see where you are, what to do next, and how to get back.**

### 2.1 Route map

Existing routes are in **bold**. The rest are proposed, following `IMPLEMENTATION_PLAN.md` §2 and the API's own `next` values.

| Area | Routes |
|---|---|
| Sign-in | **`/`** (redirect) · **`/signin`** · **`/doors`** · **`/doors/[kid]`** |
| Kid | **`/home`** (junior Home; teen study deck) · `/learn` (quest list) · **`/learn/[quest]`** · **`/question/[id]`** · `/learn/[quest]/done` (quest complete) · **`/treasure`** · `/squadron` · `/critters` · `/vibe` · `/arcade` · `/arcade/star-typer` · `/arcade/word-garden` · `/arcade/neon-strike` · `/arcade/path` · **`/studio`** · **`/me`** · message sheet on `/home` · **`/talk`** (sandbox; retire once voice is inside Question, Vibe Zone and the study deck) |
| Parent | `/parent` (dashboard with the Tonight card; `/api/auth/parent` already returns it) · `/parent/messages` · `/parent/notebook` · **`/family`** |
| Admin | `/admin/skills` · `/admin/skills/[id]` · `/admin/upload` · `/admin/agents` · **`/admin/people`** · `/admin/activity` (audit log and skill trace) · `/under-the-hood` |
| System | `app/not-found.tsx` and `app/error.tsx` with a way home for each role |

### 2.2 Global navigation per role

| Role | Compact (< 600 px) | Medium and up | Always there |
|---|---|---|---|
| **Kid** (both bands) | Bottom tab bar, 64 px plus safe area: **Home · Learn · Make (Vibe Zone) · Play (Arcade) · Treasure** | Left rail with icons and labels, same five | Header avatar → menu: **Me**, **Switch profile**. Sound HUD. Camera dot while focus help runs. Demo label. |
| **Kid task screens** (question, quest complete, Studio transform, game round, message sheet, focus break) | No tab bar. One exit top-left (✕ or ‹) with a confirm if work would be lost. One primary next step. | Same | Sound HUD |
| **Parent** | Bottom bar: **Today · Messages · Notebook · Family** | Left rail, same four | Kid switcher chips; **Kids' doors** button (hand the device over); account menu with **Sign out**, **Sign out everywhere**, and **Admin** for admins |
| **Admin** | Top bar with a menu button | Sidebar: **Skills · Add knowledge · Agents and tools · People · Activity · Under the hood** | Footer: **Back to my family** (if also a parent), **Sign out** |

> **Decision needed:** the design skill (§3a) lists the kid tabs as Home, Learn, Treasure, Vibe, Me. The Arcade came later (`GAMES.md` says "reached from Home's tab bar"). Six tabs don't fit at 344 px, so this doc moves **Me** to the avatar menu and adds **Play**. If you prefer Me as a tab, Arcade becomes a Home card instead.

---

## 3. User stories

Each row: **As a … I want … so that …**, then short acceptance criteria (AC) and where it stands now.

### 3.1 Kids: sign-in and switching profiles

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| K-01 | As **Jordan**, I want to find my own door on the family tablet, so that I can start without an email. | `/doors` shows one door per enabled kid (nickname, level, their world's Kix); a tap opens `/doors/[id]`; 56 px targets. | Built |
| K-02 | As **Jordan** on my first visit, I want to pick my 4-picture code with a grown-up, so that only I can open my door. | "Pick 4 pictures", then tap them again; a mismatch restarts calmly; saved hashed; first visit goes on to Sidekick Studio (K-19). | Partial: always lands on `/home` |
| K-03 | As **Abby or Leonard**, I want to open my portal with a password, so that it feels grown-up and private. | Password field with show/hide; Enter submits; success opens the study deck. | Built |
| K-04 | As **a kid who gets it wrong**, I want a calm message and another try, so that I don't feel told off. | Door rattles; "That's not it. Try again, or ask a grown-up."; no sound; the 5th wrong try starts a 1-minute rest with a visible countdown on the door and on `/doors`; the parent gets an info note. | Partial: no visible countdown; parent not told (TODO in `lib/auth/flows.ts`) |
| K-05 | As **a kid at the wrong door**, I want "Not you?", so that I can go back and pick mine. | Link on both looks goes to `/doors`. | Built |
| K-06 | As **a kid on a shared tablet**, I want "Switch profile" to close my session, so that my sibling can't press Back into my world. | Avatar → Switch profile ends the kid session, then `/doors`; Back from `/doors` does not reopen my Home. | Partial: goes to `/doors` but keeps the session |
| K-07 | As **a kid**, I want to sign out from Me, so that I decide when I'm done. | Me → Sign out → `/doors`; the grown-up stays signed in. | Built |
| K-08 | As **a kid coming back tomorrow**, I want to open my door again, so that my world stays mine. | Kid session lasts 12 h or until the grown-up signs out; then any kid page sends me to `/doors`, never a broken or someone else's page. | Partial: only `/home` and `/me` check |

### 3.2 Kids: Home and getting around

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| K-10 | As **Jordan**, I want Home to show today's quest with one big button, so that I know what to do next. | Quest name, length and honest mastery label from data; "Start today's quest" opens the quest map. | Partial: fixture "Shadows" |
| K-11 | As **Jordan**, I want to tap Pip's card, so that I can visit Pip in the Critter Lab. | Card links to `/critters`; progress text matches the ledger. | Partial: card not a link |
| K-12 | As **Jordan**, I want "See the squadron" to open my jets. | Button links to `/squadron`. | Partial: dead button |
| K-13 | As **Jordan**, I want "Make something" and the Make tab to open Vibe Zone. | Both link to `/vibe`. | Partial: dead button and tab |
| K-14 | As **a kid**, I want to reach the Arcade from Home and the study deck. | Play tab (or Home card) links to `/arcade`. | Board (Arcade only) |
| K-15 | As **a kid**, I want the same navigation on every browsing page, so that I can always get home. | Tab bar under 600 px, rail from 600 px; current item marked; hidden on task screens (§2.2). | Partial: Home only, three working tabs |
| K-16 | As **a kid**, I want to reach Me from anywhere. | Avatar menu → Me on every kid page. | Partial: nothing links to `/me` |
| K-17 | As **Jordan**, I want to poke the living scene, so that Home feels alive. | Cosmetic only: no stars, cards or mastery; hotspots after the content in tab order; still under reduced motion. | Built |
| K-18 | As **Abby or Leonard**, I want my study deck to show my subjects, my next session and Kix, with buttons that work. | Deck reads my level (P6 Maths and Science; Sec 2 Science); "Start session" opens the first question; "25 min focus" starts a timer; "Ask Kix" opens Talk to Kix; global nav present. | Partial: Sec 3 Physics fixture for both; all three buttons dead; no nav |
| K-19 | As **a new kid with no Kix yet**, I want my first visit to start in Sidekick Studio, so that Kix is mine from day one. | Kid sign-in returns `next=/studio` while the profile has no Kix; after Studio, Home. | Partial: sign-in always returns `/home` |

### 3.3 Kids: learn (quest map → question → hint → result → reward)

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| K-20 | As **Jordan**, I want the quest map to show which stops I've mastered and why today's stop was picked. | Stop states from mastery; "limited evidence" label; reason line; "Start today's quest"; global nav. | Partial: fixture; no nav |
| K-21 | As **a kid with several quests**, I want the Learn tab to list them, so that I can choose. | `/learn` lists quests by subject; with one quest it goes straight to its map. | Partial: tab hard-wired to `/learn/shadows` |
| K-22 | As **Jordan**, I want one question per screen with "question 2 of 3", so that it never feels long. | Progress bar; question from the quest's published skill. | Partial: one fixture question |
| K-23 | As **Jordan**, I want to ask Kix for a hint, so that I get unstuck without the answer. | Streamed hint from the Kix Tutor; after 10 s the item's reviewed hint; "Hint 1 of 2"; the parent sees hint use. | Partial: canned text |
| K-24 | As **Jordan**, I want to check my answer and try again kindly if wrong, so that mistakes feel safe. | Server marks deterministically; wrong: Kix explains, "Try again", no sound; only the first try counts toward mastery. | Partial: marked in the browser |
| K-25 | As **Jordan**, I want a reward card when I get it right, so that I can see what I earned and why. | Kix cheers; card shows the ledger reason (+2, +3 or +5; 15 a day cap); "Collect card" flies it to a Treasure icon in the header. | Partial: no flight; fixed numbers |
| K-26 | As **Jordan**, I want a "Next question" button, so that I know how to keep going. | Shows after correct, or after a second wrong try with "Show me how". | Partial: missing, flow ends at "Correct" |
| K-27 | As **Jordan**, I want a quest-complete screen, so that the quest has an ending. | Summary: questions, hints, mastery before and after with its evidence label; card earned; Pip's progress; buttons: **Back to the map** (primary), **See my Treasure**, **Home**. | New |
| K-28 | As **Jordan**, I want to leave mid-quest safely, so that I don't lose work. | ✕ asks "Leave the quest? Your answers so far are saved." → quest map. | Partial: leaves at once, nothing saved |
| K-29 | As **Jordan**, I want Kix to read the question aloud and to ask "why?" by voice. | Read-aloud with captions and word highlight ("Kix speaks with your device's voice"); hold-to-talk on the Kix bubble; typed box always there. | Partial: only in the `/talk` sandbox |
| K-30 | As **Abby or Leonard**, I want a focused study session, so that I can work through fresh questions fast. | Same engine, teen look, small HUD Kix, focus timer, "limited evidence" labels, session summary at the end. | Spec |
| K-31 | As **a kid who has finished every question**, I want an honest message, so that I'm not given made-up work. | "No new questions here yet." Offer delayed review labelled "no new mastery evidence", the Arcade or Vibe Zone. Never invent items or mastery (PRD §6). | Spec |

### 3.4 Kids: Treasure, Sky Squadron and Critter Lab

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| K-32 | As **Jordan**, I want to see every card I earned with when and why, so that I trust it. | Cards from the ledger; "Every card here was earned. Nothing is random."; my own name. | Partial: fixture, says "Jordan" for everyone |
| K-33 | As **Jordan**, I want a locked slot to tell me how to earn it, with a link to that quest stop. | "Finish the Shadow size stop…" links to the map stop. | Partial: text only |
| K-34 | As **Jordan**, I want my constellation to grow when a skill gets fresh evidence. | New line drawn on new evidence only. | Partial: static |
| K-35 | As **a kid**, I want to share a creation with family and stop sharing it. | "Share with family" and "Stop sharing" work; revoked versions vanish for Mum. | Partial: dead buttons |
| K-36 | As **Jordan**, I want to open Sky Squadron and Critter Lab from Treasure. | Collection tabs or tiles link to `/squadron` and `/critters`. | New |
| K-37 | As **Jordan**, I want to flip my earned jets for an insect fact and a flight idea. | Flip on tap; locked jets show "3 fresh questions away" with a link to today's quest; back to Treasure. | Board (no back) |
| K-38 | As **Jordan**, I want to see Pip's stage and what grows it next. | Stage from the ledger; "Pip never gets sick or sad if you take a break"; mealworm tab display-only. | Board |
| K-39 | As **Jordan**, I want to start a critter quest from the Lab. | "Start: order the life cycle" opens the question player. | Board (no target, no back) |

### 3.5 Kids: Sidekick Studio

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| K-40 | As **a kid**, I want to pick a world and two things I love, so that Kix and my app look like me. | Five worlds; whole app re-skins live; two interest chips; Transform enabled with two picked. | Built |
| K-41 | As **a kid**, I want to watch Kix transform with clear steps, so that the wait is fun. | Steps: Muse Image, SAM 3.1, colours; "Show me now"; after 35 s a ready-made look, labelled. | Built |
| K-42 | As **a kid**, I want to keep the Kix I like, or try again. | Two variants to choose from; Keep; "Try again (2 left today)". | Partial: one result, no limit shown |
| K-43 | As **a kid**, I want my Kix saved, so that it's there tomorrow and my first card is in Treasure. | Saved to my profile (`kix_url`); first card in Treasure. | Partial: kept only until reload |
| K-44 | As **Jordan** (loves bugs), I want to adopt Pip the tadpole or a mealworm. | Adopt step after Keep; Pip appears in the Critter Lab. | Board |
| K-45 | As **a kid**, I want a clear finish and a way out, so that I'm never stuck in Studio. | ✕ on the picker (back to where I came from); after Adopt, **Go to my Home**. | Partial: no exit anywhere |
| K-46 | As **a kid**, I want to change my world later. | Me → "Change my Kix" opens Studio. | New |

### 3.6 Kids: Talk to Kix (voice)

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| K-47 | As **Jordan**, I want to hold a button and talk, so that I don't have to type. | Push-to-talk only, up to 30 s; level ring; "Listening…". | Built (sandbox) |
| K-48 | As **Jordan**, I want to see what Kix heard before it answers. | "I heard: …" with **That's right** and **Say it again**. | Built (sandbox) |
| K-49 | As **Jordan**, I want Kix to talk back with captions. | Device voice with word highlight; label "Kix speaks with your device's voice". | Built (sandbox) |
| K-50 | As **a kid whose mic is blocked**, I want to type instead. | "Your mic is blocked. You can type instead."; typed box always visible. | Built |
| K-51 | As **a kid whose parent turned voice off**, I want to know before I try. | Mic hidden; "Voice is off. A grown-up can turn it on." shown up front; typing works. | Partial: refusal only after recording |
| K-52 | As **a kid**, I want voice where I need it: hints, the Vibe brief, "Ask Kix" on the deck. | Talk button in Question, Vibe Zone and the study deck. | Partial: sandbox only |

### 3.7 Kids: Vibe Zone

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| K-53 | As **Jordan**, I want to say or type what I keep forgetting, so that Kix makes something to help. | Brief by voice or text; Kix asks "Flashcards or a planner?" (planner shown as coming soon). | Board |
| K-54 | As **Jordan**, I want to make flashcards and flip them. | "Make it" → deck from a checked template; fixture deck if the model fails; tap to flip. | Board |
| K-55 | As **Jordan**, I want to change something and keep my first version. | "Make them harder" → version 2; version 1 kept. | Board |
| K-56 | As **Jordan**, I want to save it and share it with Mum. | Save to Treasure (+5, within the daily cap); Share with Mum; Stop sharing. | Board |
| K-57 | As **Jordan**, I want a way back when I'm done. | ✕/‹ to Home; "See it in Treasure" after saving. | Board (no exit) |

### 3.8 Kids: Game Arcade

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| K-58 | As **a kid**, I want an Arcade with games for my level. | Only games for my band and level; syllabus tag, stage, stars, Continue; "coming soon" cabinets not tappable. | Board |
| K-59 | As **a kid**, I want to see my time today. | "Today: 18 of 30 min"; counts toward the daily limit. | Board |
| K-60 | As **Jordan**, I want Star Typer with ghost hands, so that I learn which finger to use. | Right finger glows and reaches; bolts only on right keys; wrong keys: no sound, no penalty; calm mode. | Board |
| K-61 | As **Jordan**, I want a calm Word Garden where words grow flowers. | No timer; tap to play on touch screens. | Board |
| K-62 | As **Abby or Leonard**, I want Neon Strike: type the answer to fire, with combos and speed. | Reviewed items; challenge mode; "Run it back"; never changes mastery. | Board |
| K-63 | As **a kid**, I want my stars to be fair. | ★ finish, ★★ 90 %, ★★★ 96 % (teens also need speed). Same play, same stars. | Board |
| K-64 | As **a kid**, I want to go to the next level or replay. | Level-clear screen: **Next level** (plays the next level of the same game) and **Play again**; "My typing path" link. | Board (Next level opens the path) |
| K-65 | As **a kid**, I want my typing path and the keys I slip on. | Stages, stars, slips to practise; **Play next level** returns to the game I came from. | Board (always Star Typer) |
| K-66 | As **a kid**, I want to share my result card with family only. | Send my card → family messages and the parent dashboard; no strangers, no ranks; parent can delete. | Board |
| K-67 | As **a kid**, I want to pause or quit a round and get back to the hub. | Pause (Esc or button) with Resume and Quit; "‹ Arcade" on every game; "‹ Home" on the hub. | Board (no pause) |
| K-68 | As **a kid on a phone**, I want to know it's best with a keyboard. | Note on phones; Word Garden match mode playable by tapping. | Spec |

### 3.9 Kids: Me, messages and care

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| K-70 | As **a kid**, I want to change what Kix calls me. | Up to 20 characters; tip "Use a nickname, not your full name"; warning on two words. | Built |
| K-71 | As **Jordan**, I want to change my picture code. | Old code → new → tap again; never shown again. | Built |
| K-72 | As **Abby or Leonard**, I want to change my password. | Current, new, confirm; strength hint. | Built |
| K-73 | As **a kid**, I want to know what my grown-up can see. | Me lists in plain words: summary, signals, camera on or off, voice on or off, messages are private. | New |
| K-74 | As **Jordan**, I want Mum's message delivered by Kix on Home. | Kix bubble "Message from Mum" opens the sheet; Read it to me. | Board |
| K-75 | As **Jordan**, I want to reply with a quick reply, sticker, short text or voice note. | Voice is transcribed, audio discarded; "Only you and Mum can read this". | Board |
| K-76 | As **Jordan**, I want a clear way back after replying. | **Back to Home**, **Send another**, ✕ at any time. | Board |
| K-77 | As **a kid who tells Kix something worrying**, I want a kind answer and real help. | Kix answers with care and points to a trusted adult; helpline card: Tinkle Friend 1800 274 4788, SOS 1767; the parent gets an urgent flag at once. Kix never promises secrecy. | Spec |
| K-78 | As **a kid at my daily limit**, I want a kind goodbye that lets me finish. | Warning 5 minutes before; I finish the current question; Kix says goodnight; nothing lost. | Spec |
| K-79 | As **a kid past today's star cap**, I want to keep learning without confusion. | "You've earned today's 15 stars. Your learning still counts." | Spec |

### 3.10 Parents: sign-in and account

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| P-01 | As **the parent**, I want to sign in at the door and land on my dashboard. | Email and password; door and time tunnel; lands on `/parent`. | Built on `muse/grown-ups`: parents land on `/parent`, admins on `/admin/people` |
| P-02 | As **the parent**, I want a password reset by email. | "Forgot password?" sends a link; neutral wording that doesn't reveal accounts. | Built |
| P-03 | As **a parent already signed in**, I want `/signin` to let me continue. | "Continue as Demo Parent" or a redirect to my landing. | New |
| P-04 | As **a parent opening a link from a notification**, I want to land on that page after signing in. | `/signin?next=…` honoured for safe in-app paths. | Built on `muse/grown-ups` |
| P-05 | As **the parent**, I want to hand the tablet to a kid from any parent page. | "Kids' doors" in the parent header opens `/doors`. | Built on `muse/grown-ups` |
| P-06 | As **the parent**, I want to sign out on this device or everywhere. | Both in the account menu; everywhere also shuts the kids' doors. | Built on `muse/grown-ups` |
| P-07 | As **the parent**, I want to change my password and email. | Change password by email link; change email (board). | Partial: password only |
| P-08 | As **the parent**, I want grown-up pages to ask who I am when a kid is using the device. | Opening Your family, the dashboard or admin while a kid session is active asks for the 4-digit parent PIN (founder decision: PIN, not password). | Built on `muse/grown-ups` |
| P-09 | As **a new parent**, I want to create a family account. | Sign-up or invite flow. | Not designed (MVP uses seeded accounts; decision needed) |

### 3.11 Parents: family management and controls

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| P-10 | As **the parent**, I want a card per kid with level, world, last visit and sign-in status. | Card shows locked state in words, not colour only. | Built |
| P-11 | As **the parent**, I want to add a kid. | Nickname (tip), level sets the look, world, picture code or starting password, voice; never a full name or email. | Built |
| P-12 | As **the parent**, I want a clear next step after adding. | "Open Jordan's door now" link, or "Tell Abby the starting password in person". | Partial: text only, no door link |
| P-13 | As **the parent**, I want to reset a code or password. | Old one stops at once; "Open Jordan's door" link to set the new code together. | Built |
| P-14 | As **the parent**, I want to remove a kid safely. | Type the nickname to confirm. | Built |
| P-15 | As **the parent**, I want to know when a kid was locked out. | Card note plus an info flag on the dashboard. | Partial: card only |
| P-16 | As **the parent**, I want a daily limit per kid that the app respects. | 15 to 90 min or none; kid sees time left; K-78 behaviour. | Partial: saved, not enforced |
| P-17 | As **the parent**, I want quiet hours for alerts. | Non-urgent alerts wait till morning; urgent ones never wait. | Board |
| P-18 | As **the parent**, I want to switch voice off for a kid. | Kix goes text-only for that kid at once. | Built (setting and server check) |
| P-19 | As **the parent**, I want to switch camera focus help on for a kid (off by default). | See §4. | Board (toggle only) |
| P-20 | As **the parent**, I want to switch the Arcade off for a kid. | Play tab hidden; games refuse. | Spec |
| P-21 | As **the parent**, I want to set a weekly learning plan. | Days × minutes; Kix picks topics from mastery gaps. | Board ("Edit plan" goes nowhere) |
| P-22 | As **the parent**, I want my way back from Family to my dashboard. | Back goes to `/parent`. | Built on `muse/grown-ups` |

### 3.12 Parents: tonight's summary and the dashboard

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| P-23 | As **the parent**, I want tonight's summary per kid at 8 pm. | What happened, what it may mean, tomorrow; evidence and uncertainty ("limited evidence: 2 question families"). | Board |
| P-24 | As **the parent**, I want a short offline activity to do together. | "Together · 12 minutes" with steps; "We did this". | Board |
| P-25 | As **the parent of a kid who didn't study**, I want no guilt. | "Nothing recorded today; no catch-up needed." | Spec |
| P-26 | As **the parent**, I want the summary even if the AI is down. | Template text from the same numbers, labelled. | Spec |
| P-27 | As **the parent**, I want the dashboard to show what needs me first. | Flags, then screen time, plan, wellbeing, messages, controls; kid switcher; "All clear" state. | Board |
| P-28 | As **the parent**, I want screen time against the limit. | Today and 7 days; over-limit days marked; late-night use. | Board |
| P-29 | As **the parent**, I want plan adherence. | Done vs planned, overdue reviews, next session. | Board |
| P-30 | As **the parent**, I want wellbeing per session with the evidence. | Mood and focus 0–100 against the kid's own baseline; tap for "what we saw"; always "possibly". | Board |
| P-31 | As **the parent**, I want to see or delete a kid's signals. | List per kid; delete one or all. | Board (link goes nowhere) |

### 3.13 Parents: flags, messages and the Notebook

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| P-32 | As **the parent**, I want urgent flags at once, even in quiet hours. | Quote, time, Kix's reply, helplines; **Message Jordan**; **We talked**. | Board |
| P-33 | As **the parent**, I want watch flags with what we saw, what it may mean and what may help. | Evidence list; uncertain wording; **Message Jordan**; **Mark as seen**. | Board |
| P-34 | As **the parent**, I want info flags for plan, limit and lockouts. | Listed under the plan. | Board |
| P-35 | As **the parent**, I want "Mark as seen" to tidy, not erase. | Moves to history; deleting is a separate choice. | Spec |
| P-36 | As **the parent**, I want one thread per kid, and a way back. | List ↔ thread; back to the dashboard from the list. | Board (no way back from the list) |
| P-37 | As **the parent**, I want to send text, a quick encouragement or a Kix sticker. | Sticker tray; "Jordan will see it on Home". | Board |
| P-38 | As **the parent**, I want Kix to suggest a message when a flag fires. | "Jordan found Wednesday tricky. Send a hug?" with **Not now**. | Board (a "should") |
| P-39 | As **the parent**, I want to see my kid's replies. | Text, sticker or transcribed voice. | Board |
| P-40 | As **the parent**, I want messages kept private. | Never read by Kix or any model; inside the household only. | Spec |
| P-41 | As **the parent**, I want to read what Kix remembers about each kid. | Pages per kid; progress numbers quoted with a date from the records. | Board |
| P-42 | As **the parent**, I want to see what changed and undo it. | Last change with undo; full history. | Board ("See the full history" goes nowhere) |
| P-43 | As **the parent**, I want to edit or delete a line, or wipe the Notebook. | Edit or delete per line; wipe with a confirm. | Board (buttons go nowhere) |
| P-44 | As **the parent**, I want to open a creation or typing card my kid shared. | Opens a read-only view; gone once revoked. | New |

### 3.14 Admins

| ID | Story | Acceptance criteria | Now |
|---|---|---|---|
| A-01 | As **an admin**, I want to land on the skills catalogue after sign-in. | `next=/admin/skills` honoured. | Partial: lands on `/doors`; page doesn't exist |
| A-02 | As **an admin**, I want one sidebar to every admin area. | Skills, Add knowledge, Agents and tools, People, Activity, Under the hood; current marked; every link works. | Partial: People only; two links 404 |
| A-03 | As **the Demo Parent who is also an admin**, I want to move between family and admin. | "Admin" in the parent account menu; "Back to my family" in the admin sidebar. | New |
| A-04 | As **an admin**, I want to sign out from the admin area. | Sign out in the sidebar footer. | New |
| A-05 | As **a parent without admin rights**, I want a clear refusal and a way back. | "This page is for admins" with **Back to your family** (not only "Go to sign in"); the server refuses too. | Partial: only "Go to sign in" |
| A-06 | As **an admin**, I want to search and filter households and accounts. | Search; filters All, Parents, Kids, Admins, Locked. | Built |
| A-07 | As **an admin**, I want a detail panel per account. | Role, status, last sign-in, household members. | Built |
| A-08 | As **an admin**, I want to send a parent a password reset. | Email sent; audit row. | Built |
| A-09 | As **an admin**, I want to start a kid's code reset. | Old code stops; the parent sets the new one. | Built |
| A-10 | As **an admin**, I want to lock, unlock, disable and enable accounts. | Disable needs a confirm; never on myself. | Built |
| A-11 | As **an admin**, I want to add or remove the admin flag. | Never on myself; may ship read-only (plan cut). | Built |
| A-12 | As **an admin**, I want to be unable to see children's content. | No messages, Notebook, answers or secrets anywhere in admin. | Built |
| A-13 | As **an admin**, I want the full audit log. | All admins' actions, filter by actor, action and date. | Partial: this session only; link goes nowhere |
| A-14 | As **an admin**, I want the skills catalogue. | Filter by level and subject; version, status, reviewed and draft counts, coverage, which agents use it. | Board |
| A-15 | As **an admin**, I want a skill's detail. | Items by topic and status, references, versions. | Spec (no board) |
| A-16 | As **an admin**, I want the agents × skills matrix. | Auto, on demand, off; tools; limits; model locked to Standard. Read-only in the MVP. | Board |
| A-17 | As **an admin**, I want the live skill trace. | Loads, unloads, refusals and tool calls with times. | Board |
| A-18 | As **an admin**, I want to upload knowledge to a skill with its rights. | File type and size checks; rights: own, licensed, or school paper (private reference). | Board |
| A-19 | As **an admin**, I want extraction progress and a manual fallback. | Steps Upload, Extract, Review, Publish; on failure, enter items by hand. | Board |
| A-20 | As **an admin**, I want to review source and item side by side. | Approve, Edit, Reject; confidence flags; near-duplicates flagged. | Board ("Edit" goes nowhere) |
| A-21 | As **an admin**, I want to publish a new version and see it in use. | Minor version bump; Kix uses it next session; **View in catalogue** after publishing. | Board (no next step) |
| A-22 | As **an admin**, I want school-paper uploads kept private. | Only archetypes and statistics; their questions never served. | Spec |
| A-23 | As **an admin**, I want "Under the hood" for the demo. | Model runs, skill events, asset manifest, built 27 Oct to 4 Nov, synthetic-data label. | Spec |
| A-24 | As **an admin**, I want to reset the demo between takes. | "Reset demo" restores the seeded household. | Board |

---

## 4. New feature: on-device focus help (camera)

**Status:** spec'd as a stretch (`PARENT_INSIGHTS.md` §1, plan Day 6 stretch window, cut order item 1). The founder asked for it in full; this section is the complete spec. Hard rule 12 applies: **care, not surveillance.**

### 4.1 Rules

1. **Off by default.** Only a parent turns it on, per kid, on the dashboard's Controls (or Your family). A kid can pause it for a session.
2. **Visible whenever it runs.** A camera dot with a label sits in the HUD next to the sound toggle. The device's own camera light is on only while it runs. No hidden mode.
3. **On the device only.** The browser runs MediaPipe Face Landmarker locally. Frames live in memory for one inference and are dropped. **No image or video is stored, uploaded or sent to any model.** The model and WASM files load from our own origin, so no third party sees a request.
4. **Numbers, not pictures.** Only per-minute counts leave the device, inside the session's signals.
5. **Compared only with the kid's own baseline.** Never with other children. Shown to the parent only, as "possibly …" with evidence and confidence.
6. **Never changes mastery, stars, cards, Pip, the squadron or game stars** (hard rule 5).
7. **No emotion reading.** Only face away, eyes closed and yawns. No facial emotion recognition.
8. **Runs only during focus work:** a quest's questions, a teen study session and Arcade rounds. Never on Home, Treasure, Studio, Me, messages, sign-in or any grown-up page.

### 4.2 How it works

| Step | What happens |
|---|---|
| Load | Lazy-load the model only when the kid's toggle is on and a focus task starts. GPU delegate if available, else CPU. |
| Sample | About 5 frames a second from a small video frame; `numFaces: 2` so a second face can be spotted. |
| Per frame | Head pose (yaw, pitch) from the transformation matrix; `eyeBlinkLeft/Right` and `jawOpen` blendshapes; a quick brightness check of the downscaled frame. |
| Per minute | `validSec`, `towardSec` (face present, head within about 30° yaw and 25° pitch, eyes open), `awaySec`, `noFaceSec`, `eyesClosedEvents` (both eyes closed over 1.5 s), `yawns` (jaw open over 1.5 s), `multiFaceSec`, `lowLightSec`, `fps`. |
| Minute score | `focus = 100 × towardSec / validSec`. A minute with under 50 % valid seconds has no reading. |
| Baseline | The kid's median minute score (and spread) over the last 14 days, per device class (tablet and laptop cameras sit at different angles). Needs at least 60 valid minutes over 3 sessions. Until then: "Building Jordan's baseline", and no notes. |
| Drop | 3 valid minutes in a row with focus below `median − max(15, 2 × spread)`, or 3 or more eyes-closed events a minute for 2 minutes. |
| Nudge | At the next natural pause (after an answer is checked, or between game rounds), never mid-question or mid-word: Kix says "You've been working hard. Want a 3-minute stretch? I'll keep your place." **Take a break** / **Keep going**. At most once every 15 minutes and twice a session. |
| Break | A calm break screen: Kix stretches, a 3-minute timer, **I'm back**. The session clock pauses; break time is shown to the parent as a break, not as learning time. |
| Parent note | In that session's wellbeing row: "**Possibly losing focus** after 7:50 pm" or "**Possibly sleepy**", with what we saw ("Looked away about 22 s a minute for 4 minutes; Jordan's usual is about 6 s"; "Kix suggested a break; Jordan took it"), confidence (high, medium, low from valid minutes and the size of the drop) and the source "Camera, this device only". |
| Watch flag | Focus well below baseline in 3 sessions within a week raises the existing watch flag (`PARENT_INSIGHTS.md` §2). |
| Data | `signals` rows (kind `camera_focus`, per-minute counts as JSON, confidence). Kept 4 weeks for the baseline, then dropped. The parent can delete them any time. |

### 4.3 Stories

| ID | Story | Acceptance criteria |
|---|---|---|
| F-01 | As **the parent**, I want to turn focus help on for one kid, so that Kix can suggest breaks when they're flagging. | Toggle per kid, off by default; plain text: "Uses the camera on this device to notice looking away, eyes closing and yawns. No pictures or video are kept or sent."; takes effect at the kid's next focus task, never mid-question. |
| F-02 | As **Jordan**, I want to be told before the camera starts, so that nothing happens behind my back. | First time: a sheet "Your grown-up turned on focus help…" with **Allow camera** and **Not now**, before the browser's own prompt. |
| F-03 | As **Jordan**, I want to see when the camera is on. | Camera dot plus the words "Focus help on" in the HUD whenever frames are read; screen-reader label; not colour alone. |
| F-04 | As **Jordan**, I want to pause it. | Tap the dot → "Pause for this session"; the camera stops at once; the parent sees "paused this session", with no blame. |
| F-05 | As **Jordan**, I want Kix to offer a break when I'm flagging, not tell me off. | Nudge rules in §4.2; Kix never says "I saw you yawn"; **Keep going** is always fine. |
| F-06 | As **the parent**, I want a "possibly losing focus" note with evidence and confidence. | Note in the session row and tonight's summary; "possibly"; against the kid's own baseline; source labelled. |
| F-07 | As **the parent**, I want no notes until there's a fair baseline. | "Building Jordan's baseline (23 of 60 minutes)". |
| F-08 | As **the parent**, I want to see and delete camera signals. | Listed with other signals; delete one or all; turning the toggle off offers "Also delete past camera signals?". |
| F-09 | As **the parent**, I want proof it never affects learning records. | Dashboard note: "Focus help never changes scores, stars or cards." Tests assert it. |
| F-10 | As **Jordan**, I want Me to explain it in plain words. | Me → What my grown-up can see → "Focus help: on. The camera counts looking away, eyes closing and yawns. No pictures are saved." |
| F-11 | As **the parent**, I want to know when it couldn't run, and why. | "No camera found", "Camera not allowed", "Too dark to read", "This device is too slow" in the session row. |
| F-12 | As **the parent**, I want a safety switch for the whole feature. | Turning it off stops a running camera within 30 s (next heartbeat), the dot disappears, and no more counts are written. |

### 4.4 Scenario

1. Mum opens the dashboard, Controls, **Camera signals** for Jordan, and switches it on. The sub-line says "On, this device only. No image or video leaves it."
2. Next evening Jordan opens the frog quest. Before question 1 a sheet explains focus help. Jordan taps **Allow camera**; the browser asks; Jordan allows.
3. The HUD shows the camera dot, "Focus help on". Jordan answers two questions.
4. Around 7:50 pm Jordan keeps looking away. After 3 low minutes, once question 3 is checked, Kix offers a stretch. Jordan taps **Take a break**; a 3-minute break screen runs; **I'm back** returns to the quest at the same place.
5. Jordan finishes. The camera stops and the dot goes away. The session's per-minute counts are sent with the session close.
6. At 8 pm Mum's summary says: "Possibly losing focus after 7:50 pm. Looked away about 22 s a minute for 4 minutes (Jordan's usual is about 6 s). Kix suggested a break and Jordan took it. Confidence: medium. Camera, this device only." Stars, cards and mastery are unchanged.

### 4.5 Edge cases

| Case | What happens |
|---|---|
| No camera | Feature stays off silently for the kid; the parent sees "No camera found on this device". |
| Permission denied or "Not now" | No browser re-prompt that session; the quest runs normally; parent sees "Camera not allowed"; Me shows how to allow it. |
| Parent toggles off mid-session | Camera stops within 30 s; dot disappears; counted minutes kept unless deleted; Kix says nothing. |
| Parent toggles on mid-session | Starts at the next focus task, with the explainer sheet first. |
| Kid pauses it | Stops at once for this session; neutral note to the parent. |
| Poor lighting | Low-light seconds are not valid; under half valid means no reading for that minute; if most of the session is dark, "Too dark to read focus". At most one quiet tip a session: "It's a bit dark. A lamp helps your eyes too." |
| Multiple faces (a sibling or parent helping) | Those seconds are marked shared and not counted; never a note from them. |
| Glasses or glare | Head pose carries most of the signal. If eye readings are unstable (impossible blink rates), eye signals are dropped for that session and confidence lowered. The kid's own baseline absorbs a steady difference. |
| Kid leaves the desk | No face for over 60 s counts as "away", not low focus; after 2 minutes the session pauses (as for idle input); Kix says "Welcome back" on return. |
| Tab hidden or app in background | Camera track stops while hidden (the light goes off); hidden time is already counted by Page Visibility; restarts when visible. |
| Older laptop too slow | If inference takes over 150 ms a frame, drop to 2 fps; if still over 300 ms, or the page drops below 30 fps, stop and tell the parent "This device is too slow for focus help". The question UI never stutters for it. |
| Camera busy in another app | Off for this session; parent sees "Camera was in use". |
| Model fails to load (offline or blocked) | Off for this session; the counts already taken stay on the device until the session closes online. |
| Switching kids on the device | Camera stops on Switch profile; the next kid's own toggle decides. |
| Teen on a phone | Same rules; front camera only; portrait angle uses its own device-class baseline. |
| A kid with a condition that affects gaze or blinking | The parent keeps it off; copy never suggests a diagnosis. |
| Safety words during a session | The safety path runs as usual; camera signals never trigger or suppress it. |

---

## 5. End-to-end journeys

### J1. Demo path (the video, `IMPLEMENTATION_PLAN.md` §5)

| # | Beat | Page | Works today? |
|---|---|---|---|
| 1 | Demo Parent signs in (off camera) | `/signin` → tunnel → `/doors` | Yes |
| 2 | Jordan taps their door and 4 pictures; the door opens into the tunnel | `/doors/[ari]` | Yes |
| 3 | First visit: Studio. Terrarium, bugs and critters, jets → Transform → reveal → Keep → Adopt Pip → **Go to my Home** | `/studio` | No: not reachable; no adopt; no finish |
| 4 | Home: today's quest, Pip, the squadron (cut to phone and foldable) | `/home` | Partly: fixture data; Pip and squadron cards dead |
| 5 | Learn: quest map, "P3 Science skill loaded" chip, Start | `/learn/[quest]` | Partly: shows P4 "Light and shadows", not the P3 frog life cycle |
| 6 | Kix reads the question aloud; Jordan asks "why?" by voice; streamed hint; correct; Kix cheers; card flies; "57, limited evidence" | `/question/[id]` | Partly: no read-aloud, voice or flight |
| 7 | Quest complete → See my Treasure | `/learn/[quest]/done` | No: page missing |
| 8 | Treasure → Sky Squadron card flip → Critter Lab, Pip grows | `/treasure`, `/squadron`, `/critters` | Partly: Treasure only, no exits |
| 9 | Vibe Zone: says "I keep forgetting the frog life cycle" → flashcards → Save → Share with Mum | `/vibe` | No |
| 10 | Parent phone: "Jordan seemed tired in 3 evening sessions", screen time → Message Jordan with a sticker | `/parent`, `/parent/messages` | No |
| 11 | Tablet: Jordan's Home shows "Message from Mum" → reply with a sticker | `/home` sheet | No |
| 12 | Flash of What Kix remembers | `/parent/notebook` | No |
| 13 | Admin: catalogue → Add knowledge → upload → six questions extracted → approve → version 1.1 published | `/admin/skills`, `/admin/upload` | No (links 404) |
| 14 | Under the hood: trace and model runs | `/under-the-hood` | No |

### J2. Jordan's first day (new kid)

1. Parent: `/family` → **Add a kid**: "Jordan", P3 (junior look), Terrarium, picture code, voice on → **Add kid** → success card → **Open Jordan's door now** (P-12).
2. `/doors/[ari]`: "Pick 4 pictures" → tap again → saved → tunnel → **`/studio`** (K-19).
3. Studio → Keep → Adopt Pip → **Go to my Home**.
4. Home shows "Start today's quest". Empty-state copy everywhere else ("Your first card is waiting in your first quest").

### J3. Jordan's normal evening

`/doors` → Jordan's door → code → `/home` → Kix: "Message from Mum" → reply with a sticker → **Back to Home** → **Start today's quest** → map → 3 questions (hint on one) → quest complete → **See my Treasure** → new card → Home → avatar → **Switch profile** (session ends) → `/doors`.

### J4. Abby's study session (P6, teen)

`/doors` → Abby's portal → password → study deck (P6 Maths: before-and-after ratio) → **Start session** → 3 fresh questions; on one she taps **Ask Kix** and types "why is the total the same?" → session summary with "limited evidence" → Play tab → **Neon Strike** → round clear → **Save and share** → typing path → **Send my card** → avatar → Me → **Sign out**.

### J5. Leonard with the mic blocked

Leonard opens Vibe Zone on her laptop, holds the mic, the browser blocks it → "Your mic is blocked. You can type instead." → she types the brief → flashcards → Save → the deck shows on her Treasure shelf. Later Mum turns voice off for Leonard; next time the mic is hidden and the note says "Voice is off. A grown-up can turn it on."

### J6. Jordan's typing practice

Home → Play → Arcade (only P3 games; "Today: 18 of 30 min") → **Star Typer** → posture card → level → level clear ★★★ → **Next level** → … → **My typing path** → slips "B and N" → **Send my card** → Mum sees it in messages and replies with a sticker.

### J7. Wrong code and lockout

Jordan taps the wrong pictures 5 times. Each time: rattle, calm line. On the 5th: "Let's take a short break. Try again in a minute, or ask a grown-up." with a 60-second countdown; Jordan's door on `/doors` shows "Resting · 0:42". Mum's dashboard gets an info note: "Jordan had a few tries at their code at 6:12 pm". If Jordan has forgotten it, Mum: `/family` → **Reset code** → **Open Jordan's door** → they pick a new one together.

### J8. Parent evening check-in

Phone: `/signin` → `/parent` → watch flag "Jordan seemed tired in 3 evening sessions" (what we saw, may mean, may help) → **Message Jordan** → thread → Proud of you sticker → back → Today → Tonight card for Jordan → do the torch activity → **We did this** → Notebook → edit the line "Rushes MCQs" → done → account menu → **Sign out**.

### J9. Parent sets controls

`/parent` → Controls: Abby's daily limit 45 min; quiet hours 8:30 pm to 7 am; voice off for Leonard; camera on for Jordan (§4.4). Every change saves at once and says so.

### J10. Safety path (urgent flag)

Leonard types to Kix late at night: "I feel like giving up on everything." Kix replies with care, suggests talking to a trusted adult, and shows Tinkle Friend 1800 274 4788 and SOS 1767. The parent's dashboard shows an urgent flag at once, even in quiet hours: the quote, the time, Kix's reply, the helplines, **Message Leonard** and **We talked**. Nothing changes Leonard's mastery or rewards.

### J11. Focus help

See §4.4.

### J12. Switching kids on one tablet

Jordan finishes → avatar → **Switch profile** → session ends → `/doors` → Abby opens her portal. Pressing Back shows the doors, not Jordan's Home. Jordan's camera (if on) stopped at Switch profile; Abby's world, sound default (off for teens) and voice setting take over.

### J13. Kid session expires

Jordan leaves the tablet on Home overnight. Next morning (over 12 h) Jordan taps **Start today's quest** → `/doors` with Jordan's door highlighted → code → straight back to the quest map Jordan asked for.

### J14. Admin publishes knowledge

Admin signs in → `/admin/skills` → filter P3 → P3 Science card → **Add knowledge** → upload a worksheet (rights: own material) → extraction progress → review 6 items side by side, edit one, reject one → **Publish 1.1** → **View in catalogue** → Activity: the trace shows Kix loading v1.1 in Jordan's next session.

### J15. Admin support and audit

People → search "Abby" → detail → **Start code reset** → confirm → audit row → **See the full audit log** → filter by today.

### J16. Non-admin at an admin link

Demo Parent without the admin flag opens `/admin/people` → "This page is for admins" → **Back to your family** → `/parent`.

### J17. Offline mid-quest

Jordan's Wi-Fi drops on question 2. A banner: "You're offline. Your answer is safe; Kix will check it when you're back." **Check my answer** waits; on reconnect the answer is sent once (idempotent ledger key), marked, and the flow continues.

---

## 6. Page flow map

"Arrive from" lists every inbound path. "Global nav" is what should be there (§2.2); gaps are in the audit (§8).

### 6.1 Sign-in and kid pages

| Page | Route · board | Status | Arrive from | Primary next step | Back / exit | Global nav |
|---|---|---|---|---|---|---|
| Front door | `/` | Built | typed URL | redirect to `/signin` (target: signed-in kid → `/home`, grown-up → landing) | — | — |
| Sign in (grown-ups) | `/signin` · Login | Built | `/`, signed-out gates, Switch grown-up, sign out | **Sign in** → tunnel → `/parent` or `/admin/skills` (today `/doors`) | "Kids: find your door" → `/doors` | sound HUD |
| Who's learning? | `/doors` · KidDoors | Built | grown-up sign-in, Switch profile, Me sign out, "Not you?", Family back | tap a door → `/doors/[kid]` | Switch grown-up → `/signin`; Manage family → `/family`; (target) Parent dashboard | sound HUD, demo label |
| Kid door | `/doors/[kid]` · LoginJunior, LoginTeen | Built | `/doors`, Family "Open Jordan's door" | code or password → tunnel → `/home` (first visit: `/studio`) | "Not you?" → `/doors` | sound HUD |
| Home (junior) | `/home` · Home | Partial | kid sign-in, Home tab, Me back, quest complete, message sheet | **Start today's quest** → `/learn/[quest]` | avatar → Me / Switch profile | kid tab bar or rail |
| Study deck (teen Home) | `/home` (teen) · StudyDeck | Partial | kid sign-in, Home tab, Me back | **Start session** → first question | avatar → Me / Switch profile | kid tab bar or rail (teen look) |
| Message from Mum | sheet on `/home` · KidMessage | Board | Kix bubble on Home | **Send** reply | ✕ and **Back to Home** | none (sheet) |
| Learn list | `/learn` | New | Learn tab | pick a quest → map | Home tab | kid nav |
| Quest map | `/learn/[quest]` · QuestMap | Partial | Learn tab, Home quest card, question ✕, quest complete | **Start today's quest** → `/question/[id]` | Home tab | kid nav |
| Question and reward | `/question/[id]` · Question | Partial | quest map, Critter Lab quest, study deck | **Check** → **Next question** → … → quest complete | ✕ (confirm) → quest map | task screen: no tab bar |
| Quest complete | `/learn/[quest]/done` | New | last question | **Back to the map** | See my Treasure, Home | task screen |
| Treasure Realm | `/treasure` · Treasure | Partial | Treasure tab, "Added to your Treasure", quest complete, Vibe save | browse; open a collection | Home tab | kid nav |
| Sky Squadron | `/squadron` · SkySquadron | Board | Home squadron card, Treasure collections | flip a jet | ‹ Treasure | kid nav |
| Critter Lab | `/critters` · CritterLab | Board | Home Pip card, Treasure collections, Studio adopt | **Start: order the life cycle** → question | ‹ back to where I came from | kid nav |
| Sidekick Studio picker | `/studio` · Main | Partial | first visit, Me "Change my Kix" | **Transform Kix** | ✕ → previous page or Home | none (task) |
| Transform and reveal | overlay in `/studio` · StudioReveal | Partial | Transform | **Keep this Kix** → Adopt Pip → **Go to my Home** | ✕ → picker; Try again | none (task) |
| Talk to Kix | `/talk` (sandbox) · VoiceSound | Partial | nothing (typed URL) | hold to talk | none | none |
| Vibe Zone | `/vibe` · VibeZone | Board | Make tab, Home "Make something" | **Make it** → Save → Share | Home tab; "See it in Treasure" | kid nav |
| Arcade hub | `/arcade` · Arcade | Board | Play tab, Home card, study deck | a cabinet → game | "‹ Home" | kid nav |
| Star Typer | `/arcade/star-typer` · StarTyper | Board | Arcade cabinet, typing path | play → level clear → **Next level** | "‹ Arcade" (pause first) | none (task) |
| Word Garden | `/arcade/word-garden` · WordGarden | Board | Arcade cabinet | play → round end | "‹ Arcade" | none (task) |
| Neon Strike | `/arcade/neon-strike` · NeonStrike | Board | Arcade cabinet | play → **Run it back** / **Save and share** | "‹ Arcade" | none (task) |
| Typing path and share | `/arcade/path` · TypingPath | Board | Arcade link, game "Save and share" | **Play next level** (same game) · **Send my card** | "‹ Arcade" | kid nav |
| Me | `/me` · KidMe | Built | (target) avatar menu | save nickname or code | ‹ Home; **Sign out** → `/doors` | kid nav |
| Focus break | overlay on focus tasks | New | Kix nudge | **I'm back** → same place | — | none (task) |

### 6.2 Parent and admin pages

| Page | Route · board | Status | Arrive from | Primary next step | Back / exit | Global nav |
|---|---|---|---|---|---|---|
| Parent dashboard (Today) | `/parent` · ParentDash | Board | grown-up sign-in, Family back, admin "Back to my family" | act on the top flag | Kids' doors; account menu | parent bar or rail |
| Tonight's summary | card on `/parent` · Parent | Board | dashboard, 8 pm notice | **We did this** | (card) | parent nav |
| Family messages | `/parent/messages` · FamilyChat | Board | Messages tab, "Message Jordan", "Open messages" | send | list ↔ thread; Today tab | parent nav |
| What Kix remembers | `/parent/notebook` · Notebook | Board | Notebook tab | read, edit, undo | Today tab | parent nav |
| Your family | `/family` · FamilyAccounts | Built | Family tab, doors "Manage your family", "Add a kid" | add or manage a kid | ‹ Back (today `/doors`; target `/parent`) | parent nav |
| Skills catalogue | `/admin/skills` · AdminSkills | Board | admin sign-in, sidebar | open a skill; **Add knowledge** | sidebar | admin sidebar |
| Skill detail | `/admin/skills/[id]` | Spec | catalogue card | review items | ‹ Skills | admin sidebar |
| Add knowledge | `/admin/upload` · AdminUpload | Board | sidebar, catalogue button | upload → review → **Publish** → View in catalogue | sidebar | admin sidebar |
| Agents and tools | `/admin/agents` | Board (part of AdminSkills) | sidebar | read the matrix | sidebar | admin sidebar |
| People | `/admin/people` · AdminPeople | Built | sidebar | search → act | sidebar | admin sidebar |
| Activity and audit log | `/admin/activity` | New | sidebar, "See the full audit log" | filter | sidebar | admin sidebar |
| Under the hood | `/under-the-hood` | Spec | sidebar | read | sidebar | admin sidebar |
| Not found / error | `not-found.tsx`, `error.tsx` | New | any bad link or crash | **Take me home** (by role) | — | — |

---

## 7. Edge cases and error states

### 7.1 Sign-in, sessions and switching

| Case | Should happen | Now |
|---|---|---|
| Wrong grown-up password | "That's not it. Try again, or reset your password."; too many: "Too many tries. Wait a minute, then try again." | Built |
| Wrong kid code or password, 5 times | 1-minute rest; calm line; countdown on the door and on `/doors`; info note to the parent | Partial: no countdown; door shows rest to screen readers only; no parent note |
| Kid locked by an admin | "Ask a grown-up to unlock your door" (no "try in a minute") | Partial: says "Try again in a minute" |
| Kid account disabled by an admin | Door hidden; Family card says it was turned off and who to ask | Partial: door hidden; the card doesn't say (the API sends `disabled`) |
| Kid session over 12 h, or grown-up signed out | Next kid page → `/doors` (→ `/signin` if no grown-up); after the code, back to the page asked for | Partial: `/home` and `/me` only; no return |
| Signed-out deep link (e.g. `/treasure`) | `/signin?next=/treasure` → doors → kid code → `/treasure` | Missing: Studio, Learn, Question, Treasure and Talk render fixture data to anyone |
| Kid opens a grown-up page on the family device | Ask for the grown-up password first | Missing: the parent session is on the device, so a kid can open `/family` (and `/admin/people` for an admin parent) |
| Door id from another household | Redirect to `/doors` | Built |
| Switching kids | Switch profile ends the kid session; next kid's world, sound default, voice and camera settings apply | Partial: session not ended |
| "Kids: find your door" while no grown-up is signed in | Explain "A grown-up signs in first" instead of looping | Missing: loops back to `/signin` |
| Grown-up already signed in visits `/signin` | "Continue as Demo Parent" | Missing |

### 7.2 Learn, Treasure and collections

| Case | Should happen | Now |
|---|---|---|
| Unknown quest or question id | Friendly not-found with "Back to my quests" | Missing: default 404 |
| No items left in a quest | "No new questions here yet"; delayed review labelled "no new mastery evidence"; Arcade or Vibe Zone | Spec |
| All quests mastered | Celebrate; offer review, Arcade, Vibe Zone; "content coming soon" for other subjects; never invent work | Spec |
| New kid, no evidence | Mastery hidden ("Not yet assessed"), not 50 | Spec (PRD §6) |
| Hint model slow (over 10 s) | Reviewed hint from the item, no error shown | Spec |
| Daily star cap reached | Learning still counts; "today's 15 stars earned" | Spec |
| Leave mid-quest | Confirm; answers kept | Missing |
| Treasure with no cards | "Your first card is waiting in your first quest" + Start | Missing |
| Offline | Banner; answer kept; sent once on reconnect | Missing |

### 7.3 Studio, voice and Vibe Zone

| Case | Should happen | Now |
|---|---|---|
| Transform slow or failing | After 35 s or "Show me now": the ready-made world Kix, labelled | Built |
| Transform limit reached | "Try again tomorrow"; Keep still works | Missing |
| Signed-out Studio | Redirect to doors | Missing (the API refuses, so only the fallback shows) |
| Mic denied or unsupported | Typed box; "Your mic is blocked. You can type instead." | Built |
| Voice off for this kid | Mic hidden up front; text only | Partial: refused after recording |
| Clip over 30 s | Recording stops at 30 s; transcript of what was said | Built |
| Transcription fails | "Kix couldn't hear that. Try again or type it." | Built |
| No device voice | Captions still show; label stays | Spec |
| Vibe spec fails or is invalid | Fixture deck, labelled | Spec |
| Share revoked | Mum's view shows "No longer shared" | Spec |

### 7.4 Arcade

| Case | Should happen | Now |
|---|---|---|
| Parent switched the Arcade off | Play tab hidden; direct link explains | Spec |
| Daily limit reached mid-round | Round finishes; result saved; goodbye | Spec |
| Phone without a keyboard | "Best with a keyboard"; Word Garden tap mode | Spec |
| Coming-soon cabinet tapped | Not a link; "Coming soon" announced | Board links to itself |
| Tab hidden mid-round | Auto-pause | Spec |

### 7.5 Parent and admin

| Case | Should happen | Now |
|---|---|---|
| New family, no kids | Doors: "Add your first kid"; Family: "No kids yet"; dashboard: "Add a kid to see their week" | Built for doors and Family; dashboard missing |
| Kid with no sessions yet | Summary: "Nothing recorded today; no catch-up needed"; signals: "Building a baseline" | Spec |
| Summary model down | Template text from the same numbers, labelled | Spec |
| Urgent flag during quiet hours | Shown at once | Spec |
| Admin without rights | "This page is for admins" + **Back to your family** | Partial: only "Go to sign in" |
| Admin acts on self | Lock, disable and admin removal refused | Built |
| Cross-household access by URL or API | Refused by the server and RLS | Built for doors and family routes (tested) |
| Admin link to an unbuilt page | Hide the link until the page exists | Missing: `/admin/skills` and `/admin/upload` 404 |

### 7.6 Everywhere

| Case | Should happen | Now |
|---|---|---|
| Reduced motion | Door crossfade; living scenes still; reward flight becomes a fade; game meteors become sliding cards; focus break timer static | Built for sign-in and scenes |
| 344 px wide | No horizontal scroll; tab bar 64 px plus safe area; options stacked at 56 px; admin top bar with menu | Partial (per board) |
| Crash | `error.tsx`: "Something went wrong" + **Try again** + **Take me home** | Missing |
| Bad URL | `not-found.tsx` with a way home per role | Missing |
| Slow page load | Themed skeleton, not a blank colour | Partial: blank Suspense fallbacks |
| Synthetic data | "Demo family · synthetic data" on signed-in pages | Built |

---

## 8. Navigation audit

Checked on 28 Oct against the stories above. Severity: **blocker** (breaks the demo path or strands a user), **should** (real gap or risk), **nice** (polish).

### 8.1 Every link and route target in the code

| Target | Used by | Exists? |
|---|---|---|
| `/signin` | Family and People gates, Switch grown-up, sign out everywhere | Yes |
| `/doors` | Home avatar, sign-in links (3), Me gate and sign out, Family back | Yes |
| `/doors/[id]` | doors, Family "Open Jordan's door" | Yes |
| `/family` | doors "Add a kid", "Manage your family" | Yes |
| `/home` | kid sign-in `next`, Me back (2), Home tab | Yes |
| `/learn/shadows` | Home Learn tab and quest CTA, Question ✕ | Yes (only this slug) |
| `/question/shadows-2` | Quest map CTA | Yes (only this id) |
| `/treasure` | Home tab, "Added to your Treasure" | Yes |
| `/admin/people` | People sidebar | Yes |
| `/admin/skills` | People sidebar; `/api/auth/parent` `next` for admins | **No (404)** |
| `/admin/upload` | People sidebar | **No (404)** |
| `/parent` | `/api/auth/parent` `next` for parents (ignored by the client) | **No** |
| `/me`, `/studio`, `/talk` | nothing links to them | Exist, **orphaned** |
| Dead buttons (no target) | Home: See the squadron, Make something, Vibe Zone tab. Study deck: Start session, 25 min focus, Ask Kix. Treasure: Stop sharing, Share with family | — |

### 8.2 App routes

| Route | Present | Missing (stories) | Severity | Fix |
|---|---|---|---|---|
| `/` | redirect to `/signin` | role-aware landing | nice | Redirect a signed-in kid to `/home` and a grown-up to their landing. |
| `/signin` | form, forgot, kids link, privacy line, tunnel, reduced motion | `next` ignored, always `/doors` (P-01, A-01); no return-to (P-04); kids link loops when signed out; no "Continue as" (P-03); privacy note not linked (ACCOUNTS §4.5) | should (blocker once `/parent` exists) | Use the API's `next` and a safe `?next=`; hide or explain the kids link when signed out; link the privacy note. |
| `/doors` | doors, add kid, manage family, switch grown-up, empty state | no dashboard or admin entry (P-05, A-03); locked door not visible (K-04); "Manage your family" is open to kids (P-08) | should | Add "Parent dashboard" for grown-ups; visible "Resting · 0:42" badge; grown-up password before grown-up pages. |
| `/doors/[kid]` | code or password, "Not you?", setup, lockout lines | first visit not sent to Studio (K-19); admin lock says "a minute" | should | Return `next=/studio` when no Kix; separate copy for an admin lock. |
| `/home` (junior) | avatar → doors, quest CTA, 3 working tabs, scene, HUD | Vibe tab and "Make something" dead (K-13); "See the squadron" dead (K-12); Pip card not a link (K-11); no Arcade (K-14); no Me (K-16); Switch profile keeps the session (K-06); world fixed to Terrarium; no message slot (K-74) | **blocker** | Wire the cards and tabs; shared kid nav (§2.2); avatar menu with Me and Switch profile that ends the session; read world from the profile. |
| `/home` (teen deck) | subject tabs, living room | no navigation at all (K-15); Start session, focus timer, Ask Kix dead (K-18); Sec 3 Physics shown to P6 and Sec 2 | **blocker** | Add the kid nav in the teen look; wire Start session to the question player, Ask Kix to voice, the timer to a focus clock; read level and subjects from data. |
| `/learn/[quest]` | stops, Start CTA | no back or nav (K-20); one slug only, others 404 (K-21); P4 shadows, not the P3 frog quest the video needs; no sign-in check | **blocker** | Add kid nav; `/learn` list; switch the demo quest to P3 life cycles; guard. |
| `/question/[id]` | ✕ → map, options, hint, check, try again, collect → Treasure link | no next question (K-26); no quest complete (K-27); ✕ without confirm (K-28); no read-aloud or voice (K-29); no flight to a Treasure icon (K-25); no sign-in check | **blocker** | Next question and `/learn/[quest]/done`; confirm on leave; Talk button and read-aloud; Treasure icon in the header as the flight target. |
| `/treasure` | cards, locked slot, constellation, shelf | no way back (K-15); no Squadron or Critter Lab (K-36); share buttons dead (K-35); says "Jordan" for everyone (K-32); no sign-in check | **blocker** | Kid nav; collection tabs; wire share; read from the ledger; guard. |
| `/studio` | worlds, interests, transform, Show me now, Keep, Try again, close | unreachable (K-19, K-46); no exit or finish (K-45); Kix lost on reload (K-43); no adopt (K-44) | **blocker** | First-visit route and Me "Change my Kix"; ✕ on the picker; Keep → Adopt → Go to my Home; save `kix_url`. |
| `/talk` | hold to talk, confirm, typed box, voice label | orphaned, no exit (K-52); voice-off known only after recording (K-51) | nice | Move the Talk button into Question, Vibe Zone and the deck; read `voiceEnabled` from `/api/me` and hide the mic. |
| `/me` | ‹ Home, Sign out, nickname, code, password, signed-out gate | no inbound link (K-16); "What my grown-up can see" (K-73); "Change my Kix" (K-46) | should | Avatar menu link; add the two sections. |
| `/family` | ‹ to doors, cards, reset, limits and voice, remove, add, change password, sign out everywhere, gate | back goes to doors (P-22); no plain sign out (P-06); no quiet hours, camera or Arcade controls (P-17, P-19, P-20); no door link after add (P-12); no admin entry (A-03); open to kids on the device (P-08) | should | Back to `/parent`; account menu; controls; "Open Jordan's door now"; grown-up re-check. |
| `/admin/people` | sidebar, search, filters, detail, actions, session log, gates | Skills and Add knowledge 404 (A-02); no Agents, Activity or Under the hood; no back to family or sign out (A-03, A-04); forbidden gate only offers sign-in (A-05); full audit log (A-13) | **blocker** (404s on the video path) | Build or hide the links; add the sidebar footer; "Back to your family" on the forbidden gate; `/admin/activity`. |
| (none) | — | `not-found.tsx`, `error.tsx` | should | Add both with "Take me home" by role. |

### 8.3 Canvas boards

| Board | Present | Missing | Severity | Fix on the board |
|---|---|---|---|---|
| Login (and LoginJunior, LoginTeen) | Kids link, Forgot password (`#forgot-password`), "Not you?" links | privacy link; admin landing not shown ("Opening your family dashboard" only) | nice | Add privacy link; show both landings. |
| KidDoors | doors → LoginJunior/LoginTeen; Add a kid and Manage → FamilyAccounts | Switch grown-up has no target; no Parent dashboard entry; no locked-door state | should | Link Switch grown-up → Login; add a dashboard link and a resting badge. |
| Home | tab bar (Home, Learn, Treasure, Vibe Zone) as local state | every button and the avatar have no target; no Arcade (Arcade's "‹ Home" implies one); no Me; no message slot | **blocker** | Link the cards and tabs; add Play and the avatar menu; show the KidMessage bubble. |
| StudyDeck | living room hotspots, subject tabs | no nav, no profile, no sign out; Start session, 25 min focus, Ask Kix no target; no Arcade (GAMES.md says it's reached from here) | **blocker** | Add the teen nav and avatar; link the three buttons. |
| QuestMap | Start today's quest (no target) | no back; no Learn list | **blocker** | Start → Question; kid nav. |
| Question | Leave quest (no target), hint, check, retry, collect | no Next question; no quest-complete board; no Talk button | **blocker** | Add Next and a Quest complete board; mic on the Kix bubble. |
| Treasure | share buttons (no target) | no back or nav; no Squadron or Critter Lab links | **blocker** | Kid nav; collection tabs. |
| SkySquadron | flip cards | no back; locked jets don't link to a quest | should | ‹ Treasure; link to today's quest. |
| CritterLab | tabs, "Start: order the life cycle" (no target) | no back | should | Link Start → Question; ‹ back. |
| Main (Studio picker) | world tiles, chips, Transform (no target) | no ✕ | should | ✕ top-left; Transform → StudioReveal. |
| StudioReveal | Show me now, Keep, Try again, Adopt Pip; "Pick a mealworm" (no target) | no finish after "Pip lives in your Critter Lab now"; no ✕ | **blocker** | **Go to my Home** (primary) and **Visit Pip** (secondary); ✕. |
| VibeZone | Make it, Make them harder, flip, Save, Share, Stop sharing; Flashcards, Planner, Change something, Add a mealworm card (no target) | no back; no "See it in Treasure" after saving | should | ‹ Home; link after save; mark Planner as coming soon. |
| VoiceSound | design preview of Talk to Kix and Study Song; Loop, Save (no target) | no exit (it's a preview) | nice | Treat as component specs, not a page. |
| Arcade | ‹ Home; cabinets → games; "My typing path and card" | "coming soon" cabinets link to the Arcade itself | nice | Make them non-links with "Coming soon". |
| StarTyper | ‹ Arcade; Play again; "Next level" → TypingPath | "Next level" opens the path, not the next level; no pause | should | Next level → next level of Star Typer; separate path link; Pause. |
| WordGarden | ‹ Arcade | no round-end screen (next, share) | should | Add a round-clear state like Star Typer's. |
| NeonStrike | ‹ Arcade; Run it back; Save and share → TypingPath | no pause | nice | Pause. |
| TypingPath | ‹ Arcade; Play next level → StarTyper; Send my card | Play next level always opens Star Typer (teens play Neon Strike) | should | Return to the game you came from. |
| KidMe | ‹ Home (deck for teens); Sign out → KidDoors | nothing links in (Home has no Me) | should | Avatar menu on Home and the deck. |
| KidMessage | ✕ and Back to Home → Home; Send another | — | — | Good model for every sheet. |
| FamilyAccounts | Back to dashboard → ParentDash; Limits and voice → ParentDash | Change email, Change password, Sign out everywhere, "Start" have no target; no plain sign out | should | Wire them; add the account menu. |
| Parent (Tonight's summary) | kid switcher, We did this | no way to the dashboard (it becomes a dashboard card per the plan) | nice | Fold into ParentDash as the Today card. |
| ParentDash | kid switcher, flag toggles, Camera and Voice switches | Message Jordan and Open messages have no target; Edit plan and See or delete signals are `#`; Daily limit and Quiet hours open nothing; no nav to Family, Notebook, Messages; no sign out or Kids' doors | **blocker** | Parent bar (§2.2); link Message → FamilyChat; add plan and signals sheets. |
| FamilyChat | list ↔ thread; Kix suggestion; stickers | no back to the dashboard from the list | should | Parent nav. |
| Notebook | kid and page switchers | See the full history is `#`; Edit line and Wipe have no target; no back | should | Parent nav; history sheet; edit and wipe confirms. |
| AdminSkills | level and skill pickers; matrix toggles; trace | sidebar items are not links; Add knowledge has no target; no skill detail board | **blocker** | Make the sidebar links; Add knowledge → AdminUpload; design skill detail. |
| AdminUpload | rights, items, Approve, Reject, Publish; Edit (no target) | sidebar items are not links; no next step after Publish | should | Links; "View in catalogue" after publish. |
| AdminPeople | sidebar links to Skills, Add knowledge, People; Close details | Agents and tools, Activity, See the full audit log are `#`; Export has no target; no back to family or sign out | should | Design Activity (audit log); sidebar footer. |
| (missing boards) | — | Learn list, Quest complete, parent shell nav, Under the hood, audit log, skill detail, focus break and camera explainer, daily-limit goodbye, offline banner, not-found and error, shared-creation viewer | should | Add these to the canvas before porting. |

### 8.4 Top 10 fixes, in priority order

1. **One kid navigation shell on every kid browsing page** (tab bar under 600 px, rail from 600 px, avatar menu with Me and Switch profile). Today Treasure, the quest map, the teen study deck and Studio have no way out but the browser's Back, and nothing links to Me. (K-15, K-16) — **Built** on `muse/kid-nav`: shell on all kid pages via `app/(kid)/layout.tsx`, hidden on task screens; Play and Vibe are Soon tabs until fixes 3 and 6 land their screens.
2. **Finish the learning loop in the question player:** **Next question**, a quest-complete page (`/learn/[quest]/done`) with **Back to the map**, **See my Treasure** and **Home**, a confirm on ✕, and a Treasure icon for the card to fly to. The flow now ends at "Correct". (K-25 to K-28) — **Built** on `muse/learning-loop` (attempts route, frog quest, done page, flight; streamed hints and voice still open).
3. **Wire Home's dead ends:** "See the squadron" → `/squadron`, "Make something" and the Vibe tab → `/vibe`, Pip's card → `/critters`, add Play → `/arcade`, and point Learn at `/learn` instead of a fixed quest id. (K-11 to K-14, K-21)
4. **Make Studio reachable and finishable:** first visit after a new door goes to `/studio`; Me → "Change my Kix"; ✕ on the picker; Keep → Adopt Pip → **Go to my Home**; save the Kix to the profile. (K-19, K-43 to K-46)
5. **Give teens a working landing:** nav and avatar on the study deck; wire **Start session**, **25 min focus** and **Ask Kix**; show P6 or Sec 2 content, not Sec 3 Physics for both. (K-18, K-30)
6. **Send grown-ups to the right place and give parents a shell:** honour `next` (`/parent`, `/admin/skills`) and a safe `?next=`; build `/parent` with Today, Messages, Notebook and Family, Kids' doors and an account menu with sign out; Family's back goes to `/parent`. (P-01, P-04 to P-06, P-22) — **Built** on `muse/grown-ups` (Messages/Notebook tabs are honest empty states until their backends land; admins land on `/admin/people` until `/admin/skills` exists; since 29 Oct an admin with kids of their own lands on Today, like any parent, and only an admin with no kids lands on People).
7. **Fix the admin sidebar:** `/admin/skills` and `/admin/upload` 404 today; build them (or hide the links until built), make the AdminSkills and AdminUpload board sidebars real links, add **Back to my family** and **Sign out**, and replace the forbidden gate's "Go to sign in" with **Back to your family**. (A-01 to A-05)
8. **Shared-device safety:** Switch profile ends the kid session before `/doors` (Back must not reopen a sibling's world), and grown-up pages (`/family`, `/parent`, `/admin`) ask for the 4-digit parent PIN (founder decision) while a kid session is active — page shell and data routes both check the 15-minute unlock. Today any kid on the family tablet can open Your family and People. (K-06, P-08) — **Built** on `muse/grown-ups`.
9. **Guard every kid page and keep deep links:** Studio, Learn, Question, Treasure and Talk render for anyone today; redirect them like `/home` does, carrying `?next=` through sign-in and the kid's door. (K-08, P-04)
10. **Add `app/not-found.tsx` and `app/error.tsx`** with "Take me home" by role, so a bad quest id, an unbuilt admin page or a crash never strands anyone on the bare default page. (§7.6)

### 8.5 Decisions (founder, 28 Oct)

1. **Kid tab bar:** Home, Learn, Play (the Arcade), Treasure and Vibe as tabs; Me and Switch profile in the avatar menu.
2. **Parent sign-up:** invite or seeded accounts only for the MVP (P-09); no public sign-up page.
3. **Grown-up re-check on a kid device:** a 4-digit parent PIN, set once in Your family and hashed on the server (P-08).
4. **Demo quest content:** switch the built quest from P4 "Light and shadows" to the P3 frog life cycle the video and Terrarium world use.
5. **Focus help scope:** learning tasks only (questions and study sessions); Arcade rounds stay camera-free.
