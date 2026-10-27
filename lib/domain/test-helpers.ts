// Builders for domain tests (synthetic data only).
import type { AttemptEvent } from "./attempts.ts";

let n = 0;

/** An attempt with sensible defaults: a confirmed, unassisted first try worth 2 marks. */
export function attempt(p: Partial<AttemptEvent> & { at: string }): AttemptEvent {
  n += 1;
  const itemId = p.itemId ?? `item-${n}`;
  return {
    id: p.id ?? `a${String(n).padStart(5, "0")}`,
    itemId,
    family: p.family ?? itemId,
    skill: "p3-science",
    topic: "cycles.animal",
    subskill: "stage_features",
    marks: 2,
    maxMarks: 2,
    firstTry: true,
    hintsBeforeSubmit: 0,
    revealed: false,
    confirmed: true,
    ...p,
  };
}
