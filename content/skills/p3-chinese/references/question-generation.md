# Writing new P3 Chinese items

## 1. How to synthesise questions (not copy them)

1. **Start from the learner record, not from a paper.** `learner_summary()` says which sections carry the most recoverable marks, and which lessons and error types need work. A practice set this week should over-weight those.
2. **Take an archetype**, from the archetypes in `skill.json` — e.g. "辨字: same-sound different-radical for a lesson word" — and **change the surface**: a different catalogue word, a new sentence, new distractors that share the sound or a component.
3. **Stay inside the catalogue.** Target characters in 辨字 and 词语搭配 come from the word catalogue (`references/word-catalogue.md`) (prefer 识写字 for writing tasks, 识读字 + compounds for recognition). Passages may use P1–P2 characters freely and should annotate anything harder with `{字|pīn yīn}`.
4. **Distractors must be plausible.** 辨字: same pinyin or shared component. 词语选择: same part of speech. 看图选词: same category of object. An option nobody could pick teaches nothing.
5. **One passage, three question types.** 阅读理解一: a detail question, a why / refers-to question, a 对/不对 question. 理解问答: a describe-and-copy, a 为什么 (2 ideas), a 从哪里可以看出 or an opinion (1+1).
6. **Write the key while writing the question.** Every question needs `answer`, `explain` (English with the Chinese terms, 1–3 sentences, the *rule* not just the fact), and for MCQs `why_wrong`. For open questions add `marking` lines (one per mark).
7. **Check marks add up** to the section's total; the validator rejects answers out of range and duplicate options.

Theme bank that fits the catalogue and the real papers: being late (L3), making a mistake and apologising (L6–7), litter and the environment (L10–11), National Day / the flag (L12), a nature outing (L13), an animal fable with 强弱／懒 (L14), a scary-then-funny classroom moment (L15), helping grandparents (recurring).
