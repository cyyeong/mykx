import type { CSSProperties } from "react";

export type QuestNodeState = "mastered" | "current" | "next" | "locked";

const ICONS: Record<Exclude<QuestNodeState, "current">, string> = {
  mastered: "M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z",
  next: "M8 5v14l11-7z",
  locked: "M7 10V8a5 5 0 0 1 10 0v2h1v11H6V10zm2 0h6V8a3 3 0 0 0-6 0z",
};

/**
 * A stop on the Junior quest path (`mk-node`, app/styles/components.css), with mastery shown honestly:
 * mastered glows, current is a ring filled to the mastery index with the number inside (a play glyph
 * while there's no evidence yet: never a "0" for a stop not tried), next pulses (not under reduced
 * motion), locked is muted. The subskill's name sits beside it on the map.
 */
export function QuestNode({ state, mastery, className }: { state: QuestNodeState; mastery?: number | null; className?: string }) {
  const shown = state === "current" && mastery !== null && mastery !== undefined;
  return (
    <div
      className={["mk-node", `mk-node--${state}`, className].filter(Boolean).join(" ")}
      style={state === "current" ? ({ "--mastery": mastery ?? 0 } as CSSProperties) : undefined}
    >
      <span className="mk-node__dot">
        {shown ? (
          <span>{mastery}</span>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d={ICONS[state === "current" ? "next" : state]} />
          </svg>
        )}
      </span>
    </div>
  );
}
