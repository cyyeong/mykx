# Syllabus map: MOE EL Syllabus 2020 and PSLE Paper 2

These tags are the contract between the tutor, the items and the learner record (topic
`language.grammar` + subskill `sva` is written `grammar.sva` in conversation). Use them
**exactly**; invented tags make the statistics meaningless.

## Documents this pack follows

| Document | Publisher, version | Where |
|---|---|---|
| *English Language Syllabus, Primary* (EL Syllabus 2020) | MOE, Curriculum Planning and Development Division; implementation starting with the 2020 Primary One cohort (so the 2025 P6 cohort onwards) | moe.gov.sg, "2020 English Language (Primary)" on the Primary syllabus page: https://www.moe.gov.sg/media/files/primary/b8eb0437-67fb-4042-a26c-64fef2af12df.pdf |
| *PSLE English Language (Syllabus 0001)* | SEAB; implemented from the Year of Examination 2025; the document listed for 2026 | https://www.seab.gov.sg/psle/psle-formats-examined-in-2026/ |

The syllabus sets the learning outcomes; SEAB's document sets the paper. Where a school's
own P6 papers differ, the learner's school format wins for school tests, and SEAB's format
wins for PSLE practice.

## Areas of language learning and learning outcomes used

EL Syllabus 2020 has six Areas of Language Learning (AoLL): Listening and Viewing; Reading
and Viewing; Speaking and Representing; Writing and Representing; Grammar; Vocabulary.
Paper 2 draws on four of them. The terms below are the syllabus's own.

| AoLL | Focus area | Learning outcome (syllabus wording, shortened) | Upper-primary emphasis |
|---|---|---|---|
| Reading and Viewing | Reading and Viewing Closely | LO2: process and comprehend age-/year level-appropriate texts by focusing on literal and inferential meaning | use a range of comprehension, information and media literacy skills to construct meaning from diverse and multiple texts |
| Reading and Viewing | Reading and Viewing Critically | LO3: analyse, evaluate and appreciate texts by focusing on implied meaning, higher-order thinking and judgement | respond to implied meaning and make personal connections |
| Grammar | Grammar at Word, Phrase and Sentence Levels | LO2: apply knowledge of grammatical rules at word and phrase levels; LO3: … at sentence level | apply grammatical knowledge to convey ideas accurately; varying the forms of construction conveys different meanings |
| Grammar | Grammar at Text Level | LO4: show understanding of how the purposeful use of language shapes meaning in texts | use cohesive devices and grammatical structures to link clauses, sentences and paragraphs |
| Vocabulary | Developing Rich Vocabulary Knowledge | LO2: build rich vocabulary knowledge | how words are formed, how they relate to one another and how they are used in context |
| Vocabulary | Using Vocabulary | LO3: use words appropriate for purpose, audience, context and culture | use fixed expressions accurately and appropriately |
| Writing and Representing | Acquiring the Mechanics of Writing | LO2: use accurate and consistent spelling | spell frequently misspelled and multisyllabic words accurately |
| Writing and Representing | Writing and Representing Creatively and Critically | LO5: review, revise, edit and proofread to improve writing | |

## Topic and subskill tags by Paper 2 component

| Topic (component) | Syllabus areas | Subskills |
|---|---|---|
| `language.grammar` (Grammar, Booklet A) | Grammar LO2, LO3 | tense_past_perfect, tense_perfect, tense_consistency, sva, question_tags, conditionals, relative_pronouns, modals, prepositions, connectors, pronouns, gerund_infinitive, passive_voice |
| `language.vocab` (Vocabulary, Booklet A) | Vocabulary LO2, LO3 | context_clues, phrasal_verbs, idioms, word_meaning |
| `language.vocab_cloze` (Vocabulary Cloze, Booklet A) | Vocabulary LO2; Reading and Viewing LO2 | vocab_cloze_context, vocab_cloze_collocation |
| `reading.visual` (Visual Text Comprehension, Booklet A) | Reading and Viewing LO2, LO3 (multimodal texts) | vt_purpose, vt_details, vt_conditions, vt_inference |
| `language.grammar_cloze` (Grammar Cloze, Booklet B) | Grammar LO2, LO3, LO4 | cloze_relatives, cloze_connectors, cloze_prepositions, cloze_pronouns, cloze_determiners, cloze_verbs |
| `language.editing` (Editing for Spelling and Grammar, Booklet B) | Writing and Representing LO2, LO5; Grammar LO2, LO3 | edit_spelling, edit_tense, edit_sva, edit_word_form, edit_prepositions |
| `reading.comp_cloze` (Comprehension Cloze, Booklet B) | Reading and Viewing LO2; Grammar LO4; Vocabulary LO2 | comp_cloze_grammar, comp_cloze_connector, comp_cloze_content |
| `language.synthesis` (Synthesis / Transformation, Booklet B) | Grammar LO3, LO4 | synthesis_concession, synthesis_reported_speech, synthesis_time, synthesis_relative, synthesis_passive, synthesis_conditional, synthesis_correlative, synthesis_comparison |
| `reading.comprehension` (Comprehension OE, Booklet B) | Reading and Viewing LO2, LO3; Vocabulary LO2 | comp_literal, comp_inference, comp_vocab, comp_referent, comp_true_false, comp_sequence, comp_feelings, comp_character |

## Item alignment (component, topic, items)

Every item in `items/practice-01.json` also names its syllabus area, learning outcome and
component in its `notes`.

| SEAB component (marks) | Topic | Items | What they assess |
|---|---|---|---|
| Grammar (10) | `language.grammar` | q1–q4 | past perfect from 'by the time'; neither … nor agreement; tag after 'nobody'; third conditional |
| Vocabulary (5) | `language.vocab` | q5–q7 | contrast clue ('although'); phrasal verb 'call off'; idiom for revealing a secret |
| Vocabulary Cloze (5) | `language.vocab_cloze` | q8–q10 | community-garden passage: parched, drew up, flourishing |
| Visual Text Comprehension (5) | `reading.visual` | q11–q14 | Fix-It Fair poster: purpose, item limits, age rule, NOT-true detail |
| Grammar Cloze (10) | `language.grammar_cloze` | q15–q18 | kayaking passage with a word box: whose, although, of, ourselves |
| Editing for Spelling and Grammar (10) | `language.editing` | q19–q22 | charity-run passage: agreement, two spellings, tense |
| Comprehension Cloze (15) | `reading.comp_cloze` | q23–q26 | otter passage: feed on, so, leash, may |
| Synthesis / Transformation (10) | `language.synthesis` | q27–q29 | Despite; reported speech; No sooner … than |
| Comprehension OE (20) | `reading.comprehension` | q30–q33 | chess story: word meaning, character, feelings with evidence, inference |

## Error types (one per wrong answer)

| Type | Means | Fix |
|---|---|---|
| rule | did not know the rule | reteach with the routine, then two twins |
| clue | knew the rule, missed the clue in the sentence | Clue First: circle the clue before answering |
| vocab | did not know the word or expression | teach it with a sentence of the learner's own |
| misread | answered a different question | underline the question word first |
| evidence | answer not supported by the passage | Question–Locate–Answer: find the line first |
| incomplete | one idea when two were needed | count the marks, count the ideas |
| spelling | right word, wrong spelling | say it in syllables, write it three times |
| structure | synthesis meaning right, sentence pattern wrong | Keep–Change–Check with the pattern card |
| careless | knew it, slipped | the ten-minute check |
| blank | left it empty | always write a best attempt |

## Depth limits for P6

Keep practice inside what the primary syllabus and the PSLE format ask for:

* Grammar is tested in sentences and short passages, never as named terminology on its own.
* No secondary-level transformations (mixed conditionals, inversion beyond *no sooner,
  hardly, not only*, reported questions with complex embedding).
* Comprehension asks literal, inferential and evaluative questions on one passage; no
  summary writing and no "language for effect" essays (those start at secondary level).
* Visual texts are posters, flyers, notices and simple web pages.
