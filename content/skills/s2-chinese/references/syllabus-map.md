# Sec 2 G3 Chinese syllabus map

What this pack teaches, where each part comes from, and the tag every item carries. Use the tags
exactly (topic `paper2.zonghe` + subskill `connector` is written `zonghe.connector` below).

## Which syllabus and format apply

| Document | Year | Applies to | Where |
|---|---|---|---|
| *G1, G2, G3 and Higher Mother Tongue Languages Syllabus (Secondary)*, MOE CPDD, © 2020 | 2021 | Implementation starting with the 2021 Secondary One cohort: every Sec 2 class in 2026. G3 Chinese is the former Express course. | https://www.moe.gov.sg/media/files/secondary/fsbb/syllabus/mtl/72529fb3-d7dc-4762-b5da-aee8260e6b97.pdf |
| SEAB, *Singapore–Cambridge Secondary Education Certificate General 3 (2027): Chinese Language 华文 (Syllabus K320)*, © MOE 2024 | 2027 | The national G3 paper, first sat in 2027 by the 2024 Sec 1 cohort (Full Subject-Based Banding). The latest published G3 Chinese format; a Sec 2 pupil in 2026 will sit this examination or its successor. | https://www.seab.gov.sg/secondary-education-certificate-sec/g3-syllabuses-for-school-candidates-2027/ |

The MOE syllabus is written for all three Mother Tongue Languages and has no Chinese-only word or
grammar lists; MOE's Chinese-language secondary document on its website is the Chinese (Special
Programme) syllabus for third-language learners, which does not apply to G3. So this pack takes its
**content areas** from the MOE syllabus and its **exam components, instructions and marks** from K320.
Lower secondary papers are school-based (see `exam-blueprint.md`).

K320's 考试目标 (what the examination tests): 聆听 · 会话 · 词语的认识和语言的应用 · 阅读理解 · 写作电子邮件和不同文体的文章.

## Topic and subskill tags

| Tag | Exam component (K320) | Covers | Marks in the national paper |
|---|---|---|---|
| zonghe.word_choice | 试卷二 一 语文应用 A 综合填空 | words in context: word class, collocation, near-synonyms | part of 5 |
| zonghe.connector | 综合填空 | 关联词 in context (不但……而且, 只要……就, 但是) | part of 5 |
| zonghe.idiom | 综合填空 | 成语 in context | part of 5 |
| tihuan.replace_word | 一 语文应用 B 词语替换 | replace a misused word in a passage | 10 (5 × 2) |
| yuedu1.flyer_ad | 二 阅读理解一 | multiple choice on a 传单 or 广告 | part of 20 |
| yuedu1.news_report | 二 阅读理解一 | multiple choice on a 新闻报道 | part of 20 |
| yuedu2.word_meaning | 三 阅读理解二 | find-a-word; what a phrase or line means | part of 35 |
| yuedu2.explain_reason | 三 阅读理解二 | reasons; a character's purpose | part of 35 |
| yuedu2.character_feeling | 三 阅读理解二 | feelings and how they change, with evidence | part of 35 |
| yuedu2.summary | 三 阅读理解二 | list or sum up the points of a passage | part of 35 |
| yuedu2.opinion | 三 阅读理解二 | the author's view, and the learner's own with reasons | part of 35 |
| vocab.recognise | (vocabulary for 语文应用 and 阅读) | word cards: pick the meaning | — |
| writing.email.* | 试卷一 第一部分 实用文 | reply to or write an email, 150+ 字 | 20 |
| writing.essay.* | 试卷一 第二部分 作文 | 记叙文, 说明文 or 议论文, 300+ 字 | 40 |
| oral.* | 试卷三 口试 | 朗读短文 10 · 会话 40 (from a video) | 50 |
| listening.listening | 试卷三 听力理解 | 10 multiple-choice questions | 20 |

Writing, oral and listening carry weight in `skill.json` (so the parent sees the whole exam) but have no
items yet: they need writing, speech and audio, which the player does not mark.

## Syllabus areas (MOE 2021) and what they mean for Chinese

- **Course emphasis for G3 MTL:** Reading 35% · Listening, Speaking and Spoken Interaction 35% · Writing and Written Interaction 30%. Lower secondary G3 curriculum time: 3 h 30 min – 4 h a week.
- **Language Knowledge** has two areas. *Linguistics*: phonology, orthography, lexicon (vocabulary), grammar and textual knowledge. *Pragmatics*: cultural references, registers, varieties and functional purposes. In Chinese, lexicon covers 词语, 成语 and word choice; grammar covers 关联词 and sentence patterns; textual knowledge covers how 记叙文 and 说明文 are built (signposts such as 首先／其次／此外); register covers writing politely in an email.
- **Receptive skills (reading), learning outcomes:** "Understand the underlying messages of reading materials related to daily life" (flyers, notices, news: 阅读理解一) and "Comprehend and appreciate texts of various genres, such as newspapers, narrative texts and informative texts" (阅读理解二).
- **Productive skills:** "Enrich their language expression with a wide array of vocabulary and sentence structures" (综合填空, 词语替换, the word cards); "Substantiate their views with appropriate examples and evidence" (opinion and feeling answers).
- **Interactive skills:** "Exchange views with others using appropriate language and expressions" (email replies, 会话).
- **Key features of the 2021 syllabus** that shape the passages: more literary texts in lower secondary, contemporary issues and current affairs, and authentic materials such as flyers and news. The pack's passages follow suit: a story about screen time, a 中秋 corridor gathering, a community repair corner, a news report on a student invention, a CCA story and an explainer on skyrise greenery (空中绿化).

## Item alignment

Every item's `notes` field repeats its syllabus area and exam component.

| Exam component (K320) | Syllabus area (MOE 2021) · K320 考试目标 | Pack topic.subskill | Items |
|---|---|---|---|
| 一 语文应用 A 综合填空 (成语) | Language Knowledge: Lexicon · 词语的认识和语言的应用 | zonghe.idiom | s2chi-p2-01-q1, q2 |
| 一 语文应用 A 综合填空 (关联词) | Language Knowledge: Grammar · 词语的认识和语言的应用 | zonghe.connector | s2chi-p2-01-q3, q4, q10 |
| 一 语文应用 A 综合填空 (词语) | Language Knowledge: Lexicon · 词语的认识和语言的应用 | zonghe.word_choice | s2chi-p2-01-q5 – q9 |
| 一 语文应用 B 词语替换 | Language Knowledge: Lexicon · 词语的认识和语言的应用 | tihuan.replace_word | s2chi-p2-01-q11 – q15 |
| 二 阅读理解一 (传单) | Reading: underlying messages of reading materials related to daily life · 阅读理解 | yuedu1.flyer_ad | s2chi-p2-01-q16, q17, q18 |
| 二 阅读理解一 (新闻报道) | Reading: underlying messages of reading materials related to daily life · 阅读理解 | yuedu1.news_report | s2chi-p2-01-q19, q20, q21 |
| 三 阅读理解二 (记叙文) | Reading: texts of various genres (narrative) · 阅读理解 | yuedu2.word_meaning, explain_reason, character_feeling | s2chi-p2-01-q22 – q26 |
| 三 阅读理解二 (说明文) | Reading: texts of various genres (informative); Productive: substantiate views · 阅读理解 | yuedu2.word_meaning, summary, opinion | s2chi-p2-01-q27, q28, q29 |
| Vocabulary for 语文应用 and 阅读 | Language Knowledge: Lexicon · 词语的认识和语言的应用 | vocab.recognise | s2chi-word-cards-01 – 08 |

## Out of scope

- G1 and G2 Chinese, Higher Chinese (K355) and Chinese (Special Programme): different courses and papers.
- 文言文 and classical poetry as test texts. This version's 阅读理解二 passages are narrative and informative; argumentative passages (议论文, one of K320's writing genres) are a later addition.
- Grammar terminology for its own sake (labelling 主语／谓语): the syllabus teaches language use.
- Any question copied or lightly reworded from a school or national paper. Write new ones from the archetypes in `skill.json`.
