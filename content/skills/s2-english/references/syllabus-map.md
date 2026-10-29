# Syllabus map: MOE EL Syllabus 2020 (G2/G3) and the G3 papers

These tags are the contract between the tutor, the items and the learner record. Use them
**exactly**; invented tags make the statistics meaningless.

## Documents this pack follows

| Document | Publisher, version | Where |
|---|---|---|
| *English Language Syllabus, Secondary, G2 and G3* (EL Syllabus 2020) | MOE, Curriculum Planning and Development Division, 2024 edition; implementation starting with the 2020 Secondary One cohort | https://www.moe.gov.sg/api/media/5039d1de-488f-4819-b5b9-3bbef1639358/2020%20G2%20and%20G3%20English%20Language%20Syllabus.pdf |
| *G3 English Language, Syllabus K300* (Secondary Education Certificate, for 2027) | SEAB; replaces O-Level 1184 with the same papers and marks | https://www.seab.gov.sg/secondary-education-certificate-sec/g3-syllabuses-for-school-candidates-2027/ |

The 2024 edition renames the 2020 Express / Normal (Academic) syllabus for Full
Subject-Based Banding: its progression charts label Sec 2 at G3 as **2G3**, in the
lower-secondary columns.

## Areas of language learning and lower-secondary outcomes

EL Syllabus 2020 has six Areas of Language Learning (AoLL): Listening and Viewing; Reading
and Viewing; Speaking and Representing; Writing and Representing; Grammar; Vocabulary.
This pack uses four. Terms are the syllabus's own.

| AoLL | Focus area | Learning outcome (shortened) | Lower-secondary emphasis |
|---|---|---|---|
| Reading and Viewing | Reading and Viewing Closely | LO2: process and comprehend texts by focusing on literal and inferential meaning | apply close reading skills, including representing the ideas in texts, to texts with more complex and ambiguous meaning |
| Reading and Viewing | Reading and Viewing Critically | LO3: analyse, evaluate and appreciate texts by focusing on implied meaning, higher-order thinking and judgement | respond critically to implied meaning, integrate meaning across a text, show awareness of how writers' style can influence meaning |
| Grammar | Grammar at Word, Phrase and Sentence Levels | LO2, LO3: apply knowledge of grammatical rules at word, phrase and sentence levels | revisit and strengthen grammar learnt earlier; identify and address recurring language errors; use metalanguage during editing and self-correction |
| Grammar | Grammar at Text Level | LO4: show understanding of how the purposeful use of language shapes meaning in texts | cohesive devices that link clauses, sentences and paragraphs |
| Vocabulary | Developing Rich Vocabulary Knowledge; Using Vocabulary | LO2: build rich vocabulary knowledge; LO3: use words appropriate for purpose, audience, context and culture | how words are used in context; words used for literary effect |
| Writing and Representing | Writing and Representing Creatively and Critically | LO4: develop, organise and express ideas coherently and cohesively; LO5: review, revise, edit and proofread | (summary writing and editing) |

## Topic and subskill tags by exam component

| Topic (component) | Syllabus areas | Subskills |
|---|---|---|
| `writing.editing` (Paper 1 Section A) | Grammar LO2, LO3; Writing and Representing LO5 | edit_tense, edit_sva, edit_preposition, edit_relative, edit_noun_number, edit_verb_form, edit_pronoun, edit_connector |
| `reading.visual` (Paper 2 Section A) | Reading and Viewing LO2, LO3 (multimodal texts, semiotic modes) | vt_purpose, vt_audience, vt_visuals, vt_language |
| `reading.narrative` (Paper 2 Section B) | Reading and Viewing LO2, LO3; Vocabulary LO2 | literal_retrieval, inference, vocabulary_in_context, language_for_effect, character_feelings, theme |
| `reading.non_narrative` (Paper 2 Section C) | Reading and Viewing LO2, LO3; Vocabulary LO2 | literal_retrieval, inference, vocabulary_in_context, language_for_effect, writer_view |
| `reading.summary` (Paper 2 Section C) | Reading and Viewing LO2 (main ideas and details); Writing and Representing LO4 | main_ideas, own_words, summary_writing |

## Item alignment (component, topic, items)

Every item in `items/practice-01.json` also names its syllabus area, learning outcome and
component in its `notes`.

| K300 component | Topic | Items | What they assess |
|---|---|---|---|
| Paper 1 Section A: Editing | `writing.editing` | q1–q5 | food-bundle text: spend → spent, were → was, in → on, which → who, experience → experiences |
| | | q6–q9 | find the error: the number of … has; neither … nor … were; despite (no 'of'); in 1998 … searched |
| Paper 2 Section A: visual text | `reading.visual` | q10–q14 | tree-planting poster: purpose, audience, use of the picture, opening question, testimonial |
| Paper 2 Section B: narrative | `reading.narrative` | q15–q22 | cycle-shop story: retrieval, simile, inference, vocabulary in context, mood, feelings from actions, personification, what the ending suggests |
| Paper 2 Section C: non-narrative | `reading.non_narrative` | q23–q27 | boredom article: word choice, vocabulary in context, writer's view, explaining a claim, effect of the ending |
| Paper 2 Section C: summary | `reading.summary` | q28–q30 | main point vs example, own words, 80-word summary |

## Error types (one per wrong answer)

| Type | Means | Fix |
|---|---|---|
| rule | did not know the grammar rule | reteach with one example, then two twins |
| spot | knew the rule, did not find the error in the line | Read–Spot–Fix: check verbs, then agreement, then small words |
| evidence | answer not supported by the text | Point and Proof: find the line first |
| effect | quoted but did not explain the effect | Quote–Meaning–Effect |
| vocab | did not know the word | Swap Test with the surrounding sentence |
| lifting | copied the text in a summary or "own words" answer | rewrite the key words, then the structure |
| example | put an example in a summary instead of the point | Find–Strip: keep the point, cut the example |
| incomplete | one idea when two were needed | count the marks, count the ideas |
| careless | knew it, slipped | the final check |
| blank | left it empty | always write a best attempt |

## Scope for Sec 2 G3

* Editing tests grammatical errors only; spelling and punctuation are not part of this
  component (SEAB K300).
* Texts are shorter than the Sec 4 papers (about 300–400 words each here) and summaries
  may be shorter than 80 words in school tests; the skills are the same.
* Language-for-effect questions ask what a word, image or sentence suggests and why the
  writer chose it; naming the device alone earns nothing without the effect.
* Writing (situational and continuous), Listening and Oral are outside this pack.
