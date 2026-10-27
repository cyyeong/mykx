// Shared magnet drawings: bar magnets with labelled ends or parts, U-shaped magnets, steel clips.
import { INK, PAPER, line, path, pd, rect, text } from "../svg.ts";

export interface BarOpts {
  vertical?: boolean;
  /** End labels: [left, right] or, when vertical, [top, bottom]. "[]" draws an empty answer box. */
  labels?: string[];
  /** Equal parts along the bar, each with its letter (replaces the middle line). */
  parts?: string[];
  fill?: string;
  size?: number;
}

function endLabel(cx: number, cy: number, s: string, size: number): string {
  if (!s) return "";
  if (s === "[]") return rect(cx - 9, cy - 9, 18, 18, { rx: 2, fill: PAPER, stroke: INK, "stroke-width": 1.6 });
  return text(cx, cy, s, { size, weight: 700 });
}

/** A bar magnet whose top-left corner is (x, y); `len` along the bar, `thick` across it. */
export function barMagnet(x: number, y: number, len: number, thick: number, o: BarOpts = {}): string {
  const w = o.vertical ? thick : len;
  const h = o.vertical ? len : thick;
  const size = o.size ?? 14;
  let out = rect(x, y, w, h, { fill: o.fill ?? PAPER, stroke: INK, "stroke-width": 2 });
  const parts = o.parts ?? [];
  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i++) {
      const t = (len * i) / parts.length;
      out += o.vertical ? line(x, y + t, x + w, y + t, { stroke: INK, "stroke-width": 1.3, "stroke-dasharray": "4 3" }) : line(x + t, y, x + t, y + h, { stroke: INK, "stroke-width": 1.3, "stroke-dasharray": "4 3" });
    }
    parts.forEach((p, i) => {
      const t = (len * (i + 0.5)) / parts.length;
      out += o.vertical ? text(x + w / 2, y + t, p, { size, weight: 700 }) : text(x + t, y + h / 2, p, { size, weight: 700 });
    });
  } else {
    out += o.vertical ? line(x, y + h / 2, x + w, y + h / 2, { stroke: INK, "stroke-width": 1.3 }) : line(x + w / 2, y, x + w / 2, y + h, { stroke: INK, "stroke-width": 1.3 });
  }
  const [a = "", b = ""] = o.labels ?? [];
  const inset = Math.min(15, len / 6);
  if (o.vertical) {
    out += endLabel(x + w / 2, y + inset, a, size) + endLabel(x + w / 2, y + h - inset, b, size);
  } else {
    out += endLabel(x + inset, y + h / 2, a, size) + endLabel(x + w - inset, y + h / 2, b, size);
  }
  return out;
}

/** A U-shaped magnet in the box (x, y, w, h); `open` says which way the arm ends point. */
export function uMagnet(x: number, y: number, w: number, h: number, arm: number, open: "up" | "down", labels: string[] = []): string {
  const R = w / 2;
  const r = R - arm;
  let d: string;
  if (open === "down") {
    const cy = y + R;
    d = pd("M", x, y + h, "L", x, cy, "A", R, R, 0, 0, 1, x + w, cy, "L", x + w, y + h, "L", x + w - arm, y + h, "L", x + w - arm, cy, "A", r, r, 0, 0, 0, x + arm, cy, "L", x + arm, y + h, "Z");
  } else {
    const cy = y + h - R;
    d = pd("M", x, y, "L", x, cy, "A", R, R, 0, 0, 0, x + w, cy, "L", x + w, y, "L", x + w - arm, y, "L", x + w - arm, cy, "A", r, r, 0, 0, 1, x + arm, cy, "L", x + arm, y, "Z");
  }
  const ly = open === "down" ? y + h - 14 : y + 14;
  const [a = "", b = ""] = labels;
  const cut = open === "down" ? y + h - 28 : y + 28;
  return (
    path(d, { fill: PAPER, stroke: INK, "stroke-width": 2 }) +
    line(x, cut, x + arm, cut, { stroke: INK, "stroke-width": 1.3 }) +
    line(x + w - arm, cut, x + w, cut, { stroke: INK, "stroke-width": 1.3 }) +
    (a ? endLabel(x + arm / 2, ly, a, 14) : "") +
    (b ? endLabel(x + w - arm / 2, ly, b, 14) : "")
  );
}

/** A paper or steel clip lying flat, centred at (cx, cy), about 30 wide. */
export function clip(cx: number, cy: number, scale = 1, vertical = false): string {
  const s = scale;
  const d = vertical
    ? pd("M", cx - 3 * s, cy + 6 * s, "L", cx - 3 * s, cy - 10 * s, "A", 3 * s, 3 * s, 0, 0, 1, cx + 3 * s, cy - 10 * s, "L", cx + 3 * s, cy + 12 * s, "A", 5 * s, 5 * s, 0, 0, 1, cx - 7 * s, cy + 12 * s, "L", cx - 7 * s, cy - 13 * s, "A", 4 * s, 4 * s, 0, 0, 1, cx + 1 * s, cy - 13 * s)
    : pd("M", cx + 6 * s, cy - 3 * s, "L", cx - 10 * s, cy - 3 * s, "A", 3 * s, 3 * s, 0, 0, 0, cx - 10 * s, cy + 3 * s, "L", cx + 12 * s, cy + 3 * s, "A", 5 * s, 5 * s, 0, 0, 0, cx + 12 * s, cy - 7 * s, "L", cx - 13 * s, cy - 7 * s, "A", 4 * s, 4 * s, 0, 0, 0, cx - 13 * s, cy + 1 * s);
  return path(d, { fill: "none", stroke: INK, "stroke-width": 1.6 });
}
