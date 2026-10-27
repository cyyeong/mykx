// Tiny, dependency-free SVG builders for question-bank figures.
// Every figure is static markup: no scripts, no ids except the root's title/desc,
// no url(#…) references, no external files. Pure functions, safe in the browser,
// in Node scripts (type stripping) and in tests.

/** A drawn piece of a figure in its own coordinates (origin top-left, y down). */
export interface Drawing {
  w: number;
  h: number;
  body: string;
  /** Plain-words description for the figure's <desc>. */
  alt: string;
}

/** Loose spec object: figure specs are untrusted JSON, so every field is read defensively. */
export type Spec = Record<string, unknown>;

// ─── Palette: dark ink on white, one calm accent (water, liquid, highlights) ─────────────
export const INK = "#1f2a37";
export const SOFT = "#5c6878";
export const FAINT = "#d3dae3";
export const PAPER = "#ffffff";
export const SHADE = "#e8ecf1";
export const DARK_SHADE = "#c3cad4";
export const ACCENT = "#2f6fb0";
export const TINT = "#dcebf8";
/** Text is drawn this much larger than the layout sizes, so labels stay readable when a figure is shown 320 px wide. */
export const FONT_SCALE = 1.12;
export const FONT =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif";

// ─── Spec readers ─────────────────────────────────────────────────────────────────────────
export const num = (v: unknown, dflt: number): number => (typeof v === "number" && Number.isFinite(v) ? v : dflt);
export const str = (v: unknown, dflt = ""): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : dflt);
export const list = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
export const obj = (v: unknown): Spec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Spec) : {});
export const kindOf = (d: Spec): string => str(d.kind) || str(d.type);

// ─── Markup ───────────────────────────────────────────────────────────────────────────────
export function fmt(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? "0" : String(r);
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type Attrs = Record<string, string | number | undefined | null | false>;

export function el(name: string, attrs: Attrs = {}, children = ""): string {
  let a = "";
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    a += ` ${k}="${typeof v === "number" ? fmt(v) : esc(v)}"`;
  }
  return children ? `<${name}${a}>${children}</${name}>` : `<${name}${a}/>`;
}

/** Path data from mixed commands and numbers: pd("M", 0, 0, "L", 10, 10). */
export function pd(...parts: (string | number)[]): string {
  return parts.map((p) => (typeof p === "number" ? fmt(p) : p)).join(" ");
}

export const line = (x1: number, y1: number, x2: number, y2: number, a: Attrs = {}) => el("line", { x1, y1, x2, y2, ...a });
export const rect = (x: number, y: number, w: number, h: number, a: Attrs = {}) => el("rect", { x, y, width: w, height: h, ...a });
export const circle = (cx: number, cy: number, r: number, a: Attrs = {}) => el("circle", { cx, cy, r, ...a });
export const ellipse = (cx: number, cy: number, rx: number, ry: number, a: Attrs = {}) => el("ellipse", { cx, cy, rx, ry, ...a });
export const path = (d: string, a: Attrs = {}) => el("path", { d, ...a });
export function poly(pts: [number, number][], a: Attrs = {}, closed = true): string {
  return el(closed ? "polygon" : "polyline", { points: pts.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(" "), ...a });
}
export const group = (body: string, a: Attrs = {}) => el("g", a, body);

/** Place a drawing at (x, y), optionally scaled. */
export function place(d: Drawing, x: number, y: number, s = 1): string {
  const t = s === 1 ? `translate(${fmt(x)} ${fmt(y)})` : `translate(${fmt(x)} ${fmt(y)}) scale(${Math.round(s * 1000) / 1000})`;
  return el("g", { transform: t }, d.body);
}

// ─── Text ─────────────────────────────────────────────────────────────────────────────────
export interface TextOpts {
  size?: number;
  anchor?: "start" | "middle" | "end";
  weight?: number;
  fill?: string;
  italic?: boolean;
}

/** Rough advance width of a string in a system sans font (enough for layout, not typesetting). */
export function textWidth(s: string, size = 13, weight = 400): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x2e80) w += 1.0;
    else if (ch === " ") w += 0.28;
    else if ("il.,:;'|!jtfrI()[]·".includes(ch)) w += 0.31;
    else if ("mwMW@%".includes(ch)) w += 0.86;
    else if (ch >= "A" && ch <= "Z") w += 0.66;
    else if (ch >= "0" && ch <= "9") w += 0.57;
    else w += 0.54;
  }
  return w * size * FONT_SCALE * (weight >= 600 ? 1.07 : 1);
}

/** One line of text whose vertical centre is y. */
export function text(x: number, y: number, s: string, o: TextOpts = {}): string {
  const size = (o.size ?? 13) * FONT_SCALE;
  return el(
    "text",
    {
      x,
      y: y + size * 0.36,
      "font-size": Math.round(size * 10) / 10,
      "text-anchor": o.anchor ?? "middle",
      "font-weight": o.weight && o.weight !== 400 ? o.weight : undefined,
      "font-style": o.italic ? "italic" : undefined,
      fill: o.fill ?? INK,
      stroke: "none",
    },
    esc(s),
  );
}

/** Several lines, the block's vertical centre at y. */
export function textBlock(x: number, y: number, lines: string[], o: TextOpts = {}, lineHeight = 1.3): string {
  const size = o.size ?? 13;
  const step = size * FONT_SCALE * lineHeight;
  const top = y - (step * lines.length) / 2;
  return lines.map((l, i) => text(x, top + step * (i + 0.5), l, o)).join("");
}

/** Greedy word wrap (CJK wraps per character). */
export function wrap(s: string, maxW: number, size = 13, weight = 400): string[] {
  const out: string[] = [];
  for (const para of s.split("\n")) {
    // CJK wraps per character; never break before a unit such as "°C".
    const tokens = /[\u2e80-\uffff]/.test(para) ? [...para] : para.split(/(?<= )(?![°%])/);
    let cur = "";
    for (const t of tokens) {
      const next = cur + t;
      if (cur && textWidth(next.trimEnd(), size, weight) > maxW) {
        out.push(cur.trimEnd());
        cur = t.trimStart();
      } else cur = next;
    }
    out.push(cur.trimEnd());
  }
  return out;
}

export interface PillOpts extends TextOpts {
  padX?: number;
  padY?: number;
  bg?: string;
  stroke?: string;
  r?: number;
  minW?: number;
  strokeWidth?: number;
}

/** A rounded label box centred on (cx, cy). */
export function pill(cx: number, cy: number, s: string, o: PillOpts = {}): { body: string; w: number; h: number } {
  const size = o.size ?? 13;
  const w = Math.max(o.minW ?? 0, textWidth(s, size, o.weight) + 2 * (o.padX ?? 8));
  const h = size * FONT_SCALE + 2 * (o.padY ?? 5);
  const body =
    rect(cx - w / 2, cy - h / 2, w, h, {
      rx: o.r ?? Math.min(8, h / 2),
      fill: o.bg ?? PAPER,
      stroke: o.stroke ?? INK,
      "stroke-width": o.strokeWidth ?? 1.6,
    }) + (s ? text(cx, cy, s, { ...o, size }) : "");
  return { body, w, h };
}

// ─── Arrows ───────────────────────────────────────────────────────────────────────────────
export interface ArrowOpts {
  head?: number;
  both?: boolean;
  color?: string;
  width?: number;
  dash?: string;
}

function headAt(x: number, y: number, ang: number, head: number, color: string): string {
  const bx = x - Math.cos(ang) * head;
  const by = y - Math.sin(ang) * head;
  const nx = -Math.sin(ang) * head * 0.45;
  const ny = Math.cos(ang) * head * 0.45;
  return poly(
    [
      [x, y],
      [bx + nx, by + ny],
      [bx - nx, by - ny],
    ],
    { fill: color, stroke: color, "stroke-width": 1 },
  );
}

/** A straight arrow from (x1, y1) to (x2, y2) with a solid head (no <marker>, so no ids). */
export function arrow(x1: number, y1: number, x2: number, y2: number, o: ArrowOpts = {}): string {
  const head = o.head ?? 8;
  const color = o.color ?? INK;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const cut = head * 0.8;
  const sx = o.both ? x1 + Math.cos(ang) * cut : x1;
  const sy = o.both ? y1 + Math.sin(ang) * cut : y1;
  return (
    line(sx, sy, x2 - Math.cos(ang) * cut, y2 - Math.sin(ang) * cut, {
      stroke: color,
      "stroke-width": o.width ?? 1.8,
      "stroke-dasharray": o.dash,
    }) +
    headAt(x2, y2, ang, head, color) +
    (o.both ? headAt(x1, y1, ang + Math.PI, head, color) : "")
  );
}

/** An arrowhead at the end of a curve whose last tangent points along `ang` (radians). */
export function arrowHead(x: number, y: number, ang: number, head = 8, color = INK): string {
  return headAt(x, y, ang, head, color);
}

/** Point where a ray from the centre of a w×h box towards (dx, dy) leaves the box, plus a margin. */
export function boxExit(cx: number, cy: number, w: number, h: number, dx: number, dy: number, margin = 4): [number, number] {
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const tx = ux === 0 ? Infinity : w / 2 / Math.abs(ux);
  const ty = uy === 0 ? Infinity : h / 2 / Math.abs(uy);
  const t = Math.min(tx, ty) + margin;
  return [cx + ux * t, cy + uy * t];
}

// ─── Fills without patterns ───────────────────────────────────────────────────────────────
/** Clip a segment to a rectangle (Liang–Barsky); null when it misses. */
function clipSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): [number, number, number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const checks: [number, number][] = [
    [-dx, x1 - rx],
    [dx, rx + rw - x1],
    [-dy, y1 - ry],
    [dy, ry + rh - y1],
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const t = q / p;
      if (p < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
    }
  }
  if (t0 > t1) return null;
  return [x1 + dx * t0, y1 + dy * t0, x1 + dx * t1, y1 + dy * t1];
}

/**
 * Hatch a rectangle with plain lines or dots. Style letters: "/" and "\\" diagonals,
 * "x" both, "-" horizontal, "|" vertical, "." dots.
 */
export function hatch(x: number, y: number, w: number, h: number, style: string, gap = 7, color = SOFT): string {
  const a = { stroke: color, "stroke-width": 1 };
  const out: string[] = [];
  if (style.includes(".")) {
    for (let yy = y + gap / 2; yy < y + h; yy += gap)
      for (let xx = x + gap / 2 + ((Math.round((yy - y) / gap) % 2) * gap) / 2; xx < x + w; xx += gap)
        out.push(circle(xx, yy, 1.1, { fill: color, stroke: "none" }));
    return out.join("");
  }
  const diag = (dir: 1 | -1) => {
    for (let t = -h; t < w + h; t += gap) {
      const seg = dir === 1 ? clipSegment(x + t, y + h, x + t + h, y, x, y, w, h) : clipSegment(x + t, y, x + t + h, y + h, x, y, w, h);
      if (seg) out.push(line(...seg, a));
    }
  };
  if (style.includes("/") || style.includes("x")) diag(1);
  if (style.includes("\\") || style.includes("x")) diag(-1);
  if (style.includes("-")) for (let yy = y + gap / 2; yy < y + h; yy += gap) out.push(line(x, yy, x + w, yy, a));
  if (style.includes("|")) for (let xx = x + gap / 2; xx < x + w; xx += gap) out.push(line(xx, y, xx, y + h, a));
  return out.join("");
}

/** Ground or ceiling: a line with short slanted strokes on one side. */
export function groundLine(x1: number, x2: number, y: number, side: "below" | "above" = "below", label?: string): string {
  const dir = side === "below" ? 1 : -1;
  let out = line(x1, y, x2, y, { stroke: INK, "stroke-width": 2 });
  for (let x = x1 + 6; x < x2; x += 10) out += line(x, y, x - 6, y + 7 * dir, { stroke: SOFT, "stroke-width": 1 });
  if (label) out += text(x2 - 4, y + 18 * dir, label, { size: 12, anchor: "end", fill: SOFT });
  return out;
}

/** Spread label centres so neighbours are at least `minGap` apart, keeping the order. */
export function spread(ys: number[], minGap: number, lo = -Infinity, hi = Infinity): number[] {
  const order = ys.map((y, i) => [y, i] as const).sort((a, b) => a[0] - b[0]);
  const out = order.map(([y]) => y);
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + minGap);
  if (out.length && out[out.length - 1] > hi) {
    out[out.length - 1] = hi;
    for (let i = out.length - 2; i >= 0; i--) out[i] = Math.min(out[i], out[i + 1] - minGap);
  }
  if (out.length && out[0] < lo) {
    out[0] = lo;
    for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + minGap);
  }
  const res = new Array<number>(ys.length);
  order.forEach(([, i], k) => (res[i] = out[k]));
  return res;
}

/** A label at (tx, ty) with a thin leader line to the point (px, py). */
export function callout(tx: number, ty: number, px: number, py: number, s: string, o: TextOpts = {}): string {
  const size = o.size ?? 12.5;
  const anchor = o.anchor ?? (tx < px ? "end" : "start");
  const w = textWidth(s, size, o.weight);
  const x0 = anchor === "end" ? tx - w : anchor === "middle" ? tx - w / 2 : tx;
  const x1 = x0 + w;
  // Leave from the side of the label nearest the point, or from above/below it.
  const [lx, ly] = px > x1 + 4 ? [x1 + 4, ty] : px < x0 - 4 ? [x0 - 4, ty] : [Math.max(x0, Math.min(x1, px)), py > ty ? ty + size * 0.75 : ty - size * 0.75];
  return line(lx, ly, px, py, { stroke: SOFT, "stroke-width": 1.1 }) + circle(px, py, 1.8, { fill: SOFT, stroke: "none" }) + text(tx, ty, s, { ...o, size, anchor });
}

export const blank = (): Drawing => ({ w: 0, h: 0, body: "", alt: "" });

/** What a kind renderer gets besides its spec: a way to draw nested diagrams (rows of icons, etc.). */
export interface Ctx {
  render(d: Spec): Drawing;
}
export type Renderer = (d: Spec, ctx: Ctx) => Drawing;
