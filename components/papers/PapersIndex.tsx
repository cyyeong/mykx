// "Practice papers": each child with the packs for their level, and a short or full paper to print.
// Server component; the kid route shows one child (themselves).
import Link from "next/link";
import type { PackSummary } from "@/lib/print/bank";
import type { SkillLevel, SkillSubject } from "@/lib/types";
import { levelName, subjectShort } from "./labels";
import "./paper.css";

export interface IndexKid {
  id: string;
  nickname: string;
  level: SkillLevel;
}

interface Props {
  kids: IndexKid[];
  packs: PackSummary[];
  /** Route prefix for print pages: "/papers" (grown-ups) or "/me/papers" (kids). */
  base: string;
  back: { href: string; label: string };
  audience: "parent" | "kid";
  theme: { pack: string; band: "junior" | "teen" };
}

const SUBJECT_ORDER: SkillSubject[] = ["english", "maths", "science", "chinese"];
const LEVEL_ORDER: SkillLevel[] = ["P3", "P6", "Sec 2"];

const SUBJECT_ICON: Record<SkillSubject, string> = {
  english: "M4 19V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h12M8 7h6M8 11h6",
  maths: "M5 4h14v16H5zM8 8h3M9.5 6.5v3M13 8h3M8 14l3 3M11 14l-3 3M13 15.5h3",
  science: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M7.5 15h9",
  chinese: "M4 6h16M12 3v18M6 10h12l-1 6H7zM8 20l8-4",
};

function packsFor(level: SkillLevel, packs: PackSummary[]) {
  return packs.filter((p) => p.level === level).sort((a, b) => SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject));
}

function PackRow({ pack, base }: { pack: PackSummary; base: string }) {
  const empty = pack.questions === 0;
  return (
    <li className="pp-pack">
      <span className="pp-pack-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d={SUBJECT_ICON[pack.subject]} />
        </svg>
      </span>
      <span className="pp-pack-name">
        <strong>{subjectShort(pack.subject)}</strong>
        <span>{empty ? "No reviewed questions yet" : `${pack.questions} reviewed questions`}</span>
      </span>
      {empty ? null : (
        <span className="pp-pack-actions">
          <Link href={`${base}/${pack.id}?length=short`} prefetch={false} className="mk-btn mk-btn--secondary">
            Short paper
          </Link>
          <Link href={`${base}/${pack.id}?length=full`} prefetch={false} className="mk-btn mk-btn--primary">
            Full paper
          </Link>
        </span>
      )}
    </li>
  );
}

export function PapersIndex({ kids, packs, base, back, audience, theme }: Props) {
  const levels = kids.length ? [] : LEVEL_ORDER.filter((l) => packs.some((p) => p.level === l));
  return (
    <div className="pp-index" data-theme={theme.pack} data-band={theme.band}>
      <div className="pp-index-wrap">
        <Link href={back.href} className="pp-back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
          </svg>
          {back.label}
        </Link>
        <h1>{audience === "kid" ? "Practice papers to print" : "Practice papers"}</h1>
        <p className="pp-index-lede">
          {audience === "kid"
            ? "Pick a subject and print a paper to try on real paper. The answers stay hidden until a grown-up shows them."
            : "Make a paper for each child, then print it or save it as a PDF. Each comes with a separate answer guide."}
        </p>

        {kids.map((kid) => {
          const list = packsFor(kid.level, packs);
          return (
            <section key={kid.id} className="pp-kid" aria-labelledby={`pp-kid-${kid.id}`}>
              <h2 id={`pp-kid-${kid.id}`}>
                {audience === "kid" ? "Your papers" : kid.nickname} <span>{levelName(kid.level)}</span>
              </h2>
              {list.length ? (
                <ul className="pp-packs">
                  {list.map((p) => (
                    <PackRow key={p.id} pack={p} base={base} />
                  ))}
                </ul>
              ) : (
                <p className="pp-index-empty">No papers for {levelName(kid.level)} yet.</p>
              )}
            </section>
          );
        })}

        {levels.map((level) => (
          <section key={level} className="pp-kid" aria-labelledby={`pp-level-${level.replace(" ", "")}`}>
            <h2 id={`pp-level-${level.replace(" ", "")}`}>{levelName(level)}</h2>
            <ul className="pp-packs">
              {packsFor(level, packs).map((p) => (
                <PackRow key={p.id} pack={p} base={base} />
              ))}
            </ul>
          </section>
        ))}

        <p className="pp-index-honest">
          Every paper uses original practice questions written and reviewed for myKx, never questions from school or exam papers. A short paper has about
          ten questions; a full paper follows the real paper&apos;s sections and marks as far as the reviewed questions allow.
        </p>
      </div>
    </div>
  );
}
