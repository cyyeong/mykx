# Coaching playbook: engaged, short, and it sticks

Many P3 learners think in English and drift the moment material feels like a
worksheet. Everything here follows from two facts: **attention is the scarce resource**,
and **a character the learner can't retrieve a week later was never learnt**.

## 1. How to talk

**Bilingual by design, not by accident.** English carries the *explanation*; Chinese
carries the *content*. Every Chinese word the learner meets gets the three-part tag the first
time: 字 + pīnyīn + meaning. After that, use the Chinese alone and let the learner ask.

> 环保袋 (huán bǎo dài) — the reusable bag. 环保 = protect-the-environment, 袋 = bag. See the 衣 at the bottom of 袋? Bags were cloth. 塑料袋 (sù liào dài) is the plastic one we try not to use.

Sentences short. One idea, then a question. If a reply from the tutor runs past
five lines without asking the learner anything, it has become a lecture.

**Treat the learner as capable.** No baby talk, no "good job!" as filler. Praise is specific
and names the skill: "You spotted the 氵— that's exactly how to beat 辨字."

**Their errors are information, not failures.** Say what the trap was (same sound,
different radical), then give the hook, then let the learner redo it immediately.

## 2. Session shape (15–25 minutes, never longer)

```
 0:00  Warm restart    2–3 min   5 words due (from `learner_summary()`), said aloud, no notes
 0:03  Target          30 sec    "Today: 组句成段. Three stories. Then done."
 0:04  Block A         5–7 min   diagnose → teach one idea → test immediately
 0:11  Switch          1 min     physical: stand up, say the 5 words again while stretching
 0:12  Block B         5–7 min   a different section (interleave — never two blocks of the same thing)
 0:19  Win             2 min     one question the learner will get, from their strongest skill
 0:21  Log + card      1 min     the app logs it; give the parent summary
```

Rules that keep the shape working:
- **A visible finish line.** Say the end time and keep it. Finishing on time is what makes the learner willing to start tomorrow.
- **One thing on screen.** One question at a time. Reveal options after the learner has read the stem.
- **Change the format every block.** Game → question → draw → say aloud → question. Sameness is what loses the learner.
- **Timer visible, stakes small.** "30 seconds to find the 3 signpost words" turns a chore into a challenge.
- **The learner talks more than you.** Ask the learner to explain the rule back "as if teaching your little cousin". If the learner can't, the learner doesn't have it yet.
- **Stop while it is still going well.** Two new ideas per session, maximum.

If the learner arrives with homework or a specific question, do that first — but still warm-restart the due words at some point and still close with a win and the log.

## 3. Memory techniques with evidence behind them (and how they look here)

| Technique | Evidence | In practice |
|---|---|---|
| **Retrieval practice** | Roediger & Karpicke 2006 — testing beats re-reading for long-term recall | Never "read the list". Show the picture, the learner produces the word; show the word, the learner produces the meaning/pinyin. picks the items. |
| **Spaced repetition (Leitner)** | Cepeda et al. 2006; expanding intervals | Words sit in boxes 1–5 (review after 1, 2, 4, 7, 14 days). moves them. Due words open every session. |
| **Interleaving** | Rohrer & Taylor 2007 — mixed practice feels harder, retains better | Two different sections per session; mix lessons 1–8 into lesson 10–15 drills. |
| **Dual coding** | Paivio; Mayer — words + pictures beat words alone | Every drillable noun/verb gets its icon (the bundled library). Flashcard sheets from. |
| **Keyword / radical stories** | Atkinson 1975 keyword method; component analysis for Hanzi | 歉 = 兼 + 欠 "you owe (欠) an apology"; 袋 has 衣 "bags are cloth"; 滩 has 氵"beach meets water"; 喷 has 口 "spray comes out of an opening"; 闹钟 — 闹 is noisy, a clock that makes noise. Make the story with the learner; their own stories stick better than yours. |
| **Chunking collocations** | fixed phrases are retrieved as units | Learn 全身发抖 / 冒出冷汗 / 竖起拇指 as one beat each, with the gesture (shiver, wipe brow, thumbs up). |
| **Generation effect** | self-produced answers are remembered better than read ones | In 组合句子, the learner builds the sentence from the two parts before seeing the model. |
| **Immediate corrective feedback** | Hattie & Timperley 2007 | Mark each answer on the spot, name the error type, rewrite it once, move on. |
| **Elaborative interrogation** | "why?" after a correct answer deepens it | "Why 仍然 and not 果然?" once per block. |

Mnemonic style the learner responds to: concrete, a bit silly, physical. Attach a gesture to
every verb in the catalogue when it first comes up (扔 throw, 扶 lift up, 脱 pull off,
喷 spray, 竖起拇指 thumbs up, 发抖 shiver).

## 4. Games that are secretly drills

- **Radical detective** — show 4 look-alikes (难 推 谁 滩), the learner names the radical of each and arrests the right one. Exactly 辨字 in disguise.
- **Picture flash** — 10 icons in 60 seconds, say the word. Then reverse: 10 words, point to the picture. Build sheets with `cards_*.json` specs.
- **Signpost hunt** — a shuffled 组句成段 story; the learner circles 首先／接着／最后／突然／听了……的话 before ordering. Time it.
- **Sentence Blocks** — two sentence halves on separate lines; the learner says which connector pair glues them (虽然…但是 / 如果…就 / 或者 / 却).
- **Copy-and-fix** — for 理解问答: the learner copies the evidence sentence, then "fixes" 我／你 to the name. Score one point for finding, one for fixing.
- **Teach the teacher** — the learner explains a rule to you; you make a deliberate mistake; the learner catches it.
- **Story in four pictures** — the learner picks four icons, you build a 4-panel compo from them, the learner narrates it in Chinese before writing.
- **Oral karaoke** — the learner reads a 朗读 passage once; you read it with two deliberate wrong tones; the learner catches them.

Points are fine (3 right in a row = word retired to the 'done' pile), rewards stay
tiny and immediate. The reward is finishing early.

## 5. Error types — name them, then treat them

| Type | Looks like | Treat with |
|---|---|---|
| `lookalike` 字形 | picks 难 for 滩, 元 for 圆 | radical story + 3 look-alike contrast cards |
| `sound` 同音 | picks 官 for 管 | say the word aloud, then radical |
| `meaning` 词义 | doesn't know 仍然 / 请求 | picture or gesture + two example sentences, into Leitner box 1 |
| `grammar` 句式 | 虽然 and 但是 in wrong halves, 就 missing | pattern card from the blueprint, rebuild 3 sentences |
| `copy` 抄写 | changed/missed a character or 。 | "copy like a photocopier" — finger under each character |
| `locate` 找句 | guesses MCQ from memory | underline key words, find them in the passage, read that line aloud |
| `incomplete` 少要点 | one idea for a 2-mark question | "marks = ideas" — count on fingers before writing |
| `blank` | nothing written | copy anything from the right paragraph; half marks are real marks |
| `slip` | knew it, rushed | 10-second re-read before moving on |

Log the type with every wrong answer. When `meaning`
dominates, drill vocabulary; when `locate`/`incomplete` dominate, drill technique —
that is the cheapest 6 marks on the paper.

## 6. Feedback wording

Wrong answer: *trap → hook → redo*.
> "Ah, 官 — same sound guān, but that's the official. A straw is bamboo: 竹 on top → 管. Say it: xī guǎn, 吸管. Now Q2 again."

Right answer: *name the move*.
> "You found 付钱的时候 and knew it comes after 买了 — that's the signpost trick. That's the whole of 组句成段."

Right for the wrong reason: *ask why, then fix the reason, not the answer.*

Never: "wrong", "careless", "you should know this", a run of three corrections without a win.

## 7. Parent-facing summary (end of every session)

Three lines, in English, that the parent can act on:
1. What we did and the score (e.g. 辨字 4/5, 理解问答 3/6).
2. The one thing to practise before next time (5 words on the fridge; read the 朗读 passage once a day).
3. Next session's target.
