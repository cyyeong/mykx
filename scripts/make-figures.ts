// Draws the exam-style diagrams that some questions need (P6 Maths geometry, mensuration and pie charts; science
// set-ups), as clean SVG in the papers' figure style: black lines, sans labels, "Not drawn to scale". Our own
// drawings from each question's own numbers, so the files are original (CC BY-NC 4.0 with the packs).
//   node scripts/make-figures.ts        → writes content/skills/<pack>/figures/*.svg
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const INK = "#111";
const GREY = "#555";
const SHADE = "#d9d9de";
const WATER = "#cfe3f3";
const FONT = "Helvetica, Arial, sans-serif";

type Pt = [number, number];
const f = (n: number) => Math.round(n * 10) / 10;

function svg(w: number, h: number, body: string[]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">\n<rect width="${w}" height="${h}" fill="#fff"/>\n${body.join("\n")}\n</svg>\n`;
}
function line(a: Pt, b: Pt, o: { w?: number; dash?: boolean; color?: string } = {}) {
  return `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${o.color ?? INK}" stroke-width="${o.w ?? 1.7}"${o.dash ? ' stroke-dasharray="5 4"' : ""} stroke-linecap="round"/>`;
}
function poly(pts: Pt[], o: { fill?: string; w?: number; dash?: boolean; close?: boolean } = {}) {
  const d = pts.map((p, i) => `${i ? "L" : "M"} ${f(p[0])} ${f(p[1])}`).join(" ") + (o.close === false ? "" : " Z");
  return `<path d="${d}" fill="${o.fill ?? "none"}" stroke="${INK}" stroke-width="${o.w ?? 1.7}" stroke-linejoin="round"${o.dash ? ' stroke-dasharray="5 4"' : ""}/>`;
}
function text(p: Pt, s: string, o: { anchor?: "start" | "middle" | "end"; size?: number; italic?: boolean; bold?: boolean; color?: string } = {}) {
  return `<text x="${f(p[0])}" y="${f(p[1])}" font-size="${o.size ?? 14}" text-anchor="${o.anchor ?? "middle"}"${o.italic ? ' font-style="italic"' : ""}${o.bold ? ' font-weight="700"' : ""} fill="${o.color ?? INK}">${s}</text>`;
}
const note = (x: number, y: number) => text([x, y], "Not drawn to scale", { anchor: "start", size: 11, italic: true, color: GREY });
const unit = (v: Pt) => {
  const l = Math.hypot(v[0], v[1]);
  return [v[0] / l, v[1] / l] as Pt;
};
/** A right-angle square at corner c, along the directions to a and b. */
function rightAngle(c: Pt, a: Pt, b: Pt, s = 10) {
  const u = unit([a[0] - c[0], a[1] - c[1]]);
  const v = unit([b[0] - c[0], b[1] - c[1]]);
  const p1: Pt = [c[0] + u[0] * s, c[1] + u[1] * s];
  const p2: Pt = [c[0] + (u[0] + v[0]) * s, c[1] + (u[1] + v[1]) * s];
  const p3: Pt = [c[0] + v[0] * s, c[1] + v[1] * s];
  return `<path d="M ${f(p1[0])} ${f(p1[1])} L ${f(p2[0])} ${f(p2[1])} L ${f(p3[0])} ${f(p3[1])}" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
}
/** An angle arc at vertex c from ray ca to ray cb (the smaller angle), with an optional label. */
function angle(c: Pt, a: Pt, b: Pt, label?: string, r = 22) {
  const t1 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  let t2 = Math.atan2(b[1] - c[1], b[0] - c[0]);
  let d = t2 - t1;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  t2 = t1 + d;
  const p1: Pt = [c[0] + r * Math.cos(t1), c[1] + r * Math.sin(t1)];
  const p2: Pt = [c[0] + r * Math.cos(t2), c[1] + r * Math.sin(t2)];
  const out = [`<path d="M ${f(p1[0])} ${f(p1[1])} A ${r} ${r} 0 0 ${d > 0 ? 1 : 0} ${f(p2[0])} ${f(p2[1])}" fill="none" stroke="${INK}" stroke-width="1.2"/>`];
  if (label) {
    const m = t1 + d / 2;
    out.push(text([c[0] + (r + 15) * Math.cos(m), c[1] + (r + 15) * Math.sin(m) + 5], label, { size: 13 }));
  }
  return out.join("\n");
}
/** A small tick across segment ab at its middle (equal sides). */
function tick(a: Pt, b: Pt, n = 1) {
  const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const u = unit([b[0] - a[0], b[1] - a[1]]);
  const nrm: Pt = [-u[1], u[0]];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * 5;
    const c: Pt = [m[0] + u[0] * o, m[1] + u[1] * o];
    out.push(line([c[0] - nrm[0] * 6, c[1] - nrm[1] * 6], [c[0] + nrm[0] * 6, c[1] + nrm[1] * 6], { w: 1.3 }));
  }
  return out.join("\n");
}
/** A box in oblique projection: front face x,y,w,h and depth d; hidden edges dashed; optional water to height wh. */
function box(x: number, y: number, w: number, h: number, d: number, o: { water?: number; labels?: { len?: string; wid?: string; ht?: string; water?: string } } = {}) {
  const dx = d * 0.55;
  const dy = -d * 0.4;
  const F = { tl: [x, y] as Pt, tr: [x + w, y] as Pt, br: [x + w, y + h] as Pt, bl: [x, y + h] as Pt };
  const B = { tl: [x + dx, y + dy] as Pt, tr: [x + w + dx, y + dy] as Pt, br: [x + w + dx, y + h + dy] as Pt, bl: [x + dx, y + h + dy] as Pt };
  const out: string[] = [];
  if (o.water) {
    const wy = y + h - o.water;
    out.push(poly([[x, wy], [x + w, wy], F.br, F.bl], { fill: WATER, w: 0 }));
    out.push(poly([[x, wy], [x + dx, wy + dy], [x + w + dx, wy + dy], [x + w, wy]], { fill: WATER, w: 0 }));
    out.push(poly([[x + w, wy], [x + w + dx, wy + dy], B.br, F.br], { fill: WATER, w: 0 }));
    out.push(line([x, wy], [x + w, wy], { w: 1.2 }), line([x + w, wy], [x + w + dx, wy + dy], { w: 1.2 }), line([x, wy], [x + dx, wy + dy], { w: 1, dash: true }), line([x + dx, wy + dy], [x + w + dx, wy + dy], { w: 1, dash: true }));
  }
  out.push(poly([F.tl, F.tr, F.br, F.bl]));
  out.push(poly([F.tl, B.tl, B.tr, F.tr], { close: false }));
  out.push(line(F.tr, B.tr), line(B.tr, B.br), line(B.br, F.br));
  out.push(line(F.bl, B.bl, { dash: true, w: 1.2 }), line(B.bl, B.br, { dash: true, w: 1.2 }), line(B.bl, B.tl, { dash: true, w: 1.2 }));
  const L = o.labels ?? {};
  if (L.len) out.push(text([x + w / 2, y + h + 20], L.len));
  if (L.wid) out.push(text([x + w + dx / 2 + 16, y + h + dy / 2 + 12], L.wid, { anchor: "start" }));
  if (L.ht) out.push(text([x - 8, y + h / 2 + 5], L.ht, { anchor: "end" }));
  if (L.water && o.water) {
    const wy = y + h - o.water;
    out.push(line([x + w + dx + 14, wy + dy], [x + w + dx + 14, y + h + dy], { w: 1 }), text([x + w + dx + 20, (wy + y + h) / 2 + dy + 5], L.water, { anchor: "start" }));
  }
  return out.join("\n");
}
/** A pie chart: sectors from 12 o'clock clockwise, with labels inside. */
function pie(c: Pt, r: number, sectors: { deg: number; label: string; shade?: boolean; right?: boolean }[]) {
  const out: string[] = [];
  let a = -90;
  for (const s of sectors) {
    const t1 = (a * Math.PI) / 180;
    const t2 = ((a + s.deg) * Math.PI) / 180;
    const p1: Pt = [c[0] + r * Math.cos(t1), c[1] + r * Math.sin(t1)];
    const p2: Pt = [c[0] + r * Math.cos(t2), c[1] + r * Math.sin(t2)];
    out.push(`<path d="M ${f(c[0])} ${f(c[1])} L ${f(p1[0])} ${f(p1[1])} A ${r} ${r} 0 ${s.deg > 180 ? 1 : 0} 1 ${f(p2[0])} ${f(p2[1])} Z" fill="${s.shade ? SHADE : "#fff"}" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>`);
    if (s.right) out.push(rightAngle(c, p1, p2, 12));
    const m = ((a + s.deg / 2) * Math.PI) / 180;
    const lines = s.label.split("|");
    lines.forEach((l, i) => out.push(text([c[0] + r * 0.6 * Math.cos(m), c[1] + r * 0.6 * Math.sin(m) + 5 + (i - (lines.length - 1) / 2) * 16], l, { size: 13, bold: i === 0 })));
    a += s.deg;
  }
  return out.join("\n");
}

const FIGS: Record<string, Record<string, string>> = { "p6-maths": {}, "p3-science": {}, "p6-science": {} };
const P6 = FIGS["p6-maths"];

// q20: rectangle ABCD, E on DC, triangle ABE shaded.
{
  const A: Pt = [50, 40], B: Pt = [306, 40], C: Pt = [306, 200], D: Pt = [50, 200], E: Pt = [140, 200];
  P6["q20-rectangle-abe.svg"] = svg(360, 260, [
    poly([A, B, E], { fill: SHADE, w: 1.4 }),
    poly([A, B, C, D]),
    rightAngle(A, B, D), rightAngle(B, A, C), rightAngle(C, B, D), rightAngle(D, A, C),
    text([A[0] - 10, A[1] - 6], "A", { bold: true }), text([B[0] + 10, B[1] - 6], "B", { bold: true }), text([C[0] + 12, C[1] + 6], "C", { bold: true }), text([D[0] - 12, D[1] + 6], "D", { bold: true }), text([E[0], E[1] + 20], "E", { bold: true }),
    text([(A[0] + B[0]) / 2, A[1] - 10], "16 cm"), text([C[0] + 14, 125], "10 cm", { anchor: "start" }),
    note(10, 252),
  ]);
}
// q21: garden with a 2 m path inside all four edges.
{
  const x = 40, y = 30, w = 288, h = 192, p = 32;
  P6["q21-garden-path.svg"] = svg(380, 290, [
    `<path d="M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z M ${x + p} ${y + p} V ${y + h - p} H ${x + w - p} V ${y + p} Z" fill="${SHADE}" fill-rule="evenodd" stroke="${INK}" stroke-width="1.7"/>`,
    poly([[x + p, y + p], [x + w - p, y + p], [x + w - p, y + h - p], [x + p, y + h - p]], { w: 1.4 }),
    text([x + w / 2, y + h / 2 + 5], "grass", { italic: true }), text([x + w / 2, y + 21], "path", { size: 12, italic: true }),
    text([x + w / 2, y + h + 22], "18 m"), text([x - 8, y + h / 2 + 5], "12 m", { anchor: "end" }),
    line([x + w + 10, y], [x + w + 10, y + p], { w: 1 }), line([x + w + 6, y], [x + w + 14, y], { w: 1 }), line([x + w + 6, y + p], [x + w + 14, y + p], { w: 1 }), text([x + w + 18, y + p / 2 + 5], "2 m", { anchor: "start" }),
    note(10, 282),
  ]);
}
// q22: a square cut into two identical rectangles.
{
  const x = 70, y = 26, s = 170;
  P6["q22-square-cut.svg"] = svg(320, 254, [
    poly([[x, y], [x + s, y], [x + s, y + s], [x, y + s]]),
    line([x + s / 2, y - 8], [x + s / 2, y + s + 8], { dash: true, w: 1.4 }),
    text([x + s / 2 + 8, y + 12], "cut", { size: 11, italic: true, color: GREY, anchor: "start" }),
    text([x + s / 2, y + s + 26], "Area of the square = 144 cm²", { size: 13 }),
    note(10, 246),
  ]);
}
// q23: a circle with its diameter.
{
  const c: Pt = [150, 120], r = 90;
  P6["q23-circle-diameter.svg"] = svg(300, 250, [
    `<circle cx="${c[0]}" cy="${c[1]}" r="${r}" fill="none" stroke="${INK}" stroke-width="1.7"/>`,
    line([c[0] - r, c[1]], [c[0] + r, c[1]], { w: 1.4 }), `<circle cx="${c[0]}" cy="${c[1]}" r="2.6" fill="${INK}"/>`,
    text([c[0], c[1] - 10], "28 cm"),
    note(10, 242),
  ]);
}
// q24: a circle given only its circumference.
{
  const c: Pt = [150, 115], r = 85;
  P6["q24-circle-circumference.svg"] = svg(300, 250, [
    `<circle cx="${c[0]}" cy="${c[1]}" r="${r}" fill="none" stroke="${INK}" stroke-width="1.7"/>`,
    `<circle cx="${c[0]}" cy="${c[1]}" r="2.6" fill="${INK}"/>`,
    text([c[0], c[1] + r + 24], "Circumference = 62.8 cm"),
    note(10, 244),
  ]);
}
// q34: the four shapes in the options, numbered like them.
{
  const out: string[] = [];
  out.push(poly([[30, 40], [110, 40], [110, 120], [30, 120]]), text([70, 150], "(1)", { bold: true }));
  out.push(poly([[150, 55], [280, 55], [280, 115], [150, 115]]), text([215, 150], "(2)", { bold: true }));
  out.push(poly([[360, 30], [405, 108], [315, 108]]), text([360, 150], "(3)", { bold: true }));
  out.push(poly([[460, 115], [580, 115], [550, 50], [490, 50]]), text([520, 150], "(4)", { bold: true }));
  P6["q34-shapes.svg"] = svg(610, 165, out);
}
// q25: a semicircle with its diameter.
{
  const c: Pt = [160, 150], r = 120;
  P6["q25-semicircle.svg"] = svg(320, 210, [
    `<path d="M ${c[0] - r} ${c[1]} A ${r} ${r} 0 0 1 ${c[0] + r} ${c[1]} Z" fill="none" stroke="${INK}" stroke-width="1.7"/>`,
    text([c[0], c[1] + 22], "20 cm"),
    note(10, 202),
  ]);
}
// q26: a square with a quarter circle from one corner; the part outside is shaded.
{
  const x = 70, y = 26, s = 180;
  P6["q26-quarter-circle.svg"] = svg(330, 270, [
    `<path d="M ${x} ${y} H ${x + s} V ${y + s} A ${s} ${s} 0 0 0 ${x} ${y} Z" fill="${SHADE}" stroke="none"/>`,
    poly([[x, y], [x + s, y], [x + s, y + s], [x, y + s]]),
    `<path d="M ${x + s} ${y + s} A ${s} ${s} 0 0 0 ${x} ${y}" fill="none" stroke="${INK}" stroke-width="1.7"/>`,
    `<circle cx="${x}" cy="${y + s}" r="2.6" fill="${INK}"/>`,
    rightAngle([x, y + s], [x, y], [x + s, y + s], 11),
    text([x + s / 2, y + s + 22], "14 cm"), text([x - 8, y + s / 2 + 5], "14 cm", { anchor: "end" }),
    note(10, 262),
  ]);
}
// q27: a cube.
P6["q27-cube.svg"] = svg(260, 230, [box(50, 70, 120, 120, 120), note(10, 222)]);
// q28: a tank 40 cm by 30 cm holding water.
P6["q28-tank.svg"] = svg(360, 260, [box(50, 60, 200, 140, 110, { water: 70, labels: { len: "40 cm", wid: "30 cm", water: "?" } }), note(10, 252)]);
// q29: Tank A with water, Tank B empty.
P6["q29-two-tanks.svg"] = svg(640, 300, [
  box(40, 70, 190, 150, 90, { water: 115, labels: { len: "50 cm", wid: "30 cm", water: "36 cm" } }),
  text([135, 268], "Tank A", { bold: true }),
  box(390, 100, 152, 120, 90, { labels: { len: "40 cm", wid: "30 cm" } }),
  text([466, 268], "Tank B", { bold: true }),
  note(10, 292),
]);
// q30: a tank 60 × 40 × 50 cm, filled to 30 cm.
P6["q30-tank-fill.svg"] = svg(430, 280, [box(60, 60, 210, 170, 120, { water: 102, labels: { len: "60 cm", wid: "40 cm", ht: "50 cm", water: "30 cm" } }), note(10, 272)]);
// q31: isosceles triangle PQR with PQ = PR and ∠QPR = 48°.
{
  const P: Pt = [160, 30], Q: Pt = [80, 210], R: Pt = [240, 210];
  P6["q31-isosceles.svg"] = svg(320, 250, [
    poly([P, Q, R]), tick(P, Q), tick(P, R), angle(P, Q, R, "48°", 30),
    text([P[0], P[1] - 8], "P", { bold: true }), text([Q[0] - 12, Q[1] + 6], "Q", { bold: true }), text([R[0] + 12, R[1] + 6], "R", { bold: true }),
    note(10, 242),
  ]);
}
// q32: rhombus ABCD with ∠ABC = 124° and the diagonal AC.
{
  const s = 130, t = (62 * Math.PI) / 180, B: Pt = [190, 40];
  const A: Pt = [B[0] - s * Math.sin(t), B[1] + s * Math.cos(t)], C: Pt = [B[0] + s * Math.sin(t), B[1] + s * Math.cos(t)], D: Pt = [B[0], B[1] + 2 * s * Math.cos(t)];
  P6["q32-rhombus.svg"] = svg(380, 210, [
    poly([A, B, C, D]), line(A, C, { w: 1.4 }), tick(A, B), tick(B, C), tick(C, D), tick(D, A), angle(B, A, C, "124°", 20),
    text([A[0] - 12, A[1] + 5], "A", { bold: true }), text([B[0], B[1] - 8], "B", { bold: true }), text([C[0] + 12, C[1] + 5], "C", { bold: true }), text([D[0], D[1] + 20], "D", { bold: true }),
    note(10, 204),
  ]);
}
// q33: parallel lines AB and CD, cut by a line at G and H; ∠AGH = 72°.
{
  const G: Pt = [210, 60], t = (72 * Math.PI) / 180;
  const dir: Pt = [-Math.cos(t), Math.sin(t)];
  const H: Pt = [G[0] + dir[0] * 130, G[1] + dir[1] * 130];
  const arrow = (p: Pt) => `<path d="M ${p[0] - 6} ${p[1] - 5} L ${p[0]} ${p[1]} L ${p[0] - 6} ${p[1] + 5}" fill="none" stroke="${INK}" stroke-width="1.4"/>`;
  P6["q33-parallel.svg"] = svg(400, 230, [
    line([40, G[1]], [360, G[1]]), line([40, H[1]], [360, H[1]]), arrow([300, G[1]]), arrow([300, H[1]]),
    line([G[0] - dir[0] * 30, G[1] - dir[1] * 30], [H[0] + dir[0] * 30, H[1] + dir[1] * 30]),
    angle(G, [40, G[1]], H, "72°", 24),
    text([30, G[1] + 5], "A", { bold: true, anchor: "end" }), text([370, G[1] + 5], "B", { bold: true, anchor: "start" }),
    text([30, H[1] + 5], "C", { bold: true, anchor: "end" }), text([370, H[1] + 5], "D", { bold: true, anchor: "start" }),
    text([G[0] + 12, G[1] - 8], "G", { bold: true }), text([H[0] + 14, H[1] + 18], "H", { bold: true }),
    note(10, 222),
  ]);
}
// q35: how 360 pupils travel to school (Bus is a right angle, Car 1/3, MRT 15%, the rest walk).
P6["q35-pie-travel.svg"] = svg(300, 270, [
  pie([150, 128], 105, [
    { deg: 90, label: "Bus", right: true },
    { deg: 120, label: "Car|1/3" },
    { deg: 54, label: "MRT|15%" },
    { deg: 96, label: "Walk", shade: true },
  ]),
  note(10, 262),
]);
// q37: pie charts X and Y, mango 40% and 30%.
P6["q37-two-pies.svg"] = svg(520, 260, [
  pie([130, 120], 95, [{ deg: 144, label: "Mango|40%", shade: true }, { deg: 90, label: "Apple" }, { deg: 72, label: "Banana" }, { deg: 54, label: "Pear" }]),
  text([130, 238], "Pie chart X: Class A", { bold: true, size: 13 }),
  pie([390, 120], 95, [{ deg: 108, label: "Mango|30%", shade: true }, { deg: 108, label: "Apple" }, { deg: 90, label: "Banana" }, { deg: 54, label: "Pear" }]),
  text([390, 238], "Pie chart Y: Class B", { bold: true, size: 13 }),
]);

// ─── P6 Maths, set original-02: nets and solids made of unit cubes ───
/** Unit squares of a net at grid cells [col, row], each s px, from (x, y). */
function net(x: number, y: number, s: number, cells: [number, number][]) {
  return cells.map(([c, r]) => `<rect x="${x + c * s}" y="${y + r * s}" width="${s}" height="${s}" fill="#fff" stroke="${INK}" stroke-width="1.7"/>`).join("\n");
}
// o2-q19: the net of a triangular prism: three rectangles in a row, a triangle on the top and bottom of the middle one.
{
  const x = 50, y = 70, w = 60, h = 120, th = 52;
  P6["o2-q19-prism-net.svg"] = svg(280, 272, [
    poly([[x, y], [x + 3 * w, y], [x + 3 * w, y + h], [x, y + h]]),
    line([x + w, y], [x + w, y + h]), line([x + 2 * w, y], [x + 2 * w, y + h]),
    poly([[x + w, y], [x + 1.5 * w, y - th], [x + 2 * w, y]]),
    poly([[x + w, y + h], [x + 1.5 * w, y + h + th], [x + 2 * w, y + h]]),
    note(10, 266),
  ]);
}
// o2-q20: four nets of six squares, labelled A–D (C has two squares on the same side of a row of four).
{
  const s = 26;
  const nets: [string, [number, number][]][] = [
    ["A", [[0, 1], [1, 1], [2, 1], [3, 1], [1, 0], [1, 2]]],
    ["B", [[0, 1], [1, 1], [2, 1], [3, 1], [0, 0], [3, 2]]],
    ["C", [[0, 1], [1, 1], [2, 1], [3, 1], [0, 0], [2, 0]]],
    ["D", [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]]],
  ];
  const out: string[] = [];
  nets.forEach(([label, cells], i) => {
    const x = 22 + (i % 2) * 160, y = 14 + Math.floor(i / 2) * 136;
    out.push(net(x, y, s, cells), text([x + 2 * s, y + 3 * s + 32], `Net ${label}`, { bold: true, size: 22 }));
  });
  P6["o2-q20-cube-nets.svg"] = svg(310, 278, out);
}
// o2-q21: a solid of unit cubes in isometric view: a full 3 × 3 bottom layer, a 2 × 2 middle layer at the back
// corner and one cube on top of that corner.
{
  const s = 34, ox = 150, oy = 120;
  const cx = Math.cos(Math.PI / 6) * s, cy = Math.sin(Math.PI / 6) * s;
  const P = (x: number, y: number, z: number): Pt => [ox + (x - y) * cx, oy + (x + y) * cy - z * s];
  const cubes: [number, number, number][] = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) cubes.push([x, y, 0]);
  for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) cubes.push([x, y, 1]);
  cubes.push([0, 0, 2]);
  cubes.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]) || a[2] - b[2]);
  const face = (pts: Pt[], fill: string) => `<path d="${pts.map((p, i) => `${i ? "L" : "M"} ${f(p[0])} ${f(p[1])}`).join(" ")} Z" fill="${fill}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`;
  const out: string[] = [];
  for (const [x, y, z] of cubes) {
    out.push(face([P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], "#ffffff"));
    out.push(face([P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x + 1, y + 1, z), P(x + 1, y, z)], "#e4e4ea"));
    out.push(face([P(x, y + 1, z + 1), P(x + 1, y + 1, z + 1), P(x + 1, y + 1, z), P(x, y + 1, z)], SHADE));
  }
  P6["o2-q21-cube-stack.svg"] = svg(300, 240, out);
}
// o2-q22: the net of a cuboid with square ends: four identical rectangles in a row, a square on the top and
// bottom of the second rectangle.
{
  const x = 60, y = 58, w = 36, h = 108;
  const out = [poly([[x, y], [x + 4 * w, y], [x + 4 * w, y + h], [x, y + h]])];
  for (let i = 1; i < 4; i++) out.push(line([x + i * w, y], [x + i * w, y + h]));
  out.push(poly([[x + w, y - w], [x + 2 * w, y - w], [x + 2 * w, y], [x + w, y]]), poly([[x + w, y + h], [x + 2 * w, y + h], [x + 2 * w, y + h + w], [x + w, y + h + w]]));
  out.push(note(10, 226));
  P6["o2-q22-cuboid-net.svg"] = svg(264, 232, out);
}

// P3 Science: seeds in set-ups A–D (the table gives the conditions; this shows what each looks like).
{
  const out: string[] = [];
  const dish = (cx: number, y: number, wet: boolean) => {
    const o = [`<ellipse cx="${cx}" cy="${y}" rx="44" ry="11" fill="${wet ? WATER : "#fff"}" stroke="${INK}" stroke-width="1.6"/>`, `<path d="M ${cx - 44} ${y} v 10 a 44 11 0 0 0 88 0 v -10" fill="none" stroke="${INK}" stroke-width="1.6"/>`];
    for (const dx of [-22, -6, 10, 24]) o.push(`<ellipse cx="${cx + dx}" cy="${y - 2}" rx="5" ry="3.4" fill="#c79a5b" stroke="${INK}" stroke-width="1"/>`);
    o.push(text([cx, y + 48], wet ? "wet cotton wool" : "dry cotton wool", { size: 11, color: GREY }));
    return o.join("\n");
  };
  const lamp = (cx: number, y: number) => [`<circle cx="${cx}" cy="${y}" r="9" fill="#fff4b8" stroke="${INK}" stroke-width="1.4"/>`, ...[0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const t = (a * Math.PI) / 180; return line([cx + 13 * Math.cos(t), y + 13 * Math.sin(t)], [cx + 19 * Math.cos(t), y + 19 * Math.sin(t)], { w: 1.3 }); })].join("\n");
  const cols = [70, 210, 350, 490];
  ["A", "B", "C", "D"].forEach((k, i) => out.push(text([cols[i], 22], k, { bold: true, size: 16 })));
  out.push(lamp(cols[0], 52), dish(cols[0], 130, true));
  out.push(lamp(cols[1], 52), dish(cols[1], 130, false));
  out.push(dish(cols[2], 130, true), `<path d="M ${cols[2] - 58} 154 V 74 H ${cols[2] + 58} V 154" fill="#3a3a44" fill-opacity="0.72" stroke="${INK}" stroke-width="1.6"/>`, text([cols[2], 66], "covered by a dark box", { size: 11, color: GREY }));
  out.push(`<rect x="${cols[3] - 60}" y="40" width="120" height="118" rx="6" fill="#eef6fc" stroke="${INK}" stroke-width="1.6"/>`, text([cols[3], 56], "fridge, 5 °C", { size: 11, color: GREY }), lamp(cols[3] + 40, 78), `<rect x="${cols[3] - 52}" y="94" width="104" height="58" rx="5" fill="none" stroke="${INK}" stroke-width="1.4" stroke-dasharray="3 2"/>`, text([cols[3], 108], "air removed", { size: 10, color: GREY }), dish(cols[3], 130, true));
  out.push(text([cols[0], 206], "30 °C", { size: 12 }), text([cols[1], 206], "30 °C", { size: 12 }), text([cols[2], 206], "30 °C", { size: 12 }), text([cols[3], 206], "5 °C", { size: 12 }));
  FIGS["p3-science"]["p3sci-diagnostic-01-a8.svg"] = svg(560, 220, out);
}
// P3 Science: electromagnet set-ups A–D (turns, batteries, core).
{
  const out: string[] = [];
  const setup = (x: number, label: string, turns: number, cells: number, core: "iron nail" | "copper rod") => {
    const o: string[] = [text([x + 60, 22], label, { bold: true, size: 16 })];
    const cy = 92;
    o.push(core === "iron nail" ? `<path d="M ${x} ${cy - 5} H ${x + 118} L ${x + 132} ${cy} L ${x + 118} ${cy + 5} H ${x} Z" fill="#9aa0a8" stroke="${INK}" stroke-width="1.3"/>` : `<rect x="${x}" y="${cy - 6}" width="128" height="12" rx="3" fill="#d39a6a" stroke="${INK}" stroke-width="1.3"/>`);
    const w = 96 / turns;
    for (let i = 0; i < turns; i++) o.push(`<ellipse cx="${f(x + 14 + w * (i + 0.5))}" cy="${cy}" rx="${f(Math.max(1.6, w * 0.45))}" ry="11" fill="none" stroke="#b5651d" stroke-width="1.3"/>`);
    const bx = x + 30;
    o.push(`<path d="M ${x + 14} ${cy + 10} V 160 H ${bx}" fill="none" stroke="#b5651d" stroke-width="1.3"/>`, `<path d="M ${x + 110} ${cy + 10} V 160 H ${bx + cells * 34}" fill="none" stroke="#b5651d" stroke-width="1.3"/>`);
    for (let i = 0; i < cells; i++) o.push(`<rect x="${bx + i * 34}" y="150" width="32" height="20" rx="3" fill="#fff" stroke="${INK}" stroke-width="1.4"/>`, `<rect x="${bx + i * 34 + 32}" y="156" width="3" height="8" fill="${INK}"/>`);
    o.push(text([x + 60, 196], `${turns} turns · ${core}`, { size: 11, color: GREY }));
    return o.join("\n");
  };
  out.push(setup(20, "A", 10, 2, "iron nail"), setup(180, "B", 20, 2, "iron nail"), setup(340, "C", 20, 1, "iron nail"), setup(500, "D", 10, 2, "copper rod"));
  FIGS["p3-science"]["p3sci-eoy-mock-80-e24.svg"] = svg(660, 210, out);
}
// P6 Science: a magnet moved along a ruler towards a steel clip.
{
  const out: string[] = [];
  const x0 = 60, cm = 34, y = 120;
  out.push(`<rect x="${x0 - 14}" y="${y}" width="${12 * cm + 28}" height="34" fill="#f7f1e1" stroke="${INK}" stroke-width="1.4"/>`);
  for (let i = 0; i <= 12; i++) out.push(line([x0 + i * cm, y], [x0 + i * cm, y + (i % 2 ? 9 : 14)], { w: 1.1 }), text([x0 + i * cm, y + 28], String(i), { size: 11 }));
  out.push(text([x0 + 12 * cm + 22, y + 28], "cm", { size: 11, anchor: "start" }));
  out.push(`<path d="M ${x0 - 4} ${y - 30} h 18 v 22 h -12 v -16 h 6 v 10" fill="none" stroke="${INK}" stroke-width="2"/>`, text([x0 + 4, y - 40], "steel clip", { size: 12 }));
  const mx = x0 + 12 * cm;
  out.push(`<rect x="${mx - 6}" y="${y - 30}" width="62" height="24" fill="#fff" stroke="${INK}" stroke-width="1.6"/>`, line([mx + 25, y - 30], [mx + 25, y - 6], { w: 1.2 }), text([mx + 10, y - 13], "N", { size: 12, bold: true }), text([mx + 41, y - 13], "S", { size: 12, bold: true }), text([mx + 25, y - 40], "magnet", { size: 12 }));
  out.push(`<path d="M ${mx - 14} ${y - 18} H ${mx - 120}" fill="none" stroke="${INK}" stroke-width="1.6"/>`, `<path d="M ${mx - 112} ${y - 24} L ${mx - 122} ${y - 18} L ${mx - 112} ${y - 12}" fill="none" stroke="${INK}" stroke-width="1.6"/>`, text([mx - 66, y - 26], "moved slowly", { size: 11, color: GREY }));
  out.push(note(10, 188));
  FIGS["p6-science"]["p6sci-practice-02-q2.svg"] = svg(560, 196, out);
}

for (const [pack, files] of Object.entries(FIGS)) {
  const dir = join("content", "skills", pack, "figures");
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  console.log(pack, Object.keys(files).length, "figures");
}
