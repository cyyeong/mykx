# Soak report: learning engine and question bank

**Run:** 27 Oct 2026. Offline and deterministic, with no model or network calls.
**Engine under test:** `lib/domain/` (marking, the PRD §6 mastery recompute, selection, the FR10 ledger, the critter companion and Sky Squadron). It has 64 Vitest tests (`npx vitest run lib/domain`).
**Raw output:** `scripts/soak/out/` (audit.md, audit.json, simulate.md, simulate.json). It's git-ignored by the `out/` rule.

| Run | Command | Size |
|---|---|---|
| A. Bank audit | `node scripts/soak/audit.ts` | all 779 items in 7 packs, 0.2 s |
| B. Learner simulation | `node scripts/soak/simulate.ts 20261104 12` | seed 20261104; 7 learners × 7 packs × 12 replicates, plus a test-in-10-days scenario and a tuning sweep: 828 runs, 67,045 questions served, 30 days each, 1–2 sessions a day, 3 questions a session, 10 s |

## The short version

1. **The engine holds up.** Across 67k simulated questions there were zero violations of the 7-day exclusion, cross-course, daily-cap, duplicate-key, refresh-award, NaN or crash checks. The §6 worked example reproduces exactly: .38, then .566, shown as "57/100; limited evidence: two families", and ten correct retries leave it at .566.
2. **The bank is the bottleneck, not the maths.** P6 Maths has **no** reviewed items, so it can't run a single session. P6 Science (3), Sec 2 (8) and P3 Science (20) run out of fresh questions in 0–5 days. The P3 demo topic, life cycles of animals, has **3 reviewed questions, all easy**. All 12 demo items are still `draft`, so the engine never serves them.
3. **Nine answer keys mark a right answer wrong**, seven of them on reviewed items. For example, a child who types "16 days" or "grow" is marked wrong. Each fix is a one-line content edit (list below).

## Findings, ranked

### 1. Correctness bugs (found by the soak, fixed in `lib/domain`, with tests)

| # | Bug | Effect | Fix |
|---|---|---|---|
| 1 | Answer normalising stripped a trailing "." or "!", so the answer "." became empty | punctuation items (p3eng-placement-quest-q29, q30) could never be marked right | a punctuation-only answer is now kept as typed |
| 2 | Selection ignored attempts timestamped after `now` | a device with a fast clock could get a family served again inside 7 days | a future timestamp now counts as "just practised" |
| 3 | §6 edge case, kept as written: when the 10-family window slides, the displayed m can rise after an assisted question, because the oldest family drops out | 3 times in 67k questions, at most **+0.012** | per-step "assisted cannot raise m" holds in every case. If even +0.012 is unwanted, cap the displayed m at its previous value when the newest family was assisted (one line in `recompute`) |

### 2. Content errors (item ids)

**Keys holding marking notes, so a right answer is marked wrong** (`marking-notes-in-key` in audit.md). Move the note into `accept` or `working`:

| Item | Status | Key now | Child answer marked wrong | Suggested key |
|---|---|---|---|---|
| p3sci-eoy-mock-80-e30b | reviewed | `**16 days** (larva 10 + pupa 6).` | "16 days", "16" | `16 days`, unit `days`; put "larva 10 + pupa 6" in `working` (today `working` only has the common error) |
| p3sci-eoy-mock-80-e25b | reviewed | `Living things **grow**.` | "grow" | `grow`, accept `["living things grow", "they grow"]` |
| p3sci-eoy-mock-80-e25d | reviewed | `Living things **reproduce**.` | "reproduce" | same pattern |
| p3eng-placement-quest-q29 | reviewed | `. (full stop)` | "." | `.`, accept `["full stop"]` |
| p3eng-placement-quest-q30 | reviewed | `! (exclamation mark)` | "!" | `!`, accept `["exclamation mark"]` |
| p3eng-mission-02-q13 | reviewed | `the (two) star stickers` | "the two star stickers", "the star stickers" | one of them, with the other in `accept` |
| p3eng-placement-quest-q43 | reviewed | `the (tiny) seeds` | "the tiny seeds", "the seeds" | same |
| p3sci-eoy-mock-80-e33c | draft | `**Steel** (accept nickel or cobalt).` | "steel" | `steel`, accept `["nickel", "cobalt"]` |
| p3sci-eoy-mock-80-e28c | draft | `**Air** or **warmth**.` | "air" | `air`, accept `["warmth"]` |

Also: p3eng-placement-quest-q32, a synthesis item, matches only the exact sentence, so add "hadn't" to `accept`.

**Demo items (the 12 on the demo path):**

- **Q1, p3sci-demo-01 (frog life-cycle order): confirmed, but as an inconsistency, not a factual error.** The item's key, "egg → tadpole → adult frog", matches the pack's own convention: `content-cycles.md` says "3 stages (some books add young frog/froglet)", bank item e20 says three, and diagnostic a9 draws three stages. But it clashes with three things:
  - the critter companion, which shows frogspawn → tadpole → froglet → frog;
  - textbooks that teach a young-frog stage;
  - p3sci-demo-03, which becomes **two-answer** for a child taught four stages, because option 4, "Both have four stages", is then also true.

  Suggested fix: make the demo items stage-count-neutral. In demo-01, make option 2 "egg → tadpole → froglet → adult frog", and drop "three stages" from its working and the "three-stage club" from hint 2. In demo-03, replace option 4 with "Both have adults that live only in water". demo-05 can stay as it is, because its table defines the stages.
- **Q4, p3sci-demo-04 ("a life cycle has no first or last stage"): cleared.** This is the convention Singapore P3 papers use, and the pack's reference teaches it (`content-cycles.md` §1 and its R3 ladder). The problem is **hint 2** ("Does a circle have a first point or a last point?"), which hands over the answer: option 1 is the only one that says no. Suggested hint 2: "What does an adult frog do that starts everything again?" (today's hint 1), with a new gentler hint 1.
- Hints that point at the key (mild): demo-03 hint 2 ("Where do their young live?") leads straight to option 3. demo-01 hint 2 rules out the only four-stage option. This doesn't distort scores, because assisted answers can't raise mastery and never earn the 5-point transfer award, but it makes the demo look easy.
- **p3sci-demo-02 duplicates reviewed bank item p3sci-eoy-mock-80-e20**: same stem, same keyed idea ("lives in water and has a tail"). A child who met e20 earlier gets a second "fresh" credit. Reword the demo item, or give both items one family.
- **All 12 demo items are `draft`.** The engine serves approved items only, so once the founder has checked them, either mark them `reviewed` or serve the demo quest as a fixed list.
- Verified correct: all four P6 ratio demos (keys and the arithmetic behind every distractor: 42, 60, 120; 4, 14, 20; 9, 45, 72; 36, 156, 108). The three Sec 2 demos, after checking the figures: S1 sits in the main loop, and the kettle is 2000 W, so $4.50. And demo-02 and demo-05's facts.

**Other bank notes:**

- Same question in another form, which should share a family: p3math-fix-it-01-f5-18 with p3math-mock-02-m2-b13 (12.xx a.m. to the 24-hour clock).
- A matching set that isn't independent evidence: p3chi-mock-01-paper2-q14 to q18 share one six-word bank.
- Lonely "(a)" labels with no (b): p3math-fix-it-01-f1-3a, p3math-fix-it-01-f1-4a, p3math-time-01-t1-c7a.
- p3math-mock-02-m2-b17: the key 3/8 also appears in the stem ("Ben ate 3/8"), so copying it scores. Change Ben's share to 1/8, which makes the key 5/8.
- s2sci-set-electrical-01-e6: the working never states "5 A".
- Only the 12 demo items have authored hints. Every other item's hint comes from the live model, so it needs a fixture fallback (hard rule 7 covers only the demo path).

### 3. Bank coverage: can selection run? (reviewed mcq/short only)

| Pack | Reviewed questions | Topics with ≥3 | Subskills with any item | Subskills that can reach "developing" (≥5 families) | Fresh questions run out (median day) | Sessions short of 3 |
|---|---|---|---|---|---|---|
| p3-maths | 76 | 10/10 | 40/67 | 2 | 17 | 0% |
| p3-english | 66 | 4/6 | 27/39 | 2 | 14 | 0% |
| p3-science | 20 | 4/7 | 16/38 | 0 | 5 | 54% |
| p3-chinese | 19 (+420 cards) | 4/11 | 6/17 | 2 | 4 | 57% |
| s2-science | 8 | 1/8 | 8/79 | 0 | 2 | 86% |
| p6-science | 3 | 0/15 | 3/63 | 0 | 0 | 97% |
| p6-maths | **0** | 0/15 | 0/62 | 0 | 0 | 100% |

- Cards (P3 Chinese) are self-checks, so they never move mastery.
- Promoting drafts helps most in P3 Science (35 objective drafts, including 9 in life cycles of animals) and P6 Science (13).
- 17 of the 100 covered subskills have no easy item, so a struggling learner can't be offered one.

### 4. Tuning suggestions (with numbers)

1. **Show parents a topic-level index beside the subskill detail.** Per-subskill evidence is thin: by day 30 a learner touches 33–40 subskills, with only 1–3 families each. The first subskill leaves "limited" on day **9–13** (day 5 for the guesser), and only **2** subskills reach "developing" in 30 days. The same recompute run per topic reaches "developing" by day **1–2.5**. Per subskill, m stays close to the prior: for the strong learner it reads **0.26 below** the true success rate, and the improving learner's error grows to **0.43** by day 30, because its subskills were last seen early.
2. **Keep the PRD weights; add questions instead.** Selection does target the weak subskill: in week 1 it takes **18%** of picks against an **8%** share of the bank (maths) and **12% against 6%** (English), using every weak-subskill question in the first week. None of six variants moved the 30-day share by more than 2 points: subskill cap 3, unseen D 0.25, H mismatch 0.6, no probe reserve, and two combinations. The limit is depth: the weak subskills have 6 and 4 questions. Aim for **≥10 reviewed questions per subskill** where children struggle before tuning weights.
3. **Learning rate.** α = .5 cuts the strong learner's error from .26 to .16 but raises the weak learner's from .15 to .20. Keep .3, or use .4 as a compromise (strong .20, weak .17, uneven .19).
4. **Critter companion pacing.** Stage 2 (froglet) arrives on day **0–1** for almost every learner, because the trigger is the first independent fresh success. The final stage (frog: a subskill above .7 with developing evidence) comes around day 12–15 for **two thirds** of strong learners but only **44%** of weak learners and **11%** of guessers, and never for the sparse cold-start learner. Suggestions:
   - Stage 2 at 3 fresh successes on 2 different days.
   - Final stage at "any subskill moves up one band from its first evidence", which is fair to weak learners and still honest.
5. **True/false items** (all 7 in comp_true_false) have a 50% guess floor: a learner with true ability 0.2 scores about 0.63. Count them as half evidence, or keep them out of the 5-point transfer award.
6. **Luck in the transfer award.** The guesser earns about **11 points a month** from lucky "fresh-family success after an error". Requiring the child's explanation for that award would remove most of it.
7. **The 15-a-day cap rarely binds** at 1–2 sessions a day: on 0–1.3 days a month. Weak learners earn as much as strong ones (104 vs 96 points a month), which is the effort-based design working. Keep it.
8. **The test factor works.** With a test 10 days out, the in-scope share of picks rises from 42% to **65%** (maths), 41% to 55% (science) and 80% to 87% (English, already mostly in scope).
9. **Sky Squadron:** four fresh successes per jet completes the set by day 30 for strong learners on P3 packs (4.0 jets) and gives weak learners 2.9. That's fine for the demo. Use six per jet if it should last a term.

## Where §6 and FR10 were ambiguous, and what the code does

- **Question family.** The item schema has no `family` field, so the family is derived: the item id without a trailing subpart letter (c22a and c22b become c22). Subparts of the earliest question add up to one contribution, with hints taken as the most opened on any part. Recommendation: add an optional `family` to `SkillItem` (lib/types.ts and the schema) to group variants such as f5-18/b13 and demo-02/e20.
- **Confirmed.** Objective items are confirmed when marked. Open items count only after a parent or admin confirms the score. Self-checks and cards never count.
- **Revealed, then a variant.** Following the pseudocode literally (filter first, then take the earliest per family), a variant can count after its family's first attempt was revealed. Flagged in case the founder wants the opposite.
- **Counts.** `families` and `dates` are counted over the 10-family window that m uses; `totalFamilies` gives the lifetime count. "Limited" means fewer than 5 families or fewer than 2 Singapore dates. Staleness runs from the last eligible attempt, beyond 14 days.
- **Selection details:**
  - A course is one skill pack.
  - W, D and H are per subskill (a per-family D would always be 1 after the 7-day exclusion).
  - A whole question with all its parts is the unit served.
  - Fresh families come before delayed review, which carries the label "no new mastery evidence"; "exhausted" means no fresh family is left.
  - "Diverse" means distinct families and at most 2 per subskill.
  - The probe slot goes to the best unassessed subskill.
  - Ties break on a hash of a seed, never on randomness.
  - A counts in Singapore calendar days.
  - Difficulty bands: 1–2 easy, 3 medium, 4–5 harder.
- **FR10 rules:**
  - "With explanation" means the child's own reason, so the question player must ask for one or the first-attempt points never fire.
  - The retry award pays once per item and never after a reveal.
  - The transfer award pays once per error in that subskill.
  - Creation points pay once per creation, whatever the number of versions.
  - All four point rules count toward the cap, which tops up to exactly 15. Over the cap, the ledger records a 0-point entry so the key is spent and can't pay out later.
  - The day is the event's Singapore date.
- **Companion and squadron grants** are written to the ledger once and never taken back. A "fresh-question success" is a family's earliest eligible attempt at full marks with no hints.

## Fixed after the run (27 Oct, evening)

- **Answer keys:** all nine items in the table above now have a plain `answer` plus `accept` alternatives (e.g. `16 days` / `16`; `.` / `full stop`; `steel` / nickel, cobalt). The audit shows 0 answer-key problems in reviewed items. A re-import from the private source skills would bring the old keys back, so fix them at the source, or teach the importer to split marking notes, before re-importing.
- **Demo items:**
  - demo-01's correct order is now egg → tadpole → froglet → adult frog (the working notes that some books count three stages).
  - demo-03's fourth option is now "Both have adults that live only in water".
  - demo-02 is reworded around Pip ("Which of these can Pip do now?") so it no longer copies e20.
  - demo-04's hints no longer give the answer away; demo-03's hints are gentler.
  - All twelve are still `draft` until the founder approves them.
- **Assisted success across the sliding window:** `recompute` now replays the history, so an assisted family never shows a higher score than the one before it. There's a test.
