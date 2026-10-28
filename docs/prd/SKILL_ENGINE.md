# myKx Skill Engine: skill packs, agents that load them, learner memory, and an admin console

**Written:** Tue 27 Oct 2026 (Day 1). **Status:** in scope as PRD_REVIEW E11; scheduled in `docs/plan/IMPLEMENTATION_PLAN.md` (stream C). **MVP levels:** P3, P6 and Sec 2, because that's where the real material is.

## 1. The idea

Every Kix conversation is driven by **skill packs**: versioned bundles of teaching method, syllabus knowledge and reviewed questions for one subject at one level. Kid-facing **agents** (Kix Tutor, Kix Vibe Maker) and adult-facing agents (Parent Narrator, Content Curator) **load and unload skills as the lesson needs them**, using Muse Spark's tool calling with client-executed `tool_search` on the Responses API. Admins manage the catalogue, and every upload of new questions or notes makes a skill better through a review-then-publish version step.

**No RAG.** Skills carry the knowledge, and agents read reference sections by id through tools; there is no vector store and no embeddings. Long-term knowledge *about the child* lives in a per-learner **LLM wiki ("Kix's Notebook", §5a)**, while actual progress stays in deterministic database tables.

Why it matters for judging: it's a real agent architecture on Meta tooling, not basic RAG (Best Agentic bonus, Technical Depth); content grows without code changes (Impact); and the founder's seven real tutor skills prove the format (P3 Maths, Science, English and Chinese; PSLE Maths and Science; Sec 2 G3 Science).

## 2. What the seven source skills contain (27 Oct audit)

| Source skill | Level | Reusable as-is | Must be scrubbed | Must stay private |
|---|---|---|---|---|
| p3-maths-tutor | P3 | method, syllabus map, heuristics, question-generation rules, 4 original practice sets (`set_*.json`) with working and distractor notes, 92 original SVG/PNG figures | child's name in prose and headers | `question_bank.json` (stems from 2025 school papers) |
| p3-science-tutor | P3 | method incl. CER answering, 3 content notes (life cycles, diversity, magnets), 3 original sets (`diagnostic_01`, `eoy_mock_80`, `mission_magnets_01`) | name, personal coaching notes | `past-papers-verified.md` (school papers) |
| p3-english-tutor | P3 | Paper 2 method, teaching toolkit, answer strategies, 3 original quest specs | name, "known facts" section | `past-papers-2025.md` |
| p3-chinese-tutor | P3 | 15-lesson word catalogue (pinyin, meaning), exam blueprint, flashcard specs | name | `question-bank.md`; Twemoji icons (CC-BY 4.0, keep attribution) and OFL fonts are fine to ship |
| psle-math-tutor | P6 | heuristics, topic playbooks, tutoring method, worksheet cookbook | name, exam date, personal learning notes | `question_bank.md` (225 questions from 2026 prelims) |
| psle-science-tutor | P6 | concept cards, answer techniques, memory strategies, syllabus 2026, topic stats | name | `question_bank.json`, the learner profile JSON |
| sec2-g3-science-tutor | Sec 2 | electrical-systems notes, exam blueprint, syllabus map, 1 original set with figures | name, personal learning notes | — |

All seven also ship Python scripts (reportlab paper builders, diagram drawers, trackers). **myKx never runs skill scripts**; it ships its own trusted tools (§5). The scripts stay in the private archive as a reference for porting.

## 3. Concepts

| Concept | What it is | Where it lives |
|---|---|---|
| **Skill pack** | method + references + items + archetypes for one subject and level | `content/skills/<id>/` (public, scrubbed, original only) and the `skills` tables (versions, admin edits) |
| **Item** | one question in a unified schema (below) with provenance and review status | `skill_items` |
| **Archetype** | a question pattern with exam weight ("before-and-after ratio, total unchanged"), derived from past papers without copying them | in the pack manifest |
| **Learner record** | the truth about progress: attempts, marks, mastery by subskill, review schedule, rewards; computed by tested code (PRD §6) | `attempts`, `ledger`, `profiles` (level, enrolled subjects, exam dates) |
| **Kix's Notebook** | the learner's long-term memory as an LLM-maintained wiki: personality, how they ask, language slips, weak spots in words, events, memorable moments, revision history | `notebook_pages`, `notebook_revisions` (private, Standard models only) — **never inside a skill** |
| **Agent** | a Kix role with a system prompt, an allowed-skill policy and a tool set | `agent_policies` |
| **Tool** | trusted myKx code a skill exposes to the model (read a reference section, find items) | `lib/skills/tools.ts` |
| **Skill event** | a load, unload, refusal or tool call, for the trace and the parent's "why did Kix say that" | `skill_events` |

## 4. Skill pack format (myKx Skill Pack v1)

Stays compatible with Agent Skills (a `SKILL.md` with `name`/`description` frontmatter), so the same pack still works in Claude Code or Muse Code.

```
content/skills/p3-science/
  SKILL.md              # method: adaptive loop, teaching rules, CER technique (no child details)
  skill.json            # manifest (below)
  references/           # loaded on demand, section by section (## headings are sections)
    syllabus-map.md  content-cycles.md  content-magnets.md  answering-cer.md  question-generation.md
  items/*.json          # reviewed, original items in the unified schema
  figures/*.svg         # original diagrams referenced by items
```

`skill.json`:
```json
{
  "id": "p3-science", "version": "1.0.0", "status": "published",
  "title": "P3 Science", "subject": "science", "level": "P3",
  "syllabus": "MOE 2023 Primary Science", "language": "en",
  "agents": { "tutor": "auto", "vibe": "on_demand", "parent": "on_demand", "curator": "auto" },
  "topics": [{ "id": "cycles.animal", "title": "Life cycles of animals", "weight": 0.18, "subskills": ["stages_order", "metamorphosis", "compare_cycles"] }],
  "archetypes": [{ "id": "LC-ORDER", "topic": "cycles.animal", "pattern": "order the stages from a picture", "exam_weight": 0.06 }],
  "tools": ["read_reference", "find_items", "check_answer"],
  "sources": [{ "kind": "own", "note": "Generated with the founder's tutor skill, reviewed" }],
  "licence": "content CC-BY 4.0; icons Twemoji CC-BY 4.0"
}
```

**Unified item schema** (a superset of the source formats: `set_*.json`, `placement_quest.json`, the science banks and the Chinese card specs map onto it):
```json
{
  "id": "p3sci-lc-004", "skill": "p3-science", "topic": "cycles.animal", "subskill": "stages_order",
  "archetype": "LC-ORDER", "difficulty": 2, "marks": 2, "type": "mcq",
  "stem": "...", "options": ["...", "...", "...", "..."], "answer": 3,
  "working": ["..."], "distractors": { "1": "why a child picks this", "2": "..." },
  "hints": ["nudge", "stronger nudge"], "figure": "figures/frog-stages.svg",
  "source": { "kind": "own|licensed|generated", "ref": "set_diagnostic_01#A4" },
  "status": "draft|reviewed|retired", "reviewed_by": "admin id", "version_added": "1.0.0"
}
```
Types for the MVP: `mcq`, `short` (exact or numeric answer with tolerance), `open` (CER-style; marked by self-check against the model answer, so it never changes mastery), `card` (flashcards and word cards).

## 5. Runtime: how an agent loads and unloads skills

```
child opens a quest ──► orchestrator (server, deterministic)
   1. policy: agent=tutor, learner P3, enrolled [science, maths, english, chinese]
   2. preload: the quest's skill (p3-science) as a namespace; others stay deferred
   3. Responses API call: kix-core prompt + learner notes + tools:
        namespace p3_science { read_reference, find_items, check_answer }  (defer_loading on functions)
        { type: "tool_search", execution: "client" }
   4. child: "why do tadpoles lose their tail?"   → model calls p3_science.read_reference("content-cycles#metamorphosis")
      child: "can you help with my maths too?"     → model emits tool_search_call("P3 maths fractions")
          → app checks policy (enrolled? allowed for tutor? ≤ 2 subject skills loaded?) → returns p3_maths namespace or a refusal
   5. quest ends or subject switches → unload: next turn starts from kix-core + the new quest's skill only
   6. every load, unload, refusal and tool call → skill_events (shown in "under the hood")
```

**Tools (trusted code, per skill namespace):** `read_reference(section)` returns one section of one reference file; `find_items(topic, subskill?, difficulty?, n)` returns reviewed items only and never their answers; `check_answer(item_id, answer)` runs deterministic marking (a correct/incorrect signal so Kix can respond; the attempt and mastery are written by the app, not by the model). Global tools: `learner_summary()` (mastery by subskill, read-only). **Hard limits:** at most 2 subject skills at once, `muse-spark-1.3` Standard only, 10 s timeout on the hint path (fixture hint fallback), and no tool can write scores (hard rule 5).

**Built on 29 Oct** (`lib/skills/runtime.ts`, `docs/ARCHITECTURE.md` §4.10): the Kix Tutor and Ask Kix call `load_skill`, `read_reference`, `find_items`, `check_answer` and `notebook_read` as plain function tools on chat completions; trusted code runs each one under the policy above (the child's own packs, at most two loaded, three tool rounds), and every load, refusal and tool call is a `skill_events` row shown in Under the hood. Muse Spark only accepts `tool_choice: "auto"`, so the loop's last round is sent without tools. Not built yet: `tool_search` namespaces, `learner_summary`, unloading between quests, and the other agents on the engine.

**Agents in the MVP:**

| Agent | Faces | Skills | Tools |
|---|---|---|---|
| Kix Tutor | child | the quest's skill auto; other enrolled skills on demand | read_reference, find_items, check_answer, learner_summary, notebook_read |
| Kix Vibe Maker | child | the brief's subject skill on demand (accuracy check for flashcards) | read_reference, find_items, notebook_read |
| Parent Narrator | parent | each enrolled skill's exam blueprint, read-only | read_reference, learner_summary, notebook_read |
| Memory Keeper | nobody (runs after each session) | none | notebook_read, notebook_propose |
| Content Curator | admin | the target skill auto | read_reference, find_items, propose_items |

Note: `tool_search` can't be combined with `json_schema` output in the same request, so structured outputs (Vibe spec, parent summary, extraction) are separate calls after the agent turn.

## 5a. Learner memory: Kix's Notebook (an LLM wiki per child)

**Two kinds of memory, never mixed.** The database is the record: what was attempted, what was right, mastery, what's due, rewards. Code computes all of it, and models can't write to it (hard rule 5). The Notebook is the understanding: a small set of markdown pages per child that the **Memory Keeper** agent maintains, so Kix feels like it knows the child across weeks.

| Page | What it holds | Example line |
|---|---|---|
| `about.md` | personality, interests, what motivates, what to avoid | "Lights up for anything with frogs or jets. Gets flat if a session runs past 15 minutes." |
| `asking.md` | how they ask for help, common question shapes | "Asks 'why' before trying; give one nudge, then wait." |
| `language.md` | vocabulary and grammar slips, Mother Tongue notes | "Mixes up 'larva' and 'pupa'. Writes 'more bigger'." |
| `weak-spots.md` | weaknesses in words, each linked to the database subskill | "Ordering life-cycle stages (cycles.animal/stages_order; 57%, limited evidence, 30 Oct)." |
| `events.md` | exams, school events, holidays, things the parent mentions | "P3 EOY Science on 2 Nov." |
| `memorable.md` | wins and moments worth bringing back | "First frog card, 30 Oct. Named Pip after a song." |
| `revision-log.md` | a readable timeline that links to sessions | "30 Oct: 12 min, life cycles; the 'tail' idea finally clicked." |

**How it updates.** After a session, the Memory Keeper reads the session transcript, the deterministic session stats and the current pages, then returns **patch operations** (`append`, `replace_section`, `remove_line`) as JSON-schema output. The app applies them as a new revision with the reason and the session id. Numbers quoted in the Notebook are copied from the database with a date; they're never the source of truth, and the next recompute supersedes them.

**How agents use it.** The Notebook's index (page names and one-line summaries) sits in every Kix prompt; agents read whole pages on demand with `notebook_read(page)`, the same progressive-disclosure pattern as skills. The Tutor uses `asking.md` and `language.md` to pitch hints; the Parent Narrator uses `weak-spots.md` and `events.md`; Home can bring back a `memorable.md` moment ("Remember Pip's first hop?").

**Rules.** Kind, factual and short; no labels or diagnoses unless a parent wrote them, and the Memory Keeper must never infer one (a line like "might have a learning difficulty" is rejected); no other children's names; Standard models only. Parents can read every page and its history, edit or delete any line, and wipe the Notebook (PDPA access and correction). Children don't see the Notebook in the MVP, except moments from `memorable.md`.

## 6. Knowledge growth: upload → extract → review → publish

1. **Upload** (admin): PDF, image, `.md` notes or `.json` question set, to a chosen skill. The form records the **source and rights**: own material, licensed, or a school paper for private reference only.
2. **Extract** (Content Curator, Muse Spark Standard with vision for PDFs and images; JSON and MD are parsed directly): items in the unified schema with topic and subskill tags taken from the skill's syllabus map; reference notes split into sections; a confidence flag per item ("answer key unclear", "figure needed").
3. **Review**: side by side, source page vs extracted item; edit, approve or reject. Near-duplicates of existing items are flagged.
4. **Publish**: approved items join the next minor version (`1.0.0 → 1.1.0`); agents pick it up on the next session; the version list shows what changed.
5. **Rights rule:** "school paper, private reference" uploads can only add archetypes and topic statistics; their questions are never served to children or shown to other households. Kix generates fresh questions from the archetypes instead, and those go through the same review step.

**Built on 29 Oct: knowledge refines a skill** (founder; `lib/knowledge/session.ts`, `crosscheck.ts`, `kix-questions.ts`, `refine.ts`; board KnowledgeSession; `docs/ARCHITECTURE.md` §6.1). PDFs today; images, `.md` and `.json` uploads are not built.

- **Review sessions.** A session holds several PDFs, added at any time: a question paper now, its answer sheet later. Muse's extraction says what each one is (question paper, answer sheet, both, notes), its tier, and every question by number with its marks, the answer it prints and Muse's own worked answer (never the question's wording). Code pairs a sheet with its paper by school, year, exam and paper number (the admin can pair or unpair by hand), routes each paper to its pack by level and subject, and the admin can **override level, subject and tier** per paper ("changed by you").
- **Muse cross-checks** (a separate structured call) every answer from the paper or the sheet, our own material's questions and Kix's new questions: `ok`, `mismatch` with its own answer, `spelling` with the fix, `unusual` (marks that don't fit, a missing answer), or `waiting` (no answer sheet yet). They are highlighted in the review; **publishing is blocked while a mismatch is unresolved** (the admin fixes the key, uses Muse's answer, or marks "key is right").
- **Everything is editable**: patterns, traps, marking cues, questions and keys can be edited, removed or added before publishing.
- **Kix's own questions**: written from the approved patterns, traps and cues (original wording and numbers), worked again by Muse, approved one by one.
- **Publishing** makes a new skill version of the target pack (§7): approved patterns join the manifest's archetypes with marks and how often they were seen, traps and cues go to `references/exam-patterns.md`, a topic the pack lacked joins its scope, and approved questions become reviewed items (our own or licensed material's questions, and Kix's). A school paper's own questions are never kept, stored or served. The pack schemas and the safety scanner check the version first. A `skill_updates` row keeps the history and Ask Kix's "latest exam patterns".

## 7. Admin console (laptop, `app/(admin)`)

Designs: [myKx Screens](https://claude.ai/artifact/8crEyKVQm9QxCHLDqPXioP), row 6 (catalogue, add knowledge, and the parent's view of Kix's Notebook); 29 Oct boards SkillEditor, SkillImport and KnowledgeSession (`docs/design/boards/`).

- **Skills catalogue:** filter by level and subject; a card per skill with version (published or the built-in default), drafts and versions, reviewed and draft item counts, coverage against the exam blueprint, and which agents use it; Edit skill and Import skill.
- **Skill detail:** Items (table by topic and subskill, review status, difficulty spread), References (sections and how often agents read each), Versions (list with what changed).
- **Skills you can edit (built 29 Oct, founder):** `/admin/skills/[pack]` shows the pack's files in a text editor (checked as you type: JSON, the manifest and item schemas), **Save draft** and **Publish**, and **Versions** with **Diff**, **Restore** and **Delete**. The pack on disk is the **default** version, with a lock: it can't be deleted and can always be restored. The published version is the newest published one, else the default; restore makes a new published version; deleting the published one falls back. Every save and publish passes the pack schemas and the safety scanner or is refused with the reasons. Kix Tutor, Ask Kix, the reason coach, the Vibe Zone, printable papers and the catalogue read the published version (`lib/skills/overrides.ts`). Table `skill_versions` (`docs/ARCHITECTURE.md` §5.4).
- **Enhance with Muse:** the admin writes what to improve; Muse Spark 1.3 (Standard, structured) proposes whole-file changes to `SKILL.md` and `references/*.md` and new questions (`items/enhance-<version>.json`, `draft` until the admin marks them reviewed), shown as a diff and accepted into the draft. Muse works each new question out again and flags any it couldn't reproduce. Agent: Skill Editor (`skill-editor`).
- **Import a skill:** a standard agent skill as `.zip` or `.skill` (up to 5 MB, read in memory). `SKILL.md` (with name and description front matter), Markdown references and item JSON are kept; everything else is dropped and listed, scripts above all (never kept or run). The safety scanner refuses the import while it finds a child's name or a private phrase, showing where. Without a myKx `skill.json`, Muse proposes the manifest (id, level, subject, tier, topics, agents) and the admin edits every field before "Import as draft". An imported pack has no default: deleting all its versions deletes it.
- **Add knowledge:** review sessions (§6): upload, rights, extraction progress, pairing, Muse's cross-check, edits and overrides, Kix's own questions, publish as a skill version.
- **Agents and tools:** a matrix of agents × skills (auto, on demand, off), tools per agent, limits; the model is locked to Standard Spark.
- **Activity:** recent skill events and model runs.

Roles: `admin` (platform content team; in the demo, the seeded parent account also has it). Parents never see other households' uploads.

## 8. Privacy, copyright and safety rules

- **Skill packs are child-agnostic.** Names, traits, diagnoses and progress never go into a pack. What myKx knows about a child lives in the private learner record (deterministic) and Kix's Notebook (LLM wiki, parent-visible and parent-editable), and only reaches Standard models.
- **The source skills' child-specific content becomes seed material only for the founder's own private household,** never the demo or the repo. The demo learners get synthetic Notebooks.
- **The raw source skills are never committed.** They stay in a private folder outside the repository (`MYKX_PRIVATE_DIR`) or the private Supabase bucket; the importer writes only scrubbed, original content to `content/skills/`.
- **Third-party exam questions are never served** to children or committed; only derived archetypes and statistics are.
- **Skill scripts are never executed** by the app (hard rule 4 extends to uploaded code).
- **Every generated or extracted item is reviewed** before a child sees it, and only reviewed items count toward mastery.

## 9. MVP cut line

- **Must (demo path):** importer for the 7 skills (scrub, map items, split public/private); skill tables and seed; Kix Tutor with client `tool_search` load and unload and the event trace; Kix's Notebook (seeded pages, Memory Keeper after each session, `notebook_read`, parent view with edit and delete); catalogue; skill detail (items); upload → extract → review → publish for JSON, Markdown and PDF.
- **Should:** agents × skills matrix with working toggles; versions list; reference read counts.
- **Roadmap slide:** school-level tenants, a skill marketplace, porting the diagram scripts into trusted SVG tools. (The in-app editor, rollback and diffs were built on 29 Oct, §7.)
