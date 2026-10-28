"use client";

// Draws Kix's homework explanation from its validated spec (lib/kix/homework.ts). Trusted components only: the
// model chooses blocks and words, never markup (AGENTS.md rule 4).
import { useState } from "react";
import type { Block } from "@/lib/kix/homework";
import s from "./ask.module.css";

const SPARK = "M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z";
const HOOK_LABEL = { rhyme: "Rhyme", story: "Story", acronym: "Letters to remember", picture: "Picture it", chant: "Chant" } as const;

function BarModel({ block }: { block: Block }) {
  const bars = block.bars ?? [];
  const nums = bars.flatMap((b) => b.parts.map((p) => Number.parseFloat(p.value))).filter((n) => Number.isFinite(n) && n > 0);
  const unit = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 1;
  const width = (v: string) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : unit;
  };
  const longest = Math.max(1, ...bars.map((b) => b.parts.reduce((t, p) => t + width(p.value), 0)));
  return (
    <figure className={s.block} aria-label={block.title ?? "Bar model"}>
      {block.title && <figcaption className={s.blockTitle}>{block.title}</figcaption>}
      <div className={s.bars}>
        {bars.map((b, i) => (
          <div key={i} className={s.barRow}>
            <span className={s.barLabel}>{b.label}</span>
            <div className={s.barTrack} style={{ width: `${(b.parts.reduce((t, p) => t + width(p.value), 0) / longest) * 100}%` }}>
              {b.parts.map((p, j) => (
                <span key={j} className={p.value.trim() === "?" ? `${s.part} ${s.unknown}` : s.part} style={{ flexGrow: width(p.value) }} data-alt={j % 2}>
                  <b>{p.value}</b>
                  <small>{p.label}</small>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {block.text && <p className={s.blockNote}>{block.text}</p>}
    </figure>
  );
}

function TryThis({ block }: { block: Block }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`${s.block} ${s.tryThis}`}>
      <h3 className={s.blockTitle}>{block.title ?? "Try this one"}</h3>
      <p className={s.blockText}>{block.question}</p>
      {open ? (
        <p className={s.answer}>{block.answer}</p>
      ) : (
        <button type="button" className="mk-btn mk-btn--secondary" onClick={() => setOpen(true)}>
          Show the answer
        </button>
      )}
    </section>
  );
}

/** The final answer (full stage only) comes right after the working, before the memory hook and try-this. */
export function ExplainBlocks({ blocks, finalAnswer = null }: { blocks: Block[]; finalAnswer?: string | null }) {
  const working = blocks.reduce((last, b, i) => (b.kind === "steps" || b.kind === "bar-model" || b.kind === "cer" ? i : last), 0);
  return (
    <div className={s.blocks}>
      {blocks.flatMap((b, i) => {
        const key = `${b.kind}-${i}`;
        const answer =
          finalAnswer && i === working ? (
            <p key="final" className={s.final}>
              <span>Answer</span>
              {finalAnswer}
            </p>
          ) : null;
        const block = (() => {
        switch (b.kind) {
          case "say":
            return (
              <p key={key} className={s.say}>
                {b.text}
              </p>
            );
          case "steps":
            return (
              <section key={key} className={s.block}>
                {b.title && <h3 className={s.blockTitle}>{b.title}</h3>}
                <ol className={s.steps}>
                  {(b.steps ?? []).map((step, j) => (
                    <li key={j} style={{ animationDelay: `${j * 120}ms` }}>
                      <span className={s.stepNum}>{j + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            );
          case "bar-model":
            return <BarModel key={key} block={b} />;
          case "cer":
            return (
              <section key={key} className={s.block} aria-label="Claim, evidence, reasoning">
                {b.title && <h3 className={s.blockTitle}>{b.title}</h3>}
                <dl className={s.cer}>
                  <div data-k="c">
                    <dt>Claim</dt>
                    <dd>{b.claim}</dd>
                  </div>
                  <div data-k="e">
                    <dt>Evidence</dt>
                    <dd>{b.evidence}</dd>
                  </div>
                  <div data-k="r">
                    <dt>Reasoning</dt>
                    <dd>{b.reasoning}</dd>
                  </div>
                </dl>
              </section>
            );
          case "memory-hook":
            return (
              <section key={key} className={`${s.block} ${s.hook}`}>
                <svg viewBox="0 0 24 24" aria-hidden="true" className={s.hookIcon}>
                  <path fill="currentColor" d={SPARK} />
                </svg>
                <div>
                  <span className={s.hookKind}>{b.hook ? HOOK_LABEL[b.hook] : "Remember it"}</span>
                  <p className={s.hookText}>{b.text}</p>
                </div>
              </section>
            );
          case "try-this":
            return <TryThis key={key} block={b} />;
          default:
            return null;
        }
        })();
        return answer ? [block, answer] : [block];
      })}
    </div>
  );
}
