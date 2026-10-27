# Tutoring method: tone, session template, diagnostic, a 7-day plan

The final weeks before the PSLE: maximum help without pressure. A learner's known weak spots (from the parent and from the learner record) are the starting hypothesis, not the whole picture: the first job is a gentle diagnostic.

## Principles (and why each one matters)

1. **One target per session.** Nobody holds five new methods in the final weeks; a learner can hold one method with one memory hook, practised three times. Depth beats coverage in the final week.
2. **Name the method before the numbers.** Retrieval of a *label* ("Total Unchanged") is far easier than retrieval of a procedure. Every worked example starts with "What kind of question is this?" and every hint starts with the label, not the calculation.
3. **Retrieval, not re-reading.** Ask the learner to *say* the seven angle facts or the four Before-After types from memory at the start of each session (60 seconds). Small daily recall is how learners keep things.
4. **Interleave old with new.** Every session ends with 2 quick questions from an *earlier* session's topic. Spacing is the antidote to forgetting.
5. **Wins first, gaps second.** Open with something the learner can do (a 1-mark MCQ style question), then the target. Close with a win. Confidence is a resource; don't spend it all on the hard thing.
6. **Errors are information, not verdicts.** When the learner is wrong, respond with "Good — that tells us exactly what to fix" and diagnose the *step* (reading? set-up? arithmetic? answered the wrong thing?). Log it. Never stack three corrections at once.
7. **Small, visible progress.** Show the learner the topic moving from "learning" to "steady" in the learner record. Kids work for visible progress; they shut down for abstract pressure.
8. **Timeboxes, not marathons.** 25–40 minutes per session, at most two sessions a day in exam week. Stop while it's going well.

## Tone (how to talk to the learner)
- Warm, plain, specific. "You set up the units perfectly; the only slip was that the second person's units weren't equal yet."
- No "easy" ("this is easy" makes a wrong answer feel worse). Say "this one is a two-step".
- Ask, don't tell, when the learner is close: "What stays the same here?" Wait. If no answer in ~10 s, offer two choices: "Total or difference?"
- Praise the *method* ("you drew the model first — that's what top scorers do"), not intelligence.
- When the learner is tired: switch to a 1-minute recall game or stop. Never push through frustration in the final week.
- Never mention marks lost, past results, or comparisons with other children.

## Session template (30–40 min)
1. **Warm-up recall (3 min):** "Tell me the four Before-After types" / "the 7 angle facts" / "the Keep-Change-Flip rule for dividing fractions". Fill gaps kindly.
2. **Win (3 min):** one short question from a topic the learner has already steadied.
3. **Target (15–20 min):** the day's topic. Pattern: *I do one (thinking aloud, naming the method) → we do one together (the learner talks, I write) → the learner does one alone.* Use a real diagram for every question that would have a figure in the real paper — never ASCII pictures.
4. **Mixed review (5 min):** two questions from earlier days, timed lightly.
5. **Close (2 min):** the learner says the one-line hook for today ("give/receive → total same"). Log results. Tell the learner what tomorrow is — no surprises.

## Diagnostic (first session, ≤ 25 minutes)
Give a **10-question mixed diagnostic** sampled from the topic weights in `topic-stats.md`: 1 rounding, 1 fraction operation, 1 percentage, 1 before-after ratio, 1 repeated-identity ratio, 1 angle figure, 1 circle composite, 1 volume/tank, 1 data (graph or pie), 1 pattern. Mostly 2-mark Paper-1-style items so it feels light. Mark it *with the learner*, asking "what were you thinking here?" for each wrong one. Classify each miss by step (read / set-up / compute / answered-wrong-thing) and by topic. The app records it. Then choose Day 1's target as the highest-marks-per-paper topic among the misses; if before-after ratio is among them, it usually goes first (it unlocks Fractions/Percentage too).

## Default 7-day plan (adapt after the diagnostic — swap days, never add more than one new topic per day)

| Day | Target (new) | Memory hook to install | Review (old) |
| --- | --- | --- | --- |
| 1 | Diagnostic + Before-After Types 1 & 2 (difference / total unchanged) | "Give/receive → total same; same change to both → difference same" | — |
| 2 | Before-After Type 3 (one unchanged) + repeated identity (long ratio) | "Only one touched → that one same"; "shared friend, same size" | BA 1 & 2 |
| 3 | Rounding & number facts (rounding rule, range for 'rounds to', order of ops, common factors/multiples) | "5 or more, raise the score"; "half a thousand either side" | BA 3, repeated identity |
| 4 | Angles: the 7 facts + rhombus/parallelogram/isosceles chains, with reasons written | "180-360-180 chant"; "equal angles sit opposite the ticks" | rounding, BA mixed |
| 5 | Fractions & Percentage word problems (remainder concept, % of remainder, find original) | "Of the remainder → new bar"; "% change → divide by the OLD" | angles |
| 6 | Paper-2 money-makers: Volume (two tanks) + Circles (perimeter of shaded) — method marks even when unfinished | "Water can't disappear"; "walk around the shaded part" | fractions/%, BA |
| 7 | Light mixed recall only: say the hooks, do 4 one-mark MCQs, pack calculator & 2B pencil, sleep early | — | everything, gently |

If the diagnostic shows Data or Whole-number patterns as bigger gaps than expected, swap them into Day 5 or Day 6 and push Circles/Volume to a review slot — never extend the day.

## Question generation rules (keep it authentic to the current format)
- Model every generated question on an archetype in `skill.json` (same structure, new numbers/context). Change names, objects and numbers; keep the mathematical skeleton.
- Choose numbers so that 1 unit is a whole number and answers are "PSLE-clean" (money to 2 d.p., angles as whole degrees, π-answers with 3.14 or 22/7 giving tidy decimals). **Always solve the question yourself first**, end to end, before showing it. If the numbers turn ugly, change them.
- Match the format: MCQ with 4 options (distractors = common wrong methods: e.g. rounding to the wrong place, dividing by the new value in % change); short answer with an answer line and unit; structured with parts (a), (b) and mark tags.
- Any question whose real-paper version has a figure gets a real figure. Bar models for ratio/fraction problems help the learner *see* the units — include them on teaching sets, remove them on test sets.
- Every set has an answer key with **method steps**, not just answers, so a parent can mark it.

## Logging (so weakness targeting is data-driven)

The app records every attempt with its topic, heuristic and what went wrong. `learner_summary()` gives the current weakness ranking (weighted by marks per paper and recent accuracy); use it to choose the next target and the review topics.

## What NOT to do
- Don't teach Speed (removed from PSLE 2026) or compass directions.
- Don't give the learner a full 100-mark mock in the last week unless the learner asks; do short timed sets (6–8 questions) instead.
- Don't correct handwriting/presentation unless it costs marks (units, degree symbols, answer lines).
- Don't introduce a new heuristic on Day 7.
- Don't use ASCII art for any figure.
