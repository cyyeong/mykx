// bar_graph (P3): { categories, series: [{ name, values, fill }], ylabel, xlabel, ymax, ystep, w, h }
// bar_chart (P6): { categories, values, ylabel, hide_numbers, ylim: [lo, hi], yticks? }
import { FAINT, INK, SHADE, line, list, num, obj, rect, str, text, textBlock, wrap, type Drawing, type Renderer } from "../svg.ts";

const BAR_DARK = "#3d4a5c";

interface Bars {
  categories: string[];
  series: { name: string; values: number[]; dark: boolean }[];
  ylabel: string;
  xlabel: string;
  ymax: number;
  ticks: number[];
  numbers: boolean;
  w: number;
  h: number;
}

function drawBars(b: Bars): Drawing {
  const { w, h } = b;
  const left = b.numbers ? 40 : 18;
  const right = 10;
  const top = b.ylabel ? 28 : 10;
  const catLines = b.categories.map((c) => wrap(c, Math.max(40, (w - left - right) / Math.max(1, b.categories.length) - 6), 12.5));
  const catH = Math.max(1, ...catLines.map((l) => l.length)) * 15;
  const bottom = 8 + catH + (b.xlabel ? 22 : 4);
  const x0 = left;
  const x1 = w - right;
  const y0 = h - bottom;
  const y1 = top;
  const sy = (v: number) => y0 - ((y0 - y1) * v) / (b.ymax || 1);
  const parts: string[] = [];
  for (const t of b.ticks) {
    if (t > 0) parts.push(line(x0, sy(t), x1, sy(t), { stroke: FAINT, "stroke-width": 1 }));
    if (b.numbers) parts.push(text(x0 - 6, sy(t), String(t), { size: 12, anchor: "end" }));
    parts.push(line(x0 - 4, sy(t), x0, sy(t), { stroke: INK, "stroke-width": 1.4 }));
  }
  const n = Math.max(1, b.categories.length);
  const slot = (x1 - x0) / n;
  const k = Math.max(1, b.series.length);
  const bw = Math.min(46, (slot * 0.6) / k);
  b.categories.forEach((_, i) => {
    const cx = x0 + slot * (i + 0.5);
    b.series.forEach((s, j) => {
      const v = s.values[i] ?? 0;
      const bx = cx - (bw * k) / 2 + j * bw;
      if (v > 0) parts.push(rect(bx, sy(v), bw, y0 - sy(v), { fill: s.dark ? BAR_DARK : SHADE, stroke: INK, "stroke-width": 1.2 }));
    });
    parts.push(textBlock(cx, y0 + 8 + (catLines[i].length * 15) / 2, catLines[i], { size: 12.5 }, 1.2));
  });
  parts.push(line(x0, y1 - 6, x0, y0, { stroke: INK, "stroke-width": 1.8 }));
  parts.push(line(x0, y0, x1, y0, { stroke: INK, "stroke-width": 1.8 }));
  if (b.ylabel) parts.push(text(x0 - (b.numbers ? 30 : 8), 9, b.ylabel, { size: 12.5, anchor: "start", weight: 600 }));
  if (b.xlabel) parts.push(text((x0 + x1) / 2, h - 10, b.xlabel, { size: 12.5, weight: 600 }));
  const values = b.categories.map((c, i) => (b.numbers ? `${c} ${b.series.map((s) => s.values[i]).join("/")}` : c)).join(", ");
  return {
    w,
    h,
    body: parts.join(""),
    alt: `A bar graph of ${b.ylabel || "values"}${b.xlabel ? ` for each ${b.xlabel.toLowerCase()}` : ""}: ${values}.${b.numbers ? "" : " The scale has no numbers."}`,
  };
}

const ticksFor = (max: number, step: number) => {
  const out: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += step) out.push(Math.round(t * 1000) / 1000);
  return out;
};

export const barGraph: Renderer = (d) => {
  const series = list(d.series).map(obj).map((s) => ({ name: str(s.name), values: list(s.values).map((v) => num(v, 0)), dark: str(s.fill, "dark") === "dark" }));
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ymax = num(d.ymax, Math.ceil(max * 1.2));
  const ystep = num(d.ystep, Math.max(1, Math.round(ymax / 6)));
  return drawBars({
    categories: list(d.categories).map((c) => str(c)),
    series,
    ylabel: str(d.ylabel),
    xlabel: str(d.xlabel),
    ymax,
    ticks: ticksFor(ymax, ystep),
    numbers: d.hide_numbers !== true,
    w: num(d.w, 340),
    h: num(d.h, 200),
  });
};

export const barChart: Renderer = (d) => {
  const values = list(d.values).map((v) => num(v, 0));
  const ylim = list(d.ylim).map((v) => num(v, 0));
  const yticks = list(d.yticks).map((v) => num(v, 0));
  const numbers = d.hide_numbers !== true;
  const ymax = ylim[1] ?? Math.ceil(Math.max(1, ...values) * 1.2);
  return drawBars({
    categories: list(d.categories).map((c) => str(c)),
    series: [{ name: "", values, dark: true }],
    ylabel: str(d.ylabel),
    xlabel: str(d.xlabel),
    ymax,
    ticks: yticks.length ? yticks : numbers ? ticksFor(ymax, Math.max(1, Math.round(ymax / 5))) : [],
    numbers,
    w: num(d.w, 340),
    h: num(d.h, 210),
  });
};
