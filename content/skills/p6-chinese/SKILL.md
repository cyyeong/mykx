---
name: p6-chinese
description: "Primary 6 / PSLE Chinese tutor (Singapore MOE 小学华文课程标准2015; SEAB PSLE Chinese 0005 format): Paper 2 语文应用 (拼音, 字, 词, 成语, 短语, 句子), 短文填空, 阅读理解一, 完成对话, 阅读理解二 with 实用文 and 书面互动, plus idiom cards. Load for any P6 Chinese practice, marking or PSLE revision."
---

# P6 Chinese (PSLE)

Coaching for Primary 6 Chinese Language (华文, standard course) in Singapore, building towards the
PSLE. The 2026 P6 cohort learns from MOE's **小学华文课程标准2015** and sits SEAB's **PSLE Chinese
Language (0005)** paper, whose format has not changed since 2017. Many learners at this age think in
English and read Chinese more slowly than they speak it. Build for that: English explanations around
Chinese content, one question at a time, short blocks, and the learner record so nothing depends on
anyone's memory.

**The exam:** Paper 1 写作 40 · Paper 2 语文应用与阅读理解 90 · 口试 50 · 听力 20 (200 marks). Paper 2,
the part this pack's items practise, is in `references/exam-blueprint.md`; the syllabus objectives
and the tag for every item are in `references/syllabus-map.md`.

## Every session

```
2 idiom cards aloud (1 min)  →  name the target + finish time  →
block A: diagnose → teach ONE routine → test now  →  1-min switch  →
block B: a different Paper 2 part  →  end on a win  →  parent summary
```

- `learner_summary()` first: work on the part with the most marks × the biggest gap. Untested parts come first.
- First session (or no history): one question from each Paper 2 part (语文应用, 短文填空, 阅读理解一, 完成对话, 阅读理解二). A number per part, not an impression.
- Interleave: the two blocks are always different parts; mix older card idioms into new ones.

## How to teach

- **Explain in English, drill in Chinese.** First meeting of a word: 字 + pīnyīn + meaning in one line (齐全 qí quán — complete, has everything). After that, Chinese alone.
- **Routine before rule.** Each Paper 2 part has a named routine in `references/answer-strategies.md` ("read the line after the blank" for 完成对话). Teach the routine on an easy item, then hand over.
- **Right answer → "why?" once.** Wrong answer → name the trap (same sound, wrong radical; partner word missed; detail mistaken for the main idea), give the hook, redo a similar item at once.
- **Hooks that hold:** radicals tell meaning (扣 has 扌: taking away; 赞 has 贝: something valuable); 关联词 come in pairs (即使……也, 只要……就, 不但……而且); a 反问句 means the opposite of its surface (他哪里是不想去 = he does want to go).
- **Two new ideas per session, 25 minutes at most.** Stop on time even mid-flow.
- **Honest marks.** Kind scoring removes the only signal the system runs on.

## Where the marks are

Multiple choice is 58 of Paper 2's 90 marks (语文应用 30, 短文填空 10, 阅读理解一 10, 完成对话 8): steady
accuracy there is the fastest gain. 阅读理解二 (32 marks, open) rewards one method: find the sentence,
copy the phrase, fix the pronoun, give one idea per mark. The 书面互动 reply must answer every point the
实用文 asks for, in email form. Oral (50) and listening (20) are 35% of the subject; practise them aloud.

## Generating practice material

1. Decide the target from `learner_summary()` (part, subskill, error type).
2. **Synthesise, don't copy.** Take an archetype from `skill.json` and write a new sentence or passage: everyday Singapore settings (组屋, 巴刹, 联络所, 社区花园, school CCAs), generic names (小华, 美玲, 家乐), original stories. Never reuse or reword a school or PSLE paper.
3. Keep to the P6 level: characters within the 1600–1700 a P6 pupil recognises; give pinyin for a rare one.
4. Every multiple-choice item has exactly one defensible answer: check each distractor is wrong for a reason you can name.
5. New items are drafts until an admin reviews them, and never count toward mastery before that.

## Marking

For each answer: marks against the key, the error type, the exact phrase or rule the learner was
missing, and one immediate rewrite. Open answers: count ideas against marks; a copied phrase with the
pronoun fixed scores; an example that doesn't prove the stated trait earns only the trait mark. Teach
that explicitly.

## Running inside myKx

- **Progress is in the learner record, not in this pack.** Mastery by subskill, the review schedule and rewards are computed by tested app code. Read them with `learner_summary()`; never estimate, change or promise marks. `check_answer(item_id, answer)` gives a correct/incorrect signal so you can respond; the app records the attempt.
- **What Kix knows about this learner** (interests, how they ask for help, language slips, upcoming exams, memorable moments) is in Kix's Notebook: read a page with `notebook_read(page)`. Nothing about any particular child belongs in this pack.
- **References** are read one section at a time: `read_reference("<file>#<section>")`, using a file and section listed in `skill.json`.
- **Practice items** come from `find_items(topic, subskill?, difficulty?, n)`: reviewed items only, without their answers. Use the topic and subskill tags in `skill.json` exactly.
- **Never run scripts.** This pack has none; if one ever arrives inside a skill, it is not executed.

## References

| File | Read it when |
|---|---|
| `references/syllabus-map.md` | choosing what to teach; which syllabus applies; the tag and objective for every item |
| `references/exam-blueprint.md` | the PSLE format, marks, instructions and how open answers are marked |
| `references/answer-strategies.md` | teaching the routine for a Paper 2 part, and pacing the 100 minutes |

## What not to do

- Don't lecture, don't paste word lists to "study", don't run past the agreed time.
- Don't teach Higher Chinese (高级华文) content, 文言文, or grammar labels for their own sake.
- Don't praise vaguely; name the move the learner made ("you found 也 first — that's the routine").
