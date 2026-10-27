// A practice paper as clean A4 HTML: cover, sections and (optionally) the answer guide on its own pages.
// Server component, no state; print rules live in paper.css.
import type { PrintFigure } from "@/lib/print/bank";
import type { AnswerSpace, GuideEntry, Paper, PaperGroup, PaperPart, PaperQuestion } from "@/lib/print/paper";
import type { GuideMode } from "@/lib/print/params";
import { visualWidth } from "@/lib/print/markup";
import { Figure, InlineText, Passage, RichText, type FigKind } from "./Rich";
import { isChinese, levelName, levelNameZh, marksLabel, minutesLabel, sectionLabel, subjectName, subjectNameZh } from "./labels";

type Figures = Record<string, PrintFigure>;

interface Props {
  paper: Paper;
  figures: Figures;
  guide: GuideMode;
  /** "28 Oct 2026": when the paper was made. */
  made: string;
  /** Topic titles for the cover when the paper is limited to some topics. */
  topicTitles: string[];
}

export function PaperDocument({ paper, figures, guide, made, topicTitles }: Props) {
  const zh = isChinese(paper.language);
  // Language papers use pictures as prompts: drawn small. Science and maths diagrams keep their size.
  const figKind: FigKind = paper.subject === "chinese" || paper.subject === "english" ? "picture" : "figure";
  return (
    <div className="pp-doc" lang={paper.language} data-lang={zh ? "zh" : "en"} data-subject={paper.subject} data-level={paper.level.replace(" ", "")}>
      {guide !== "only" && (
        <>
          <Cover paper={paper} made={made} topicTitles={topicTitles} />
          <div className="pp-sheet pp-body">
            {paper.sections.map((section, i) => (
              <section key={section.id} className={`pp-section${section.newPage ? " pp-section--newpage" : ""}`} aria-labelledby={`pp-sec-${section.id}`}>
                <header className="pp-sec-head">
                  <h2 id={`pp-sec-${section.id}`}>
                    <span className="pp-sec-label">{sectionLabel(i, zh)}</span> {section.title}
                  </h2>
                  <span className="pp-sec-marks">
                    [{section.marks} {zh ? "分" : section.marks === 1 ? "mark" : "marks"}]
                  </span>
                </header>
                {section.note ? <p className="pp-sec-note">{section.note}</p> : null}
                {section.groups.map((group, g) => (
                  <Group key={g} group={group} figures={figures} zh={zh} figKind={figKind} />
                ))}
              </section>
            ))}
            <p className="pp-end">{zh ? "试卷完 · End of paper" : "End of paper"}</p>
          </div>
        </>
      )}
      {guide !== "none" && <Guide paper={paper} />}
    </div>
  );
}

// ─── Cover ─────────────────────────────────────────────────────────────────

function Cover({ paper, made, topicTitles }: { paper: Paper; made: string; topicTitles: string[] }) {
  const zh = isChinese(paper.language);
  const bi = (en: string, cn: string) =>
    zh ? (
      <>
        <span className="pp-zh">{cn}</span> <span className="pp-en">{en}</span>
      </>
    ) : (
      en
    );
  const hasMcq = paper.guide.some((g) => g.type === "mcq");
  const instructions = [
    bi("Answer all questions.", "回答所有问题。"),
    bi("Write your answers on this paper.", "把答案写在试卷上。"),
    ...(hasMcq ? [bi("Multiple choice: write the number of the correct option (1, 2, 3 or 4) in the brackets.", "选择题：把正确答案的号码写在括号里。")] : []),
    bi("The marks for each question are shown in brackets [\u00a0].", "每题的分数写在方括号［ ］里。"),
    ...(paper.subject === "maths" ? ["Show your working clearly. Marks are given for correct method."] : []),
  ];
  return (
    <div className="pp-sheet pp-cover">
      <div className="pp-cover-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/wordmark-on-light.svg" alt="myKx" className="pp-wordmark" />
        <span className="pp-cover-kind">{zh ? "练习卷 · Practice paper" : "Practice paper"}</span>
      </div>
      <div className="pp-cover-title">
        <p className="pp-cover-level">{zh ? `${levelNameZh(paper.level)} · ${levelName(paper.level)}` : levelName(paper.level)}</p>
        <h1>{zh ? `${subjectNameZh(paper.subject)} ${subjectName(paper.subject)}` : subjectName(paper.subject)}</h1>
        <p className="pp-cover-name">{paper.name}</p>
      </div>

      <div className="pp-cover-fill">
        <span className="pp-fill">
          <span className="pp-fill-label">{bi("Name", "姓名")}</span>
          <span className="pp-fill-line" />
        </span>
        <span className="pp-fill pp-fill--date">
          <span className="pp-fill-label">{bi("Date", "日期")}</span>
          <span className="pp-fill-line" />
        </span>
      </div>

      <dl className="pp-facts">
        <div>
          <dt>{bi("Time allowed", "时间")}</dt>
          <dd>{minutesLabel(paper.minutes)}</dd>
        </div>
        <div>
          <dt>{bi("Questions", "题数")}</dt>
          <dd>{paper.questionCount}</dd>
        </div>
        <div>
          <dt>{bi("Total marks", "总分")}</dt>
          <dd>{paper.totalMarks}</dd>
        </div>
      </dl>

      <div className="pp-cover-grid">
        <div className="pp-instructions">
          <h2>{bi("Instructions", "注意事项")}</h2>
          <ol>
            {instructions.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </div>

        <table className="pp-score">
          <thead>
            <tr>
              <th scope="col">{bi("Section", "部分")}</th>
              <th scope="col">{bi("Marks", "分数")}</th>
              <th scope="col">{bi("Score", "得分")}</th>
            </tr>
          </thead>
          <tbody>
            {paper.sections.map((s, i) => (
              <tr key={s.id}>
                <td>{sectionLabel(i, zh)}</td>
                <td>{s.marks}</td>
                <td />
              </tr>
            ))}
            <tr className="pp-score-total">
              <td>{bi("Total", "总分")}</td>
              <td>{paper.totalMarks}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="pp-honest">
        <p className="pp-honest-main">Original practice questions written for myKx</p>
        <p>
          Not taken from any school or exam paper. Paper code <strong>{paper.seed}</strong> · {paper.title} · {paper.length === "full" ? "full paper" : "short paper"} ·
          made {made}
          {topicTitles.length ? ` · Topics: ${topicTitles.join(", ")}` : ""}
        </p>
        {paper.attributions.map((a) => (
          <p key={a} className="pp-credit">
            Artwork: {a}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── Questions ─────────────────────────────────────────────────────────────

function Group({ group, figures, zh, figKind }: { group: PaperGroup; figures: Figures; zh: boolean; figKind: FigKind }) {
  const head = group.instruction || group.passage || group.figure || group.bank;
  const first = group.questions[0]?.number;
  const last = group.questions.at(-1)?.number;
  return (
    <div className="pp-group">
      {head ? (
        <div className="pp-group-head">
          {group.instruction ? (
            <p className="pp-instr">
              {group.questions.length > 1 && !zh ? <span className="pp-instr-range">Questions {first} to {last}. </span> : null}
              <InlineText text={group.instruction} />
            </p>
          ) : null}
          {group.figure ? <Figure fig={figures[group.figure]} kind="poster" alt={`Poster for questions ${first} to ${last}`} /> : null}
          {group.passage ? <Passage text={group.passage} /> : null}
          {group.bank ? <WordBank words={group.bank} /> : null}
        </div>
      ) : null}
      {group.questions.map((q) => (
        <Question key={q.number} q={q} figures={figures} zh={zh} figKind={figKind} />
      ))}
    </div>
  );
}

function WordBank({ words }: { words: string[] }) {
  return (
    <div className="pp-bank" role="list" aria-label="Word box">
      {words.map((w, i) => (
        <span key={i} role="listitem" className="pp-bank-word">
          <span className="pp-optn">({i + 1})</span> <InlineText text={w} />
        </span>
      ))}
    </div>
  );
}

function Question({ q, figures, zh, figKind }: { q: PaperQuestion; figures: Figures; zh: boolean; figKind: FigKind }) {
  const multi = q.parts.length > 1;
  return (
    <div className={`pp-q${multi ? " pp-q--multi" : ""}`}>
      <div className="pp-qn">{q.number}</div>
      <div className="pp-qb">
        {q.lead || q.leadFigure ? (
          <div className="pp-lead">
            {q.lead ? <RichText text={q.lead} /> : null}
            {q.leadFigure ? <Figure fig={figures[q.leadFigure]} kind={figKind} alt={`Figure for question ${q.number}`} /> : null}
          </div>
        ) : null}
        {q.parts.map((part) => (
          <Part key={part.itemId} part={part} number={q.number} figures={figures} zh={zh} figKind={figKind} />
        ))}
      </div>
    </div>
  );
}

function optionColumns(options: string[]): number {
  const widest = Math.max(...options.map(visualWidth));
  if (widest <= 14) return Math.min(4, options.length);
  if (widest <= 34) return 2;
  return 1;
}

function Part({ part, number, figures, zh, figKind }: { part: PaperPart; number: number; figures: Figures; zh: boolean; figKind: FigKind }) {
  const figure = part.figure ? <Figure fig={figures[part.figure]} kind={figKind} alt={`Figure for question ${number}${part.label ? `(${part.label})` : ""}`} /> : undefined;
  if (part.space.kind === "bracket" && !part.options)
    return (
      <div className={`pp-part pp-part--${part.type} pp-part--inline`}>
        <RichText text={part.text} figure={figure} figureAt={part.figureAt} />
        <Answer space={part.space} marks={part.marks} unit={part.unit} zh={zh} />
      </div>
    );
  return (
    <div className={`pp-part pp-part--${part.type}`}>
      <RichText text={part.text} figure={figure} figureAt={part.figureAt} />
      {part.options ? (
        <div className="pp-mcq">
          <ol className="pp-opts" style={{ gridTemplateColumns: `repeat(${optionColumns(part.options)}, minmax(0, 1fr))` }}>
            {part.options.map((o, i) => (
              <li key={i}>
                <span className="pp-optn">({i + 1})</span>
                <span className="pp-optt">
                  <InlineText text={o} />
                </span>
              </li>
            ))}
          </ol>
          <Answer space={part.space} marks={part.marks} unit={part.unit} zh={zh} />
        </div>
      ) : (
        <Answer space={part.space} marks={part.marks} unit={part.unit} zh={zh} />
      )}
    </div>
  );
}

function Marks({ marks, zh }: { marks: number; zh: boolean }) {
  return <span className="pp-marks" aria-label={zh ? `${marks}分` : marksLabel(marks)}>[{marks}]</span>;
}

function Answer({ space, marks, unit, zh }: { space: AnswerSpace; marks: number; unit?: string; zh: boolean }) {
  const ansLabel = zh ? "答：" : "Ans:";
  switch (space.kind) {
    case "bracket":
      return (
        <div className="pp-ans pp-ans--bracket">
          <span className="pp-bracket">(<span className="pp-bracket-gap" />)</span>
          <Marks marks={marks} zh={zh} />
        </div>
      );
    case "line":
      return (
        <div className="pp-ans pp-ans--line">
          <span className="pp-ans-label">{ansLabel}</span>
          <span className="pp-ans-blank" />
          {unit ? (
                  <span className="pp-unit">
                    <InlineText text={unit} />
                  </span>
                ) : null}
          <Marks marks={marks} zh={zh} />
        </div>
      );
    case "lines":
      return (
        <div className="pp-ans pp-ans--lines">
          <div className="pp-rules">
            {Array.from({ length: space.lines }, (_, i) => (
              <span key={i} className="pp-rule" />
            ))}
          </div>
          <Marks marks={marks} zh={zh} />
        </div>
      );
    case "box":
      return (
        <div className="pp-ans pp-ans--box">
          <div className="pp-box" style={{ height: `${space.mm}mm` }} />
          <Marks marks={marks} zh={zh} />
        </div>
      );
    case "working":
      return (
        <div className="pp-ans pp-ans--working">
          <div className="pp-working" style={{ height: `${space.mm}mm` }} aria-label="Space for working" />
          <div className="pp-ans pp-ans--line">
            {space.answerLine ? (
              <>
                <span className="pp-ans-label">{ansLabel}</span>
                <span className="pp-ans-blank" />
                {unit ? (
                  <span className="pp-unit">
                    <InlineText text={unit} />
                  </span>
                ) : null}
              </>
            ) : null}
            <Marks marks={marks} zh={zh} />
          </div>
        </div>
      );
  }
}

// ─── Answer guide ──────────────────────────────────────────────────────────

function Guide({ paper }: { paper: Paper }) {
  const zh = isChinese(paper.language);
  const bySection = paper.sections.map((s) => {
    const numbers = new Set(s.groups.flatMap((g) => g.questions.map((q) => q.number)));
    return { section: s, entries: paper.guide.filter((e) => numbers.has(e.number)) };
  });
  return (
    <div className="pp-sheet pp-guide" lang={paper.language}>
      <header className="pp-guide-head">
        <div>
          <p className="pp-guide-kicker">For grown-ups · keep separate from the paper</p>
          <h1>Answer guide</h1>
          <p className="pp-guide-meta">
            {paper.title} · {paper.name} · paper code <strong>{paper.seed}</strong> · {paper.totalMarks} marks
          </p>
        </div>
      </header>
      <p className="pp-guide-note">
        Marking at home: for open-ended answers, give the mark when the key idea is there, even in your child&apos;s own words. Marking points and
        accepted answers are listed under each answer. These scores stay on paper: they don&apos;t change anything in myKx.
      </p>
      {bySection.map(({ section, entries }, i) => (
        <section key={section.id} className="pp-guide-section">
          <h2>
            <span className="pp-sec-label">{sectionLabel(i, zh)}</span> {section.title}
          </h2>
          <div className="pp-guide-list">
            {entries.map((e) => (
              <GuideRow key={e.itemId} entry={e} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GuideRow({ entry }: { entry: GuideEntry }) {
  return (
    <div className="pp-guide-row">
      <div className="pp-guide-q">
        {entry.number}
        {entry.label ? `(${entry.label})` : ""}
      </div>
      <div className="pp-guide-a">
        <p className="pp-guide-answer">
          <InlineText text={entry.answer} />
          {entry.unit && entry.type !== "mcq" && !entry.unit.includes("_") && !entry.answer.includes(entry.unit) ? ` ${entry.unit}` : ""}
        </p>
        {entry.accept.length ? (
          <p className="pp-guide-extra">
            <span className="pp-guide-tag">Also accept</span> {entry.accept.map((a, i) => (
              <span key={i}>
                {i ? "; " : ""}
                <InlineText text={a} />
              </span>
            ))}
          </p>
        ) : null}
        {entry.marking.length ? (
          <ul className="pp-guide-points">
            {entry.marking.map((m, i) => (
              <li key={i}>
                <InlineText text={m} />
              </li>
            ))}
          </ul>
        ) : null}
        {entry.working.length ? (
          <div className="pp-guide-working">
            <span className="pp-guide-tag">{entry.type === "mcq" ? "Why" : "Working"}</span>
            <ul>
              {entry.working.map((w, i) => (
                <li key={i}>
                  <InlineText text={w} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="pp-guide-m">[{entry.marks}]</div>
    </div>
  );
}
