// Touch-typing finger map for the ghost hands: which finger owns each key, its number, where it rests, and where a key sits
// on the on-screen keyboard (in key units; the board is 11 units wide, rows are offset like a real keyboard).

export type Finger = "lp" | "lr" | "lm" | "li" | "ri" | "rm" | "rr" | "rp" | "th";

export const ROWS = ["qwertyuiop", "asdfghjkl;", "zxcvbnm,./"] as const;
export const ROW_OFFSET = [0, 0.25, 0.75] as const;

export const FINGER_OF: Readonly<Record<string, Finger>> = {
  q: "lp", a: "lp", z: "lp",
  w: "lr", s: "lr", x: "lr",
  e: "lm", d: "lm", c: "lm",
  r: "li", f: "li", v: "li", t: "li", g: "li", b: "li",
  y: "ri", h: "ri", n: "ri", u: "ri", j: "ri", m: "ri",
  i: "rm", k: "rm", ",": "rm",
  o: "rr", l: "rr", ".": "rr",
  p: "rp", ";": "rp", "/": "rp",
  " ": "th",
};

/** Where each finger rests (the home row). */
export const HOME_KEY: Readonly<Record<Exclude<Finger, "th">, string>> = { lp: "a", lr: "s", lm: "d", li: "f", ri: "j", rm: "k", rr: "l", rp: ";" };

/**
 * Finger numbers, 1–10 left to right as a child counts with both hands flat (thumbs 5 and 6). The ghost hands
 * show them on the fingertips and each key shows its finger's number softly in the corner.
 */
export const FINGER_NUMBERS: Readonly<Record<Finger, readonly number[]>> = {
  lp: [1], lr: [2], lm: [3], li: [4], th: [5, 6], ri: [7], rm: [8], rr: [9], rp: [10],
};

export const FINGER_NAME: Readonly<Record<Finger, string>> = {
  lp: "Left pinky", lr: "Left ring", lm: "Left middle", li: "Left pointer",
  ri: "Right pointer", rm: "Right middle", rr: "Right ring", rp: "Right pinky", th: "Thumb",
};

/** Centre of a key in key units, or null for keys the board doesn't show. */
export function keyCentre(key: string): { x: number; y: number } | null {
  const k = key.toLowerCase();
  if (k === " ") return { x: 5.75, y: 3.5 };
  for (let r = 0; r < ROWS.length; r++) {
    const c = ROWS[r].indexOf(k);
    if (c > -1) return { x: ROW_OFFSET[r] + c + 0.5, y: r + 0.5 };
  }
  return null;
}

/** The ghost-hand cue for the next key: which finger, how far it reaches from home, and a caption. */
export function cueFor(key: string): { finger: Finger; numbers: readonly number[]; reach: { dx: number; dy: number }; caption: string } | null {
  const k = key.toLowerCase();
  const finger = FINGER_OF[k];
  if (!finger) return null;
  const target = keyCentre(k);
  const home = finger === "th" ? target : keyCentre(HOME_KEY[finger]);
  if (!target || !home) return null;
  return {
    finger,
    numbers: FINGER_NUMBERS[finger],
    reach: { dx: target.x - home.x, dy: target.y - home.y },
    caption: `${FINGER_NAME[finger]} → ${k === " " ? "space" : k.toUpperCase()}`,
  };
}
