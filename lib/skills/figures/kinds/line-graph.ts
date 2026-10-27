// line_graph: { w, h (aspect only), xlabel, ylabel, series: [{ label, x[], y[], style: "-" | ":" | "--" | "-." }],
//   xticks?, yticks?, ylim?, vlines?, hlines?, hide_numbers?, end_labels? (default true), legend? }
// When every series label ends in a group such as "(tank X)", each group gets its own small graph.
import { FAINT, INK, SOFT, line, list, num, obj, path, pd, place, spread, str, text, type Drawing, type Renderer } from "../svg.ts";

interface Series {
  label: string;
  xs: number[];
  ys: number[];
  dash?: string;
}

const DASH: Record<string, string | undefined> = { "-": undefined, ":": "2 4", "--": "8 5", "-.": "9 4 2 4" };

interface Axes {
  w: number;
  h: number;
  title?: string;
  xlabel: string;
  ylabel: string;
  series: Series[];
  xr: [number, number];
  yr: [number, number];
  xticks: number[];
  yticks: number[];
  vlines: number[];
  hlines: number[];
  numbers: boolean;
  endLabels: boolean;
}

function axes(a: Axes): Drawing {
  const left = a.numbers && a.yticks.length ? 40 : 16;
  const right = a.endLabels ? 46 : 12;
  const top = (a.title ? 22 : 0) + (a.ylabel ? 24 : 8);
  const bottom = (a.numbers && a.xticks.length ? 20 : 6) + (a.xlabel ? 22 : 4);
  const X = (x: number) => left + ((x - a.xr[0]) / (a.xr[1] - a.xr[0] || 1)) * (a.w - left - right);
  const Y = (y: number) => a.h - bottom - ((y - a.yr[0]) / (a.yr[1] - a.yr[0] || 1)) * (a.h - top - bottom);
  const x0 = X(a.xr[0]);
  const x1 = X(a.xr[1]);
  const y0 = Y(a.yr[0]);
  const y1 = Y(a.yr[1]);
  const parts: string[] = [];
  if (a.title) parts.push(text((x0 + x1) / 2, 9, a.title, { size: 13.5, weight: 700 }));
  for (const t of a.yticks) {
    if (t !== a.yr[0]) parts.push(line(x0, Y(t), x1, Y(t), { stroke: FAINT, "stroke-width": 1 }));
    parts.push(line(x0 - 4, Y(t), x0, Y(t), { stroke: INK, "stroke-width": 1.3 }));
    if (a.numbers) parts.push(text(x0 - 7, Y(t), String(t), { size: 12, anchor: "end" }));
  }
  for (const t of a.xticks) {
    parts.push(line(X(t), y0, X(t), y0 + 4, { stroke: INK, "stroke-width": 1.3 }));
    if (a.numbers) parts.push(text(X(t), y0 + 13, String(t), { size: 12 }));
  }
  for (const v of a.vlines) parts.push(line(X(v), y0, X(v), y1, { stroke: SOFT, "stroke-width": 1.2, "stroke-dasharray": "4 4" }));
  for (const v of a.hlines) parts.push(line(x0, Y(v), x1, Y(v), { stroke: SOFT, "stroke-width": 1.2, "stroke-dasharray": "4 4" }));
  for (const s of a.series) {
    const d = s.xs.map((x, i) => pd(i ? "L" : "M", X(x), Y(s.ys[i] ?? 0))).join(" ");
    parts.push(path(d, { fill: "none", stroke: INK, "stroke-width": 2.2, "stroke-dasharray": s.dash }));
  }
  if (a.endLabels) {
    const ends = a.series.map((s) => Y(s.ys[s.ys.length - 1] ?? 0));
    const ys = spread(ends, 15, y1, y0);
    a.series.forEach((s, i) => {
      const ex = X(s.xs[s.xs.length - 1] ?? 0);
      parts.push(text(ex + 8, ys[i], s.label, { size: 13, anchor: "start", weight: 700 }));
    });
  }
  parts.push(line(x0, y1 - 6, x0, y0, { stroke: INK, "stroke-width": 1.8 }));
  parts.push(line(x0, y0, x1 + 6, y0, { stroke: INK, "stroke-width": 1.8 }));
  if (a.ylabel) parts.push(text(Math.max(4, x0 - (a.numbers ? 30 : 10)), (a.title ? 22 : 0) + 9, a.ylabel, { size: 12.5, anchor: "start", weight: 600 }));
  if (a.xlabel) parts.push(text((x0 + x1) / 2, a.h - 9, a.xlabel, { size: 12.5, weight: 600 }));
  return { w: a.w, h: a.h, body: parts.join(""), alt: "" };
}

const trend = (s: Series) => {
  const a = s.ys[0] ?? 0;
  const b = s.ys[s.ys.length - 1] ?? 0;
  const word = b > a ? "rises" : b < a ? "falls" : "stays level";
  return `${s.label || "the line"} ${word}`;
};

export const lineGraph: Renderer = (d) => {
  const series: Series[] = list(d.series).map(obj).map((s) => ({
    label: str(s.label),
    xs: list(s.x).map((v) => num(v, 0)),
    ys: list(s.y).map((v) => num(v, 0)),
    dash: DASH[str(s.style, "-")],
  }));
  const allX = series.flatMap((s) => s.xs);
  const allY = series.flatMap((s) => s.ys);
  const xticks = list(d.xticks).map((v) => num(v, 0));
  const yticks = list(d.yticks).map((v) => num(v, 0));
  const ylim = list(d.ylim).map((v) => num(v, 0));
  const xr: [number, number] = [Math.min(...allX, ...xticks), Math.max(...allX, ...xticks)];
  const yr: [number, number] = ylim.length === 2 ? [ylim[0], ylim[1]] : [Math.min(0, ...allY), Math.max(...allY, ...yticks) * 1.12];
  const numbers = d.hide_numbers !== true;
  const endLabels = d.end_labels !== false && series.some((s) => s.label);
  const aspect = num(d.h, 3) / num(d.w, 5.4);
  const W = 400;
  const H = Math.max(200, Math.min(270, W * aspect + 40));
  const base = {
    xlabel: str(d.xlabel),
    ylabel: str(d.ylabel),
    xr,
    yr,
    xticks,
    yticks,
    vlines: list(d.vlines).map((v) => num(v, 0)),
    hlines: list(d.hlines).map((v) => num(v, 0)),
    numbers,
    endLabels,
  };

  // Small multiples when each label names its group, e.g. "J (tank X)".
  const grouped = series.map((s) => /^(.*?)\s*\(([^)]+)\)$/.exec(s.label));
  const groups = [...new Set(grouped.map((g) => g?.[2] ?? ""))];
  if (series.length > 1 && grouped.every(Boolean) && groups.length > 1) {
    const pw = Math.floor((W + 20) / groups.length) - 8;
    const panels = groups.map((g) => {
      const mine = series.filter((_, i) => grouped[i]?.[2] === g).map((s) => ({ ...s, label: /^(.*?)\s*\(/.exec(s.label)?.[1] ?? s.label }));
      return { g, draw: axes({ ...base, w: pw, h: H, title: g.charAt(0).toUpperCase() + g.slice(1), series: mine }), mine };
    });
    return {
      w: panels.length * (pw + 16) - 16,
      h: H,
      body: panels.map((p, i) => place(p.draw, i * (pw + 16), 0)).join(""),
      alt: `Line graphs of ${base.ylabel.toLowerCase() || "values"} against ${base.xlabel.toLowerCase() || "x"}. ${panels.map((p) => `${p.g}: ${p.mine.map(trend).join(", ")}`).join(". ")}.`,
    };
  }
  const draw = axes({ ...base, w: W, h: H, series });
  const readable = numbers && yticks.length > 0;
  const lines = series.map((s) => (readable ? `${s.label ? `${s.label}: ` : ""}${s.xs.map((x, i) => `(${x}, ${s.ys[i]})`).join(", ")}` : trend(s))).join("; ");
  return { ...draw, alt: `A line graph of ${base.ylabel.toLowerCase() || "values"} against ${base.xlabel.toLowerCase() || "x"}${readable ? ", through the points" : ""}: ${lines}.` };
};
