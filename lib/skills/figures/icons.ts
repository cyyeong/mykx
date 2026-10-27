// Schematic icons for question figures: clean line drawings that show the features a
// question tests (body parts, legs, feelers, stages), not realistic art. Each icon draws
// in its own small box and is scaled by the caller.
import {
  ACCENT,
  DARK_SHADE,
  INK,
  PAPER,
  SHADE,
  TINT,
  circle,
  el,
  ellipse,
  fmt,
  line,
  num,
  path,
  pd,
  poly,
  rect,
  text,
  type Attrs,
  type Drawing,
  type Spec,
} from "./svg.ts";

export interface IconTheme {
  main: string;
  tint: string;
}
type IconFn = (params: Spec, theme: IconTheme) => Drawing;

const OUT: Attrs = { fill: PAPER, stroke: INK, "stroke-width": 1.8 };
const LINE: Attrs = { fill: "none", stroke: INK, "stroke-width": 1.8 };
const THIN: Attrs = { fill: "none", stroke: INK, "stroke-width": 1.3 };

const rot = (deg: number, cx: number, cy: number) => `rotate(${fmt(deg)} ${fmt(cx)} ${fmt(cy)})`;

/** Jointed legs radiating from a body side: base → knee → foot. */
function legs(cx: number, ys: number[], halfW: number, angles: number[], l1: number, l2: number, w = 1.6): string {
  let out = "";
  ys.forEach((y, i) => {
    const a = (angles[i] * Math.PI) / 180;
    for (const side of [1, -1]) {
      const bx = cx + side * halfW;
      const kx = bx + side * Math.cos(a - 0.45) * l1;
      const ky = y + Math.sin(a - 0.45) * l1;
      const fx = kx + side * Math.cos(a + 0.5) * l2;
      const fy = ky + Math.sin(a + 0.5) * l2;
      out += path(pd("M", bx, y, "L", kx, ky, "L", fx, fy), { fill: "none", stroke: INK, "stroke-width": w });
    }
  });
  return out;
}

const spreadAngles = (n: number, from: number, to: number) =>
  Array.from({ length: n }, (_, i) => (n === 1 ? (from + to) / 2 : from + ((to - from) * i) / (n - 1)));

const feelers = (cx: number, y: number, spread = 14, rise = 13) =>
  path(pd("M", cx - 2, y, "Q", cx - spread * 0.4, y - rise * 0.8, cx - spread, y - rise), THIN) +
  path(pd("M", cx + 2, y, "Q", cx + spread * 0.4, y - rise * 0.8, cx + spread, y - rise), THIN);

/** Leaf: a pointed oval from (x, y) along `deg`. */
function leaf(x: number, y: number, len: number, deg: number, wid: number, a: Attrs = OUT): string {
  const r = (deg * Math.PI) / 180;
  const tx = x + Math.cos(r) * len;
  const ty = y + Math.sin(r) * len;
  const mx = (x + tx) / 2;
  const my = (y + ty) / 2;
  const nx = -Math.sin(r) * wid;
  const ny = Math.cos(r) * wid;
  return (
    path(pd("M", x, y, "Q", mx + nx, my + ny, tx, ty, "Q", mx - nx, my - ny, x, y, "Z"), a) +
    line(x, y, mx + (tx - mx) * 0.6, my + (ty - my) * 0.6, { stroke: INK, "stroke-width": 0.9 })
  );
}

function drop(cx: number, cy: number, r: number, deg: number, a: Attrs): string {
  return path(
    pd("M", cx, cy - 1.9 * r, "C", cx + 0.35 * r, cy - 1.2 * r, cx + r, cy - 0.7 * r, cx + r, cy, "A", r, r, 0, 0, 1, cx - r, cy, "C", cx - r, cy - 0.7 * r, cx - 0.35 * r, cy - 1.2 * r, cx, cy - 1.9 * r, "Z"),
    { ...a, transform: rot(deg, cx, cy) },
  );
}

const water = (w: number, y: number, h: number) =>
  rect(0, y, w, h, { fill: TINT, stroke: "none" }) + line(0, y, w, y, { stroke: ACCENT, "stroke-width": 1.6 });

// ─── Invertebrates ────────────────────────────────────────────────────────────────────────
const spider: IconFn = () => ({
  w: 120,
  h: 112,
  body:
    legs(60, [39, 43, 47, 51], 9, [-60, -22, 18, 52], 26, 24) +
    ellipse(60, 79, 19, 23, OUT) +
    ellipse(60, 45, 12, 11, OUT) +
    circle(56, 39, 1.5, { fill: INK }) +
    circle(64, 39, 1.5, { fill: INK }),
  alt: "an animal with 2 body parts and 8 legs, and no feelers",
});

const insect: IconFn = (p) => {
  const n = Math.max(2, Math.round(num(p.legs, 6) / 2));
  const ys = spreadAngles(n, 32, 44);
  return {
    w: 110,
    h: 92,
    body:
      feelers(55, 15, 15, 12) +
      legs(55, ys, 8, spreadAngles(n, -50, 50), 22, 22) +
      ellipse(55, 67, 12, 20, OUT) +
      ellipse(55, 38, 9, 10, OUT) +
      circle(55, 21, 7, OUT),
    alt: `an animal with 3 body parts, ${n * 2} legs and 2 feelers`,
  };
};

const beetle: IconFn = () => ({
  w: 110,
  h: 92,
  body:
    feelers(55, 16, 15, 12) +
    legs(55, [34, 42, 50], 13, [-48, 5, 52], 20, 20) +
    ellipse(55, 63, 19, 23, OUT) +
    line(55, 41, 55, 85, { stroke: INK, "stroke-width": 1.4 }) +
    ellipse(55, 33, 12, 8, OUT) +
    circle(55, 21, 6.5, OUT),
  alt: "an animal with 3 body parts, 6 legs, 2 feelers and hard wing covers",
});

const centipede: IconFn = () => {
  const n = 12;
  let segs = "";
  let legsOut = "";
  const pt = (t: number): [number, number] => [12 + 86 * t, 76 - 56 * t + 7 * Math.sin(t * Math.PI * 2)];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / (n + 1);
    const [x, y] = pt(t);
    const [x2, y2] = pt(t + 0.01);
    const ang = Math.atan2(y2 - y, x2 - x);
    const deg = (ang * 180) / Math.PI;
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    legsOut += line(x + nx * 4, y + ny * 4, x + nx * 11 - Math.cos(ang) * 2, y + ny * 11 - Math.sin(ang) * 2, THIN);
    legsOut += line(x - nx * 4, y - ny * 4, x - nx * 11 - Math.cos(ang) * 2, y - ny * 11 - Math.sin(ang) * 2, THIN);
    segs += el("ellipse", { cx: x, cy: y, rx: 4.6, ry: 4, transform: rot(deg, x, y), ...OUT, "stroke-width": 1.3 });
  }
  const [hx, hy] = pt((n + 0.6) / (n + 1));
  return {
    w: 110,
    h: 92,
    body:
      legsOut +
      segs +
      path(pd("M", hx, hy, "Q", hx + 2, hy - 10, hx + 8, hy - 14), THIN) +
      path(pd("M", hx, hy, "Q", hx + 8, hy - 4, hx + 14, hy - 4), THIN) +
      circle(hx, hy, 4.2, OUT),
    alt: "a long animal with many body segments and a pair of legs on each segment",
  };
};

const grasshopper: IconFn = () => ({
  w: 80,
  h: 44,
  body:
    path(pd("M", 64, 12, "Q", 70, 4, 78, 1), THIN) +
    line(55, 27, 59, 38, LINE) +
    line(50, 28, 47, 38, LINE) +
    ellipse(31, 25, 23, 7, OUT) +
    path(pd("M", 52, 18, "Q", 30, 15, 10, 23), THIN) +
    ellipse(53, 22, 8, 8, OUT) +
    ellipse(63, 20, 6.5, 8, OUT) +
    circle(65, 17, 1.7, { fill: INK }) +
    path(pd("M", 47, 24, "L", 30, 9, "L", 17, 38), { fill: "none", stroke: INK, "stroke-width": 2.4 }),
  alt: "a grasshopper",
});

// ─── Frog stages ──────────────────────────────────────────────────────────────────────────
const frog: IconFn = () => ({
  w: 80,
  h: 64,
  body:
    el("ellipse", { cx: 37, cy: 38, rx: 24, ry: 15, transform: rot(-18, 37, 38), ...OUT }) +
    path(pd("M", 24, 44, "C", 10, 46, 10, 58, 24, 57, "L", 44, 57), LINE) +
    ellipse(25, 47, 11, 7, OUT) +
    path(pd("M", 54, 40, "L", 58, 55, "L", 64, 56), LINE) +
    ellipse(58, 28, 14, 10, OUT) +
    circle(58, 19, 5, OUT) +
    circle(59, 18.5, 2, { fill: INK }) +
    path(pd("M", 52, 32, "Q", 62, 35, 71, 29), THIN),
  alt: "an adult frog",
});

const tadpole: IconFn = () => ({
  w: 80,
  h: 64,
  body:
    path(pd("M", 40, 28, "C", 52, 20, 62, 38, 77, 30, "C", 62, 37, 52, 44, 40, 37, "Z"), OUT) +
    ellipse(28, 32, 15, 11, OUT) +
    circle(34, 29, 2, { fill: INK }),
  alt: "a tadpole with a round head and a long tail",
});

const frogspawn: IconFn = () => {
  const pts: [number, number][] = [
    [27, 14], [41, 13], [55, 15],
    [20, 27], [34, 26], [48, 27], [62, 28],
    [20, 41], [34, 40], [48, 41], [62, 41],
    [30, 53], [44, 53], [57, 52],
  ];
  return {
    w: 80,
    h: 64,
    body: pts.map(([x, y]) => circle(x, y, 7, { ...OUT, "stroke-width": 1.3 }) + circle(x, y, 2.4, { fill: INK })).join(""),
    alt: "a cluster of round eggs, each with a dark dot",
  };
};

// ─── Mosquito stages ──────────────────────────────────────────────────────────────────────
const mosquitoEggs: IconFn = () => {
  let eggs = "";
  for (let i = 0; i < 7; i++) eggs += ellipse(22 + i * 6, 31, 1.9, 5.5, { fill: INK });
  return { w: 80, h: 56, body: water(80, 33, 23) + eggs, alt: "a raft of tiny eggs floating on water" };
};

const mosquitoLarva: IconFn = () => {
  let segs = "";
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const x = 50 - 22 * t;
    const y = 18 + 26 * t;
    segs += el("ellipse", { cx: x, cy: y, rx: 3.6, ry: 4.6, transform: rot(-40, x, y), ...OUT, "stroke-width": 1.2 });
    if (i % 2 === 1) segs += line(x - 4, y, x - 9, y - 2, THIN) + line(x + 4, y, x + 9, y + 2, THIN);
  }
  return {
    w: 80,
    h: 56,
    body: water(80, 10, 46) + line(52, 15, 55, 10, { stroke: INK, "stroke-width": 2.6 }) + segs + ellipse(25, 48, 5.5, 4.5, OUT),
    alt: "a thin wriggling larva hanging below the water surface",
  };
};

const mosquitoPupa: IconFn = () => ({
  w: 80,
  h: 56,
  body:
    water(80, 10, 46) +
    line(36, 18, 34, 10, { stroke: INK, "stroke-width": 1.8 }) +
    line(43, 18, 45, 10, { stroke: INK, "stroke-width": 1.8 }) +
    path(pd("M", 33, 33, "C", 30, 46, 44, 54, 54, 46), { fill: "none", stroke: INK, "stroke-width": 6.5, "stroke-linecap": "round" }) +
    path(pd("M", 33, 33, "C", 30, 46, 44, 54, 54, 46), { fill: "none", stroke: PAPER, "stroke-width": 3.2, "stroke-linecap": "round" }) +
    circle(40, 27, 11, OUT) +
    circle(44, 25, 1.8, { fill: INK }),
  alt: "a comma-shaped pupa just below the water surface",
});

const mosquito: IconFn = () => ({
  w: 90,
  h: 72,
  body:
    legs(45, [27, 30, 33], 4, [-55, 5, 55], 22, 22, 1.1) +
    el("ellipse", { cx: 34, cy: 42, rx: 4.5, ry: 16, transform: rot(28, 34, 42), fill: PAPER, "fill-opacity": 0.85, stroke: INK, "stroke-width": 1.1 }) +
    el("ellipse", { cx: 56, cy: 42, rx: 4.5, ry: 16, transform: rot(-28, 56, 42), fill: PAPER, "fill-opacity": 0.85, stroke: INK, "stroke-width": 1.1 }) +
    ellipse(45, 50, 3.6, 15, OUT) +
    ellipse(45, 30, 5.5, 6.5, OUT) +
    line(45, 17, 45, 3, { stroke: INK, "stroke-width": 1.3 }) +
    line(43, 18, 37, 9, THIN) +
    line(47, 18, 53, 9, THIN) +
    circle(45, 20, 4, OUT),
  alt: "an adult mosquito with 2 wings, 6 long legs and a long mouthpart",
});

// ─── Plants and fungi ─────────────────────────────────────────────────────────────────────
const fern: IconFn = () => {
  const fronds: [number, number, number, number][] = [
    [22, 52, 12, 16],
    [44, 38, 46, 5],
    [70, 52, 80, 18],
  ];
  let out = "";
  for (const [cx, cy, tx, ty] of fronds) {
    out += path(pd("M", 45, 76, "Q", cx, cy, tx, ty), LINE);
    for (let i = 2; i < 10; i++) {
      const t = i / 10;
      const x = (1 - t) ** 2 * 45 + 2 * (1 - t) * t * cx + t * t * tx;
      const y = (1 - t) ** 2 * 76 + 2 * (1 - t) * t * cy + t * t * ty;
      const dx = 2 * (1 - t) * (cx - 45) + 2 * t * (tx - cx);
      const dy = 2 * (1 - t) * (cy - 76) + 2 * t * (ty - cy);
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const len = 11 - 7 * t;
      out += leaf(x, y, len, deg - 70, 2.4, { ...OUT, "stroke-width": 1.1 }) + leaf(x, y, len, deg + 70, 2.4, { ...OUT, "stroke-width": 1.1 });
    }
  }
  out += path(pd("M", 52, 76, "Q", 60, 60, 63, 64, "Q", 66, 69, 60, 68), THIN);
  return { w: 90, h: 80, body: line(10, 77, 80, 77, { stroke: INK, "stroke-width": 1.6 }) + out, alt: "a plant with feathery fronds made of many small leaflets" };
};

const fruitingPlant: IconFn = () => ({
  w: 90,
  h: 80,
  body:
    line(10, 77, 80, 77, { stroke: INK, "stroke-width": 1.6 }) +
    path(pd("M", 45, 77, "Q", 43, 44, 46, 10), LINE) +
    path(pd("M", 44, 52, "Q", 34, 44, 24, 38), LINE) +
    path(pd("M", 45, 38, "Q", 56, 32, 66, 25), LINE) +
    leaf(44, 62, 18, 200, 5) +
    leaf(45, 56, 17, -20, 5) +
    leaf(46, 28, 15, 210, 4.5) +
    leaf(46, 16, 13, -40, 4) +
    leaf(30, 42, 12, 240, 3.6) +
    leaf(60, 29, 12, -70, 3.6) +
    line(24, 38, 24, 44, THIN) +
    circle(24, 50, 6.5, { ...OUT, fill: SHADE }) +
    line(66, 25, 67, 31, THIN) +
    circle(67, 37, 6.5, { ...OUT, fill: SHADE }) +
    line(45, 46, 52, 50, THIN) +
    circle(55, 55, 6, { ...OUT, fill: SHADE }),
  alt: "a plant with leaves and round fruits",
});

const mushroom: IconFn = () => ({
  w: 90,
  h: 80,
  body:
    line(8, 75, 84, 75, { stroke: INK, "stroke-width": 1.6 }) +
    rect(32, 38, 13, 37, { rx: 4, ...OUT }) +
    path(pd("M", 12, 40, "Q", 38, 0, 65, 40, "Z"), OUT) +
    [18, 26, 34, 42, 50, 58].map((x) => line(x, 40, x + 1, 44, THIN)).join("") +
    rect(67, 56, 7, 19, { rx: 3, ...OUT }) +
    path(pd("M", 57, 57, "Q", 70, 36, 84, 57, "Z"), OUT),
  alt: "mushrooms, each with a cap on a stalk",
});

const seed: IconFn = () => ({
  w: 70,
  h: 50,
  body:
    path(pd("M", 10, 27, "C", 8, 12, 28, 6, 42, 9, "C", 58, 12, 64, 28, 54, 38, "C", 47, 44, 41, 37, 34, 37, "C", 26, 37, 13, 45, 10, 27, "Z"), { ...OUT, fill: SHADE }) +
    ellipse(37, 34, 5, 1.8, { fill: INK }),
  alt: "a bean seed",
});

const youngPlant: IconFn = () => ({
  w: 80,
  h: 72,
  body:
    line(6, 50, 74, 50, { stroke: INK, "stroke-width": 1.6 }) +
    path(pd("M", 40, 50, "L", 40, 68, "M", 40, 56, "L", 33, 64, "M", 40, 59, "L", 47, 67), THIN) +
    path(pd("M", 40, 50, "Q", 39, 32, 40, 16), LINE) +
    leaf(40, 34, 20, 200, 6) +
    leaf(40, 34, 20, -20, 6) +
    leaf(40, 18, 12, 240, 4) +
    leaf(40, 18, 12, -60, 4),
  alt: "a young plant with a few leaves, a short stem and roots",
});

// ─── Things (Chinese picture questions, posters) ──────────────────────────────────────────
const alarmClock: IconFn = (p) => {
  const [hh, mm] = (typeof p.time === "string" ? p.time : "7:00").split(":").map(Number);
  const hourA = (((hh % 12) + (mm || 0) / 60) * 30 * Math.PI) / 180;
  const minA = ((mm || 0) * 6 * Math.PI) / 180;
  let ticks = "";
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 * Math.PI) / 180;
    const r1 = i % 3 === 0 ? 24 : 27;
    ticks += line(50 + Math.sin(a) * r1, 56 - Math.cos(a) * r1, 50 + Math.sin(a) * 30, 56 - Math.cos(a) * 30, { stroke: INK, "stroke-width": i % 3 === 0 ? 2.4 : 1.4 });
  }
  const bell = (cx: number, deg: number) => path(pd("M", cx - 13, 22, "Q", cx, 2, cx + 13, 22, "Z"), { ...OUT, "stroke-width": 2.4, fill: SHADE, transform: rot(deg, cx, 22) });
  const ring = (x: number, sgn: number) =>
    [0, 1, 2].map((i) => line(x + sgn * 4, 10 + i * 9, x + sgn * 11, 6 + i * 11, { stroke: INK, "stroke-width": 1.6 })).join("");
  return {
    w: 100,
    h: 100,
    body:
      bell(25, -28) +
      bell(75, 28) +
      line(50, 24, 50, 14, { stroke: INK, "stroke-width": 2.4 }) +
      circle(50, 12, 3.5, { fill: INK }) +
      ring(8, -1) +
      ring(92, 1) +
      line(32, 84, 24, 95, { stroke: INK, "stroke-width": 3 }) +
      line(68, 84, 76, 95, { stroke: INK, "stroke-width": 3 }) +
      circle(50, 56, 34, { ...OUT, "stroke-width": 3 }) +
      ticks +
      line(50, 56, 50 + Math.sin(hourA) * 16, 56 - Math.cos(hourA) * 16, { stroke: INK, "stroke-width": 3.4 }) +
      line(50, 56, 50 + Math.sin(minA) * 24, 56 - Math.cos(minA) * 24, { stroke: INK, "stroke-width": 2.2 }) +
      circle(50, 56, 2.6, { fill: INK }),
    alt: `an alarm clock with two bells, ringing, showing ${hh}:${String(mm || 0).padStart(2, "0")}`,
  };
};

const elephant: IconFn = () => ({
  w: 100,
  h: 80,
  body:
    line(11, 34, 6, 46, { stroke: INK, "stroke-width": 2 }) +
    rect(29, 50, 10, 24, { rx: 3, ...OUT, fill: DARK_SHADE }) +
    rect(49, 50, 10, 24, { rx: 3, ...OUT, fill: DARK_SHADE }) +
    ellipse(40, 38, 30, 22, { ...OUT, fill: SHADE }) +
    rect(16, 50, 11, 26, { rx: 3, ...OUT, fill: SHADE }) +
    rect(58, 50, 11, 26, { rx: 3, ...OUT, fill: SHADE }) +
    path(pd("M", 80, 28, "C", 92, 34, 92, 54, 93, 66, "C", 94, 73, 98, 73, 98, 68), { fill: "none", stroke: INK, "stroke-width": 11, "stroke-linecap": "round" }) +
    path(pd("M", 80, 28, "C", 92, 34, 92, 54, 93, 66, "C", 94, 73, 98, 73, 98, 68), { fill: "none", stroke: SHADE, "stroke-width": 7.4, "stroke-linecap": "round" }) +
    circle(70, 28, 16, { ...OUT, fill: SHADE }) +
    ellipse(63, 30, 9, 13, { ...OUT, fill: DARK_SHADE }) +
    circle(76, 23, 1.9, { fill: INK }) +
    path(pd("M", 80, 37, "Q", 85, 43, 90, 42), { fill: "none", stroke: INK, "stroke-width": 1.4 }) +
    [[-30, 9], [0, 10], [30, 9]].map(([deg, len]) => {
      const a = ((deg + 40) * Math.PI) / 180;
      return line(101 + Math.cos(a) * 5, 72 + Math.sin(a) * 5, 101 + Math.cos(a) * (5 + len), 72 + Math.sin(a) * (5 + len), { stroke: ACCENT, "stroke-width": 1.8 });
    }).join(""),
  alt: "an elephant with water coming out of the end of its trunk",
});

const waterDrops: IconFn = () => {
  const a: Attrs = { fill: TINT, stroke: ACCENT, "stroke-width": 2 };
  return { w: 100, h: 100, body: drop(28, 34, 10, -40, a) + drop(66, 44, 13, -40, a) + drop(38, 74, 10, -40, a) + drop(78, 82, 8, -40, a), alt: "drops of water" };
};

const recycle: IconFn = () => {
  let out = "";
  for (let i = 0; i < 3; i++) {
    const a0 = ((i * 120 - 80) * Math.PI) / 180;
    const a1 = ((i * 120 + 10) * Math.PI) / 180;
    const r = 34;
    const x0 = 50 + Math.cos(a0) * r;
    const y0 = 50 + Math.sin(a0) * r;
    const x1 = 50 + Math.cos(a1) * r;
    const y1 = 50 + Math.sin(a1) * r;
    out += path(pd("M", x0, y0, "A", r, r, 0, 0, 1, x1, y1), { fill: "none", stroke: ACCENT, "stroke-width": 9 });
    const t = a1 + Math.PI / 2;
    const hx = x1 + Math.cos(t) * 14;
    const hy = y1 + Math.sin(t) * 14;
    const nx = Math.cos(a1) * 12;
    const ny = Math.sin(a1) * 12;
    out += poly([[hx, hy], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny]], { fill: ACCENT, stroke: "none" });
  }
  return { w: 100, h: 100, body: out, alt: "a recycling sign (three arrows chasing each other)" };
};

const handbag: IconFn = () => ({
  w: 100,
  h: 100,
  body:
    path(pd("M", 33, 38, "C", 33, 8, 67, 8, 67, 38), { fill: "none", stroke: INK, "stroke-width": 4 }) +
    path(pd("M", 18, 38, "L", 82, 38, "L", 88, 90, "Q", 88, 95, 83, 95, "L", 17, 95, "Q", 12, 95, 12, 90, "Z"), { ...OUT, "stroke-width": 3 }),
  alt: "a bag with handles",
});

// Small poster icons (24×24).
const posterIcon = (name: string): IconFn => (_p, th) => {
  const s: Attrs = { fill: "none", stroke: th.main, "stroke-width": 1.8 };
  const f: Attrs = { fill: th.tint, stroke: th.main, "stroke-width": 1.6 };
  let body = "";
  switch (name) {
    case "star": {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = (-90 + i * 36) * (Math.PI / 180);
        const r = i % 2 ? 4.8 : 11;
        pts.push([12 + Math.cos(a) * r, 13 + Math.sin(a) * r]);
      }
      body = poly(pts, { fill: th.main, stroke: th.main, "stroke-width": 1, "stroke-linejoin": "round" });
      break;
    }
    case "calendar":
      body = rect(3, 5, 18, 16, { rx: 2.5, ...f }) + line(3, 10, 21, 10, s) + line(8, 3, 8, 7, s) + line(16, 3, 16, 7, s) +
        [8, 12, 16].flatMap((x) => [14, 18].map((y) => circle(x, y, 1, { fill: th.main }))).join("");
      break;
    case "clock":
      body = circle(12, 12, 9.5, f) + line(12, 12, 12, 6.5, s) + line(12, 12, 16, 14, s);
      break;
    case "pin":
      body = path(pd("M", 12, 22, "C", 6, 15, 4, 12, 4, 9, "A", 8, 8, 0, 0, 1, 20, 9, "C", 20, 12, 18, 15, 12, 22, "Z"), f) + circle(12, 9, 3, { fill: PAPER, stroke: th.main, "stroke-width": 1.4 });
      break;
    case "palette":
      body = path(pd("M", 12, 3, "C", 3, 3, 1, 12, 4, 17, "C", 7, 22, 12, 19, 12, 17, "C", 12, 14, 15, 14, 18, 15, "C", 23, 16, 23, 3, 12, 3, "Z"), f) +
        [[8, 9], [12, 7], [16, 9], [7, 14]].map(([x, y]) => circle(x, y, 1.6, { fill: th.main })).join("");
      break;
    case "trophy":
      body = path(pd("M", 7, 3, "L", 17, 3, "L", 16, 11, "Q", 12, 15, 8, 11, "Z"), f) + path(pd("M", 7, 5, "Q", 2, 5, 4, 9, "Q", 5, 11, 8, 10, "M", 17, 5, "Q", 22, 5, 20, 9, "Q", 19, 11, 16, 10), s) +
        line(12, 14, 12, 18, s) + rect(7.5, 18, 9, 3, { rx: 1, ...f });
      break;
    case "food":
      body = path(pd("M", 3, 12, "L", 21, 12, "Q", 20, 21, 12, 21, "Q", 4, 21, 3, 12, "Z"), f) + path(pd("M", 9, 9, "Q", 7, 6, 9, 3, "M", 14, 9, "Q", 12, 6, 14, 3), s);
      break;
    case "web":
      body = circle(12, 12, 9.5, f) + ellipse(12, 12, 4, 9.5, s) + line(2.5, 12, 21.5, 12, s);
      break;
    case "gift":
      body = rect(4, 10, 16, 11, { rx: 1.5, ...f }) + rect(3, 7, 18, 4, { rx: 1, ...f }) + line(12, 7, 12, 21, s) +
        path(pd("M", 12, 7, "C", 8, 1, 4, 5, 12, 7, "C", 20, 5, 16, 1, 12, 7), s);
      break;
    default:
      body = circle(12, 12, 9, f);
  }
  return { w: 24, h: 24, body, alt: name };
};

// Decorative poster art (people and props), kept simple and friendly.
const person: IconFn = (p, th) => {
  const pose = typeof p.pose === "string" ? p.pose : "stand";
  const girl = p.gender === "girl";
  const excited = p.mood === "excited";
  const limb: Attrs = { fill: "none", stroke: INK, "stroke-width": 3, "stroke-linecap": "round" };
  const shirt: Attrs = { fill: th.tint, stroke: INK, "stroke-width": 1.8 };
  let arms = "";
  let legsOut = "";
  let bodyY = 30;
  if (pose === "kneel") {
    bodyY = 46;
    legsOut = path(pd("M", 25, 80, "L", 14, 86, "L", 14, 98, "M", 35, 80, "L", 46, 92, "L", 50, 98), limb);
    arms = path(pd("M", 22, 52, "L", 12, 70, "M", 38, 52, "L", 50, 70), limb);
  } else {
    legsOut = path(pd("M", 25, 64, "L", 23, 96, "M", 35, 64, "L", 37, 96), limb);
    if (pose === "hands_up") arms = path(pd("M", 22, 36, "L", 10, 10, "M", 38, 36, "L", 50, 10), limb);
    else if (pose === "point") arms = path(pd("M", 22, 36, "L", 14, 58, "M", 38, 36, "L", 56, 14), limb);
    else if (pose === "wave") arms = path(pd("M", 22, 36, "L", 14, 58, "M", 38, 36, "L", 50, 26, "L", 52, 10), limb);
    else arms = path(pd("M", 22, 36, "L", 14, 58, "M", 38, 36, "L", 46, 58), limb);
  }
  const headY = bodyY - 12;
  const hair = girl
    ? path(pd("M", 19, headY - 1, "Q", 19, headY - 14, 30, headY - 13, "Q", 41, headY - 14, 41, headY - 1, "Q", 36, headY - 8, 30, headY - 8, "Q", 24, headY - 8, 19, headY - 1, "Z"), { fill: INK }) +
      circle(43, headY - 4, 4.5, { fill: INK }) + circle(17, headY - 4, 4.5, { fill: INK })
    : path(pd("M", 19, headY - 2, "Q", 20, headY - 14, 31, headY - 13, "Q", 41, headY - 12, 41, headY - 3, "Q", 34, headY - 9, 19, headY - 2, "Z"), { fill: INK });
  const mouth = excited
    ? path(pd("M", 26, headY + 4, "Q", 30, headY + 10, 34, headY + 4, "Z"), { fill: INK })
    : path(pd("M", 26, headY + 4, "Q", 30, headY + 8, 34, headY + 4), { fill: "none", stroke: INK, "stroke-width": 1.4 });
  return {
    w: 60,
    h: 100,
    body:
      legsOut +
      arms +
      rect(20, bodyY, 20, pose === "kneel" ? 34 : 36, { rx: 7, ...shirt }) +
      circle(30, headY, 11, { fill: PAPER, stroke: INK, "stroke-width": 1.8 }) +
      hair +
      circle(26, headY, 1.4, { fill: INK }) +
      circle(34, headY, 1.4, { fill: INK }) +
      mouth,
    alt: "a child",
  };
};

const stone: IconFn = (_p, th) => ({
  w: 60,
  h: 44,
  body:
    path(pd("M", 6, 40, "L", 4, 24, "L", 14, 8, "L", 34, 4, "L", 52, 12, "L", 57, 30, "L", 50, 41, "Z"), { fill: SHADE, stroke: INK, "stroke-width": 1.8 }) +
    path(pd("M", 30, 23, "m", 0, 0, "a", 2, 2, 0, 1, 1, 3, 1, "a", 5, 5, 0, 1, 1, -7, -4, "a", 9, 9, 0, 1, 1, 13, 8, "a", 12, 12, 0, 0, 1, -11, 10), { fill: "none", stroke: th.main, "stroke-width": 1.6 }),
  alt: "a rock with a fossil shell",
});

const moon: IconFn = (_p, th) => ({
  w: 50,
  h: 50,
  body:
    path(pd("M", 30, 4, "A", 21, 21, 0, 1, 0, 46, 36, "A", 17, 17, 0, 1, 1, 30, 4, "Z"), { fill: th.tint, stroke: INK, "stroke-width": 1.8 }) +
    circle(42, 10, 1.8, { fill: th.main }) +
    circle(46, 20, 1.2, { fill: th.main }),
  alt: "a crescent moon",
});

const kite: IconFn = (_p, th) => ({
  w: 60,
  h: 80,
  body:
    path(pd("M", 30, 46, "Q", 22, 58, 30, 64, "Q", 38, 70, 30, 78), { fill: "none", stroke: INK, "stroke-width": 1.2 }) +
    poly([[24, 60], [36, 62], [24, 64]], { fill: th.main }) +
    poly([[36, 72], [24, 74], [36, 76]], { fill: th.main }) +
    poly([[30, 2], [50, 20], [30, 46], [10, 20]], { fill: th.tint, stroke: INK, "stroke-width": 1.8 }) +
    line(30, 2, 30, 46, { stroke: INK, "stroke-width": 1.2 }) +
    line(10, 20, 50, 20, { stroke: INK, "stroke-width": 1.2 }),
  alt: "a kite",
});

export const ICONS: Record<string, IconFn> = {
  spider,
  insect,
  beetle,
  centipede,
  grasshopper,
  frog,
  tadpole,
  frogspawn,
  mosquito_eggs: mosquitoEggs,
  mosquito_larva: mosquitoLarva,
  mosquito_pupa: mosquitoPupa,
  mosquito,
  fern,
  fruiting_plant: fruitingPlant,
  mushroom,
  seed,
  young_plant: youngPlant,
  clock: alarmClock,
  alarm_clock: alarmClock,
  elephant,
  sweat_drops: waterDrops,
  water_drops: waterDrops,
  recycle,
  handbag,
  person,
  stone,
  moon,
  kite,
  ...Object.fromEntries(["star", "calendar", "pin", "palette", "trophy", "food", "web", "gift"].map((n) => [`poster_${n}`, posterIcon(n)])),
  poster_clock: posterIcon("clock"),
};

const NEUTRAL: IconTheme = { main: INK, tint: SHADE };

/** Draw a named icon; unknown names fall back to a labelled placeholder box (listed for review). */
export function drawIcon(name: string, params: Spec = {}, theme: IconTheme = NEUTRAL): Drawing {
  const fn = ICONS[name];
  if (fn) return fn(params, theme);
  return {
    w: 80,
    h: 60,
    body: rect(2, 2, 76, 56, { rx: 8, fill: PAPER, stroke: INK, "stroke-width": 1.4, "stroke-dasharray": "4 3" }) + text(40, 30, name.replace(/_/g, " "), { size: 11 }),
    alt: name.replace(/_/g, " "),
  };
}

export const hasIcon = (name: string): boolean => name in ICONS;
