// A small seeded PRNG (mulberry32) so every soak run is reproducible. Simulation only: the app's
// rewards and mastery never use randomness.
export interface Rng {
  next(): number;
  chance(p: number): boolean;
  int(lo: number, hi: number): number;
  pick<T>(xs: readonly T[]): T;
  fork(label: string): Rng;
}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function rng(seed: number | string): Rng {
  let a = typeof seed === "number" ? seed >>> 0 : hash(seed);
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const self: Rng = {
    next,
    chance: (p) => next() < p,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    fork: (label) => rng(hash(`${a}|${label}`)),
  };
  return self;
}
