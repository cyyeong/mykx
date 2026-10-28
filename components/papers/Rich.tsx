// Trusted rendering of item text (lib/print/markup.ts): no HTML from content ever reaches the page.
import type { ReactNode } from "react";
import { parseBlocks, parseInline, plainText, splitParagraphs, type Inline, type TextBlock } from "@/lib/print/markup";
import type { PrintFigure } from "@/lib/print/bank";

/** Inline markup as trusted React (bold, underline, line breaks, answer blanks). */
export function inline(nodes: Inline[], key = ""): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}${i}`;
    switch (n.t) {
      case "text":
        return n.v;
      case "b":
        return <strong key={k}>{inline(n.c, k)}</strong>;
      case "u":
        return <u key={k}>{inline(n.c, k)}</u>;
      case "br":
        return <br key={k} />;
      case "blank":
        return (
          <span key={k} className="pp-blank">
            {n.label ? <span className="pp-blank-n">{n.label}</span> : null}
          </span>
        );
    }
  });
}

export function InlineText({ text }: { text: string }) {
  return <>{inline(parseInline(text))}</>;
}

function Block({ block, className }: { block: TextBlock; className?: string }) {
  if (block.t === "p") return <p className={className}>{inline(block.c)}</p>;
  if (block.t === "ul")
    return (
      <ul>
        {block.items.map((c, i) => (
          <li key={i}>{inline(c)}</li>
        ))}
      </ul>
    );
  return (
    <table className="pp-table">
      {block.head.length ? (
        <thead>
          <tr>
            {block.head.map((c, i) => (
              <th key={i}>{inline(c)}</th>
            ))}
          </tr>
        </thead>
      ) : null}
      <tbody>
        {block.rows.map((row, r) => (
          <tr key={r}>
            {row.map((c, i) => (
              <td key={i}>{inline(c)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Text with an optional figure placed before paragraph `figureAt` (or after the text). */
export function RichText({ text, figure, figureAt = Infinity }: { text: string; figure?: ReactNode; figureAt?: number }) {
  const paragraphs = splitParagraphs(text);
  const at = Math.min(figureAt, paragraphs.length);
  const parts = paragraphs.map((p, i) => (
    <div key={i} className="pp-para">
      {parseBlocks(p).map((b, j) => (
        <Block key={j} block={b} />
      ))}
    </div>
  ));
  if (figure) parts.splice(at, 0, <div key="fig">{figure}</div>);
  return <div className="pp-text">{parts}</div>;
}

const inlineLength = (nodes: Inline[]): number =>
  nodes.reduce((n, x) => n + (x.t === "text" ? plainText(x.v).trim().length : x.t === "b" || x.t === "u" ? inlineLength(x.c) : 1), 0);

/** A reading passage: each line is a paragraph. Short lines (a note's greeting, signature, date) are not indented. */
export function Passage({ text }: { text: string }) {
  return (
    <div className="pp-passage">
      {parseBlocks(text, { linesAsParagraphs: true }).map((b, i) => (
        <Block key={i} block={b} className={b.t === "p" && inlineLength(b.c) <= 12 ? "pp-p-short" : undefined} />
      ))}
    </div>
  );
}

const LIMITS = {
  /** Diagrams and graphs: natural size, within the text column and a third of the page. */
  figure: { w: 165, h: 105 },
  /** A picture prompt in a language paper (看图选词): small, beside the words. */
  picture: { w: 70, h: 42 },
  /** A visual-text poster may take most of a page. */
  poster: { w: 125, h: 230 },
};

export type FigKind = keyof typeof LIMITS;

/** Size in mm: icons drawn small, everything else at natural size within the limits, never upscaled. */
export function fitFigure(fig: PrintFigure, kind: FigKind): { w: number; h: number } {
  if (fig.icon) {
    const w = 30;
    return { w, h: (fig.heightMm / fig.widthMm) * w };
  }
  const { w: maxW, h: maxH } = LIMITS[kind];
  const scale = Math.min(1, maxW / fig.widthMm, maxH / fig.heightMm);
  return { w: fig.widthMm * scale, h: fig.heightMm * scale };
}

export function Figure({ fig, kind = "figure", alt }: { fig: PrintFigure | undefined; kind?: FigKind; alt: string }) {
  if (!fig) return null;
  const { w, h } = fitFigure(fig, kind);
  return (
    <figure className={`pp-fig pp-fig--${kind}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- an inlined data URI drawn at a fixed print size */}
      <img src={fig.src} alt={alt} style={{ width: `${w.toFixed(1)}mm`, height: `${h.toFixed(1)}mm` }} />
    </figure>
  );
}
