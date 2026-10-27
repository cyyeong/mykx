// One typing round as a pure reducer: press a key, get the next state and what happened. Shared by every look
// (Star Typer's meteors, Word Garden's pots, Neon Strike's drone). Deterministic: no clock reads, no randomness.
//
// A round has a queue of targets (words or answers) and a few on screen at once. With no target locked, a key
// locks the first visible target that starts with it. A right key is a hit (the look fires); a wrong key is a
// miss (nothing fires, no penalty beyond accuracy). Finishing a target brings the next one from the queue.

export type TypingState = {
  queue: readonly string[];
  /** Indexes into `queue` of the targets on screen, by slot. null: an empty slot (queue ran out). */
  slots: (number | null)[];
  nextFromQueue: number;
  /** Locked slot, or null. */
  target: number | null;
  typed: number;
  hits: number;
  misses: number;
  /** Characters of finished targets plus the current partial (for words a minute). */
  correctChars: number;
  finished: number;
  startedAt: number | null;
  lastAt: number | null;
  /** Per expected key: hits, misses, and which wrong key was pressed instead (for "B and N swap"). */
  keys: Record<string, { hits: number; misses: number; instead: Record<string, number> }>;
};

export type PressResult =
  | { kind: "hit"; slot: number; done: boolean }
  | { kind: "miss"; expected: string | null }
  | { kind: "ignored" };

export function startRound(queue: readonly string[], visible = 1): TypingState {
  const words = queue.map((w) => w.toLowerCase());
  const n = Math.min(visible, words.length);
  return {
    queue: words,
    slots: Array.from({ length: Math.max(1, visible) }, (_, i) => (i < n ? i : null)),
    nextFromQueue: n,
    target: null,
    typed: 0,
    hits: 0,
    misses: 0,
    correctChars: 0,
    finished: 0,
    startedAt: null,
    lastAt: null,
    keys: {},
  };
}

export const roundOver = (s: TypingState) => s.finished >= s.queue.length;

export function wordIn(s: TypingState, slot: number): string | null {
  const i = s.slots[slot];
  return i === null || i === undefined ? null : s.queue[i];
}

/** The key the child should press next (for the ghost hands), or null when the round is over. */
export function expectedKey(s: TypingState): string | null {
  if (roundOver(s)) return null;
  if (s.target !== null) return wordIn(s, s.target)?.[s.typed] ?? null;
  const first = s.slots.findIndex((i) => i !== null);
  return first === -1 ? null : (wordIn(s, first)?.[0] ?? null);
}

function tally(keys: TypingState["keys"], expected: string, pressed: string, hit: boolean): TypingState["keys"] {
  const prev = keys[expected] ?? { hits: 0, misses: 0, instead: {} };
  const next = hit
    ? { ...prev, hits: prev.hits + 1 }
    : { ...prev, misses: prev.misses + 1, instead: { ...prev.instead, [pressed]: (prev.instead[pressed] ?? 0) + 1 } };
  return { ...keys, [expected]: next };
}

export function press(s: TypingState, rawKey: string, now: number): { state: TypingState; result: PressResult } {
  const key = rawKey.toLowerCase();
  if (key.length !== 1 || roundOver(s)) return { state: s, result: { kind: "ignored" } };
  const timed = { startedAt: s.startedAt ?? now, lastAt: now };

  let target = s.target;
  if (target === null) {
    const found = s.slots.findIndex((i, slot) => i !== null && wordIn(s, slot)?.[0] === key);
    if (found === -1) {
      const expected = expectedKey(s);
      return {
        state: { ...s, ...timed, misses: s.misses + 1, keys: expected ? tally(s.keys, expected, key, false) : s.keys },
        result: { kind: "miss", expected },
      };
    }
    target = found;
  }
  const word = wordIn(s, target) ?? "";
  const typedSoFar = s.target === null ? 0 : s.typed;
  const expected = word[typedSoFar];
  if (key !== expected) {
    return {
      state: { ...s, ...timed, misses: s.misses + 1, keys: tally(s.keys, expected, key, false) },
      result: { kind: "miss", expected },
    };
  }
  const typed = typedSoFar + 1;
  const base = { ...s, ...timed, hits: s.hits + 1, correctChars: s.correctChars + 1, keys: tally(s.keys, expected, key, true) };
  if (typed < word.length) return { state: { ...base, target, typed }, result: { kind: "hit", slot: target, done: false } };

  const slots = s.slots.slice();
  slots[target] = s.nextFromQueue < s.queue.length ? s.nextFromQueue : null;
  return {
    state: { ...base, slots, nextFromQueue: Math.min(s.nextFromQueue + 1, s.queue.length), target: null, typed: 0, finished: s.finished + 1 },
    result: { kind: "hit", slot: target, done: true },
  };
}
