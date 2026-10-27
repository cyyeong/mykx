import type { HTMLAttributes, ReactNode } from "react";
import s from "./KixBubble.module.css";

type KixBubbleProps = HTMLAttributes<HTMLDivElement> & {
  /** "start": the top-left corner is pinched toward Kix, for a bubble beside Kix's avatar. */
  tail?: "start";
  /** The pack's raised shadow (a bubble floating over the scene). */
  raised?: boolean;
  /** A 3 px control outline plus the raised shadow (clay packs, the question player). */
  outlined?: boolean;
  /** A small label above Kix's line, such as "Hint 1 of 2". */
  chip?: ReactNode;
};

/**
 * What Kix says, in a speech bubble. Type size and padding come from the screen (className or
 * style); the line inherits them. The hold-to-talk mic and read-aloud captions attach here later.
 */
export function KixBubble({ tail, raised, outlined, chip, className, children, ...rest }: KixBubbleProps) {
  const cls = [s.bubble, tail === "start" && s.tailStart, raised && s.raised, outlined && s.outlined, className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {chip ? <span className={s.chip}>{chip}</span> : null}
      <p className={s.line}>{children}</p>
    </div>
  );
}
