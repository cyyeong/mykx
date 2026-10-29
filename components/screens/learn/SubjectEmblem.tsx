// A subject's emblem on the Learn pages: a round badge with the subject's mark. English and Chinese are written
// marks ("Aa", 字); Maths and Science are drawn (operators, a flask). Decorative: the subject's name is beside it.
import type { CSSProperties } from "react";

const DRAWN: Record<string, string> = {
  maths: "M7 3.5v7M3.5 7h7M13.5 7h7M14.5 14.5l5 5M19.5 14.5l-5 5M3.5 17h7M7 14h.01M7 20h.01",
  science: "M9 3h6M10 3v6.2L4.6 18.4A1.8 1.8 0 0 0 6.2 21h11.6a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3M7.2 14.5h9.6",
};

const WRITTEN: Record<string, { text: string; lang?: string }> = {
  english: { text: "Aa" },
  chinese: { text: "字", lang: "zh-Hans" },
};

export function SubjectEmblem({ subject, size = 64, className, style }: { subject: string; size?: number; className?: string; style?: CSSProperties }) {
  const written = WRITTEN[subject];
  const drawn = DRAWN[subject];
  return (
    <span aria-hidden="true" className={["ln-emblem", className].filter(Boolean).join(" ")} style={{ width: size, height: size, ...style }}>
      {written ? (
        <span lang={written.lang} style={{ fontSize: size * (written.lang ? 0.5 : 0.42) }}>
          {written.text}
        </span>
      ) : (
        <svg viewBox="0 0 24 24" style={{ width: size * 0.5, height: size * 0.5 }}>
          <path d={drawn ?? DRAWN.science} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}
