// The print page: a slim toolbar (screen only) over the paper. Shared by the parent and kid routes.
// Every control is a plain link to another seed, length, topic set or guide mode, so the URL always
// reproduces the paper on screen.
import Link from "next/link";
import type { ReactNode } from "react";
import type { PrintFigure } from "@/lib/print/bank";
import type { Paper } from "@/lib/print/paper";
import { paperHref, toggleTopic, type GuideMode, type PaperOptions } from "@/lib/print/params";
import { PaperDocument } from "./PaperDocument";
import { PrintButton } from "./PrintButton";
import { levelName, minutesLabel, subjectShort } from "./labels";
import "./paper.css";

export interface PaperScreenProps {
  paper: Paper;
  figures: Record<string, PrintFigure>;
  options: PaperOptions & { seed: string };
  /** Route of the print page, e.g. "/papers/p3-science". */
  base: string;
  /** A fresh seed for "New paper". */
  nextSeed: string;
  topics: { id: string; title: string; count: number }[];
  back: { href: string; label: string };
  /** Kids see the guide control as a grown-up's switch. */
  audience: "parent" | "kid";
  theme: { pack: string; band: "junior" | "teen" };
  made: string;
}

const GUIDE_LABELS: Record<"parent" | "kid", [GuideMode, string][]> = {
  parent: [
    ["with", "Paper + guide"],
    ["none", "Paper only"],
    ["only", "Guide only"],
  ],
  kid: [
    ["none", "Hidden"],
    ["with", "Paper + guide"],
    ["only", "Guide only"],
  ],
};

function Seg({ href, on, children }: { href: string; on: boolean; children: ReactNode }) {
  return (
    <Link href={href} prefetch={false} scroll={false} className="pp-seg" aria-current={on ? "true" : undefined}>
      {children}
    </Link>
  );
}

export function PaperScreen({ paper, figures, options, base, nextSeed, topics, back, audience, theme, made }: PaperScreenProps) {
  const href = (o: Partial<PaperOptions> & { seed?: string }) => paperHref(base, { ...options, ...o, seed: o.seed ?? options.seed });
  const topicTitles = topics.filter((t) => paper.topics.includes(t.id)).map((t) => t.title);
  const short = paper.length === "short";
  const target = paper.target.marks;
  const thin = !short && target !== null && paper.totalMarks < target * 0.85;
  const filename = `myKx ${paper.title} ${short ? "short" : "full"} paper ${paper.seed}`;
  return (
    <div className="pp-screen" data-theme={theme.pack} data-band={theme.band}>
      <div className="pp-bar">
        <div className="pp-bar-in">
          <div className="pp-bar-row pp-bar-row--top">
            <Link href={back.href} className="pp-back">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
              </svg>
              {back.label}
            </Link>
            <h1 className="pp-bar-title">
              {levelName(paper.level)} {subjectShort(paper.subject)} <span>practice paper</span>
            </h1>
            <div className="pp-bar-actions">
              <Link href={href({ seed: nextSeed })} prefetch={false} scroll={false} className="mk-btn mk-btn--secondary pp-new">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
                </svg>
                New paper
              </Link>
              <PrintButton filename={filename} />
            </div>
          </div>

          <div className="pp-bar-row">
            <div className="pp-ctl" role="group" aria-label="Length">
              <span className="pp-ctl-label">Length</span>
              <Seg href={href({ length: "short" })} on={short}>
                Short · about 10 questions
              </Seg>
              <Seg href={href({ length: "full" })} on={!short}>
                Full paper
              </Seg>
            </div>
            <div className="pp-ctl" role="group" aria-label={audience === "kid" ? "Answer guide, for grown-ups" : "Answer guide"}>
              <span className="pp-ctl-label">{audience === "kid" ? "Answer guide (grown-ups)" : "Answer guide"}</span>
              {GUIDE_LABELS[audience].map(([mode, label]) => (
                <Seg key={mode} href={href({ guide: mode })} on={options.guide === mode}>
                  {label}
                </Seg>
              ))}
            </div>
          </div>

          {topics.length > 1 ? (
            <div className="pp-bar-row">
              <div className="pp-ctl pp-ctl--chips" role="group" aria-label="Topics">
                <span className="pp-ctl-label">Topics</span>
                <Link href={href({ topics: [] })} prefetch={false} scroll={false} className="pp-chip" aria-pressed={paper.topics.length === 0}>
                  All topics
                </Link>
                {topics.map((t) => (
                  <Link
                    key={t.id}
                    href={href({ topics: toggleTopic(paper.topics, t.id) })}
                    prefetch={false}
                    scroll={false}
                    className="pp-chip"
                    aria-pressed={paper.topics.includes(t.id)}
                  >
                    {t.title}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <p className="pp-status" role="status">
            {paper.questionCount
              ? `${paper.questionCount} questions · ${paper.totalMarks} marks · about ${minutesLabel(paper.minutes)} · paper code ${paper.seed} · original myKx questions`
              : "No reviewed questions match these topics yet. Try All topics."}
            {thin ? (
              <span className="pp-status-note">
                {" "}
                Limited bank: only {paper.totalMarks} of the real paper&apos;s {target} marks have reviewed questions{paper.topics.length ? " in these topics" : ""} so far.
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <main className="pp-desk">
        {paper.questionCount ? <PaperDocument paper={paper} figures={figures} guide={options.guide} made={made} topicTitles={topicTitles} /> : null}
      </main>
    </div>
  );
}
