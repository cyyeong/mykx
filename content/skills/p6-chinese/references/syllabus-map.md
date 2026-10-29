# P6 Chinese syllabus map

What this pack teaches, where each part comes from, and the tag every item carries. Use the tags
exactly (topic `paper2.yuwen` + subskill `pinyin` is written `yuwen.pinyin` below); an invented
tag makes the learner record meaningless.

## Which syllabus and format apply

| Document | Year | Applies to | Where |
|---|---|---|---|
| 小学华文课程标准2015 (*2015 Syllabus Chinese Language Primary*, MOE CPDD) | 2015 | P1 2015 → P6 2020, and every later cohort until the 2024 syllabus reaches it. **The P6 cohort of 2026 (P1 in 2021) is on this syllabus.** | https://www.moe.gov.sg/media/files/primary/cfafc1ab-b80f-4c19-8735-cd1755d4b3e8.pdf |
| 小学华文课程标准 (*Chinese Language Syllabus Primary*, MOE CPDD, © 2024) | 2024 | Starts with the 2024 P1 cohort: 小三 in 2026, 小六 in 2029. Not yet at P6. | https://www.moe.gov.sg/media/files/primary/f41062a6-3a90-4ed1-bf93-2f1aaabeec43.pdf |
| SEAB PSLE Chinese Language (0005), "For Examination from 2017" | 2017 format, listed for 2026 | The PSLE paper itself. SEAB lists this document under *PSLE Formats Examined in 2026*, so the 2017 format is still the current one. | https://www.seab.gov.sg/psle/psle-formats-examined-in-2026/ |

SEAB states that the paper follows the 小学华文课程标准 and its 试卷蓝图, and lists the abilities it
tests (考试目标 1.4): 对汉字形、音、义的辨认 · 词语的认识和运用（包括成语和习用语） · 句子结构的认识和运用 ·
阅读理解 · 写作／书面互动 · 篇章朗读 · 口语互动 · 听力理解. Both syllabuses say the PSLE 华文 paper is set at the
level of the 核心单元 (core units).

When the 2024 syllabus reaches P6 (2029), recheck this map: its upper-primary 写作 types narrow to
故事、日记、见闻、感受, and it adds objectives such as 能根据对方的反应调整说话内容或用语 and 能在生活和学习中运用文本中获取的知识和信息.

## Topic and subskill tags

| Tag | Exam component (SEAB 0005) | Covers | Marks in the real paper |
|---|---|---|---|
| yuwen.pinyin | 试卷二 一 语文应用 | 汉语拼音 of an underlined word; tones, initials, finals, 多音字 | part of 30 |
| yuwen.char_choice | 语文应用 | 字: the right character in a sentence (same sound or shape, radical decides) | part of 30 |
| yuwen.word_choice | 语文应用 | 词: near-synonyms, fit-the-noun words, 关联词 pairs | part of 30 |
| yuwen.idiom | 语文应用 | 成语 from a context clue | part of 30 |
| yuwen.phrase | 语文应用 | 短语: verb–noun collocation | part of 30 |
| yuwen.sentence | 语文应用 | 句子: 病句, sentence meaning, 反问句 | part of 30 |
| tiankong.cloze | 一 短文填空 | five blanks in one short passage | 10 |
| yuedu1.rc_mcq | 二 阅读理解一 | multiple choice on one passage | 10 |
| duihua.dialogue | 三 完成对话 | four blanks in one conversation | 8 |
| yuedu2.practical_text | 四 阅读理解二 | open questions on a 实用文 (电邮, 通知) | part of 32 |
| yuedu2.written_interaction | 四 阅读理解二 (包括书面互动) | a short written reply to the 实用文 | part of 32 |
| yuedu2.word_meaning | 四 阅读理解二 | find a word in a named paragraph from its meaning | part of 32 |
| yuedu2.explain_reason | 四 阅读理解二 | why: causes, often 隐含信息 | part of 32 |
| yuedu2.character_feeling | 四 阅读理解二 | a character's trait or feeling, with evidence | part of 32 |
| idioms.recognise | (vocabulary for 语文应用 and 阅读) | idiom cards: pick the meaning | — |
| composition.* | 试卷一 写作 | 命题作文 or 看图作文, ≥ 100 字 | 40 |
| oral.* | 试卷三 口试 | 朗读篇章 20 · 会话 30 (from a video) | 50 |
| listening.listening | 试卷三 听力理解 | 10 multiple-choice questions | 20 |

Composition, oral and listening carry weight in `skill.json` (so the parent sees the whole exam)
but have no items yet: they need writing, speech and audio, which the player does not mark.

## Upper-primary objectives (2015 syllabus, 小五至小六)

From 第五章 分项目标 › 一、语言能力 (pp. 17–24). Only objectives shaded for 小五 and 小六 are listed; the stage
focus (第四章, p. 14) is 综合发展各语言技能，着重口语互动、阅读、写作和书面互动的训练.

- **阅读** (material: 故事、寓言、通知、海报、广告、图表、传单、菜单、报章、说明书…)
  - 能辨识字形、字音、字义: **1600至1700字** by the end of 小六 (字词 from the 新加坡小学生字词表)
  - 借助标点符号理解阅读材料
  - 能推断词、句的意思 · 能理解隐含信息
  - 能推断、预测事情的发展和结果 · 能进行比较（看法，内容，人物变化）
  - 能概括内容（人物性格特点、段落大意、文章主旨、作出总结） · 能就内容（如人物言行）发表看法
- **写作**: 能书写常用字 **1000至1100字** · 能正确使用标点符号 · 能写完整的句子 · 安排段落、组织成篇 · 能清楚、完整地叙述 · 能进行简单的描写 · 检查并修改文字
- **书面互动** (material: 便条、书信、短信、电邮、网络贴文): 掌握交流媒介的格式与用语（如贺卡、便条、书信、电邮） · 能提出问题，并对他人的提问作出适当的书面回应 · 能根据情境和对象选择书面互动的内容和用语
- **口语互动**: 能发表看法，并对他人的看法作出适当的回应 · 能通过有效的话轮转换与人对话 · 能根据情境和对象选择说话内容和用语
- **聆听**: 能听出隐含信息 · 能根据聆听内容的语境、关键词语等进行推断、预测
- **说话**: 能围绕中心说话 · 能按情境及对象／需要说话

The syllabus has no separate 语文知识 list. Pinyin, characters, words, 成语, sentences and 病句 come into
the pack through SEAB's 考试目标 (对汉字形、音、义的辨认; 词语的认识和运用（包括成语和习用语）; 句子结构的认识和运用)
and the 语文应用 section, which SEAB describes as 包括汉语拼音、字、词、短语和句子.

## Item alignment

Every item's `notes` field repeats its syllabus objective and exam component.

| Exam component (SEAB 0005) | Syllabus objective (2015) · SEAB 考试目标 | Pack topic.subskill | Items |
|---|---|---|---|
| 一 语文应用: 汉语拼音 | 阅读：能辨识字形、字音、字义 · 对汉字形、音、义的辨认 | yuwen.pinyin | p6chi-p2-01-q1, q2 |
| 一 语文应用: 字 | 阅读：能辨识字形、字音、字义；写作：能书写常用字 · 对汉字形、音、义的辨认 | yuwen.char_choice | p6chi-p2-01-q3, q4 |
| 一 语文应用: 词 (incl. 关联词) | 阅读：能推断词、句的意思 · 词语的认识和运用；句子结构的认识和运用 | yuwen.word_choice | p6chi-p2-01-q5, q6, q7 |
| 一 语文应用: 短语 | 写作：能通顺地表达 · 词语的认识和运用 | yuwen.phrase | p6chi-p2-01-q8 |
| 一 语文应用: 成语 | 阅读：能推断词、句的意思 · 词语的认识和运用（包括成语和习用语） | yuwen.idiom | p6chi-p2-01-q9 |
| 一 语文应用: 句子 | 写作：能写完整的句子，检查并修改文字；阅读：能理解隐含信息 · 句子结构的认识和运用 | yuwen.sentence | p6chi-p2-01-q10, q11 |
| 一 短文填空 | 阅读：能推断词、句的意思 · 词语的认识和运用 | tiankong.cloze | p6chi-p2-01-q12 – q16 |
| 二 阅读理解一 | 阅读：能理解隐含信息；能推断事情的发展和结果；能概括内容（文章主旨） · 阅读理解 | yuedu1.rc_mcq | p6chi-p2-01-q17 – q20 |
| 三 完成对话 | 书面互动：能对他人的提问作出适当的回应 · 阅读理解 | duihua.dialogue | p6chi-p2-01-q21 – q24 |
| 四 阅读理解二: 实用文 | 书面互动：掌握交流媒介的格式与用语（电邮） · 阅读理解 | yuedu2.practical_text | p6chi-p2-01-q25, q26 |
| 四 阅读理解二: 书面互动 | 书面互动：根据情境和对象选择内容和用语 · 写作／书面互动 | yuedu2.written_interaction | p6chi-p2-01-q27 |
| 四 阅读理解二: 篇章 | 阅读：能推断词、句的意思；能理解隐含信息；能概括内容（人物性格特点） · 阅读理解 | yuedu2.word_meaning, explain_reason, character_feeling | p6chi-p2-01-q28, q29, q30 |
| Vocabulary for 语文应用 and 阅读 | 阅读：能推断词、句的意思 · 词语的认识和运用（包括成语和习用语） | idioms.recognise | p6chi-idiom-cards-01 – 08 |

## Out of scope

- 高级华文 (Higher Chinese, 0015) and 基础华文 (Foundation, 0025): different papers and character bands. This pack is the standard 华文 course only.
- 文言文, classical poems as test texts, and grammar terminology for its own sake (主语, 谓语 as labels): the syllabus teaches use, not analysis.
- Characters outside the 1600–1700 recognised at P6: keep passages to everyday words; give pinyin for a rare one rather than drop the story.
- Any question copied or lightly reworded from a school or PSLE paper. Write new ones from the archetypes in `skill.json`.
