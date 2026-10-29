// A question's text in the player, rendered from the items' small markup (lib/print/markup.ts) with trusted React:
// context sentences, real tables (never "| a | b |" pipes), lists and **bold**, and the item's figure placed
// before the question line. The question line itself is the page heading. `speakable` gives the same text for
// read-aloud, with table rows read as "egg: 2 weeks".
import type { ReactNode } from "react";
import { inline } from "@/components/papers/Rich";
import { parseBlocks, parseInline, plainText, splitParagraphs, type Inline, type TextBlock } from "@/lib/print/markup";

export interface StemFigure {
  src: string;
  /** Natural size in CSS pixels. */
  w: number;
  h: number;
  alt: string;
}

const flat = (nodes: Inline[]): string => nodes.map((n) => (n.t === "text" ? n.v : n.t === "b" || n.t === "u" ? flat(n.c) : n.t === "br" ? " " : "blank")).join("");

function Block({ block, ask }: { block: TextBlock; ask: boolean }) {
  if (block.t === "p") return ask ? <h1 className="qp-q-ask">{inline(block.c)}</h1> : <p className="qp-q-p">{inline(block.c)}</p>;
  if (block.t === "ul")
    return (
      <ul className="qp-q-list">
        {block.items.map((c, i) => (
          <li key={i}>{inline(c)}</li>
        ))}
      </ul>
    );
  return (
    <div className="qp-table-wrap">
      <table className="qp-table">
        {block.head.length ? (
          <thead>
            <tr>
              {block.head.map((c, i) => (
                <th key={i} scope="col">
                  {inline(c)}
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((c, i) => (i === 0 ? <th key={i} scope="row">{inline(c)}</th> : <td key={i}>{inline(c)}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A comprehension or cloze passage: every block as text (no heading), in its own scrolling box. */
export function PassageText({ text }: { text: string }) {
  const blocks = splitParagraphs(text).flatMap((p) => parseBlocks(p));
  return (
    <section className="qp-passage" aria-label="Read this first" tabIndex={0}>
      {blocks.map((b, i) => (
        <Block key={i} block={b} ask={false} />
      ))}
    </section>
  );
}

export function StemText({ text, figure }: { text: string; figure?: StemFigure | null }) {
  const blocks = splitParagraphs(text).flatMap((p) => parseBlocks(p));
  // The last paragraph is the question itself (the heading); a figure goes just before it when there is context.
  const askAt = blocks.map((b) => b.t).lastIndexOf("p");
  const out: ReactNode[] = blocks.map((b, i) => <Block key={i} block={b} ask={i === askAt} />);
  if (figure) {
    const fig = (
      <figure key="fig" className="qp-fig">
        {/* eslint-disable-next-line @next/next/no-img-element -- an inlined SVG figure from the skill pack */}
        <img src={figure.src} alt={figure.alt} style={{ width: `min(100%, ${Math.round(figure.w)}px)`, aspectRatio: `${figure.w} / ${figure.h}` }} />
      </figure>
    );
    out.splice(askAt > 0 ? askAt : out.length, 0, fig);
  }
  return <div className="qp-q">{out}</div>;
}

/** The question as plain sentences for the device's voice. */
export function speakable(text: string): string {
  return splitParagraphs(text)
    .flatMap((p) => parseBlocks(p))
    .map((b) => (b.t === "p" ? flat(b.c) : b.t === "ul" ? b.items.map(flat).join(". ") : b.rows.map((r) => r.map(flat).join(": ")).join(". ")))
    .map((s) => plainText(s).trim())
    .filter(Boolean)
    .join(". ");
}

/** Inline markup only (options, Kix's lines). */
export function InlineMarkup({ text }: { text: string | null | undefined }) {
  return text ? <>{inline(parseInline(text))}</> : null;
}
