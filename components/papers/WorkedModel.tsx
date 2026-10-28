// The model a Singapore primary answer sheet draws for a word problem: bars of units with shaded extras, dashed
// parts that are gone, brackets for a known stretch and a brace for the total (the MOE bar-model method), or a time
// line with jumps. Drawn from data (lib/types.ts WorkedModel) as plain SVG, so it prints sharp and no model-made
// markup is ever rendered (rule 4). Black lines on white, like the papers' other figures.
import type { ModelPanel, WorkedModel } from "@/lib/types";

const INK = "#111";
const MUTED = "#555";
const LABEL_W = 92;
const BAR_W = 330;
const BAR_H = 26;
const MARK_H = 26;
const TITLE_H = 22;
const TOTAL_W = 96;

/** A vertical curly brace from y1 to y2 at x, opening to the left. */
function brace(x: number, y1: number, y2: number) {
  const m = (y1 + y2) / 2;
  const d = 7;
  return `M ${x} ${y1} q ${d} 0 ${d} ${d} V ${m - d} q 0 ${d} ${d} ${d} q ${-d} 0 ${-d} ${d} V ${y2 - d} q 0 ${d} ${-d} ${d}`;
}

function Bars({ panels }: { panels: ModelPanel[] }) {
  const widest = Math.max(...panels.flatMap((p) => p.bars.map((b) => b.parts.reduce((s, x) => s + x.w, 0))));
  const u = BAR_W / widest;
  const hasTotal = panels.some((p) => p.total);
  const width = LABEL_W + BAR_W + (hasTotal ? TOTAL_W : 16);
  const out: React.ReactNode[] = [];
  let y = 4;
  panels.forEach((panel, pi) => {
    if (panel.title) {
      out.push(
        <text key={`t${pi}`} x={0} y={y + 15} fontSize={13} fontWeight={700} fill={INK}>
          {panel.title}
        </text>,
      );
      y += TITLE_H;
    }
    const rows: { top: number; len: number }[] = [];
    panel.bars.forEach((bar, bi) => {
      const above = (panel.marks ?? []).some((m) => m.bar === bi && (m.side ?? "above") === "above");
      const below = (panel.marks ?? []).some((m) => m.bar === bi && m.side === "below");
      if (above) y += MARK_H;
      const top = y;
      let x = LABEL_W;
      out.push(
        <text key={`l${pi}-${bi}`} x={LABEL_W - 10} y={top + BAR_H / 2 + 4.5} fontSize={13} fontWeight={700} textAnchor="end" fill={INK}>
          {bar.label}
        </text>,
      );
      bar.parts.forEach((part, k) => {
        const w = part.w * u;
        const tone = part.tone ?? "unit";
        out.push(
          <rect
            key={`r${pi}-${bi}-${k}`}
            x={x}
            y={top}
            width={w}
            height={BAR_H}
            fill={tone === "extra" ? "#E4E4E7" : "#fff"}
            stroke={tone === "ghost" ? MUTED : INK}
            strokeWidth={1.4}
            strokeDasharray={tone === "ghost" ? "4 3" : undefined}
          />,
        );
        if (part.text) {
          const size = Math.min(12, Math.max(9, (w - 4) / Math.max(1, part.text.length * 0.56)));
          out.push(
            <text key={`p${pi}-${bi}-${k}`} x={x + w / 2} y={top + BAR_H / 2 + size * 0.36} fontSize={size} textAnchor="middle" fill={tone === "ghost" ? MUTED : INK}>
              {part.text}
            </text>,
          );
        }
        x += w;
      });
      rows.push({ top, len: x - LABEL_W });
      y += BAR_H + (below ? MARK_H : 10);
      for (const m of panel.marks ?? []) {
        if (m.bar !== bi) continue;
        const x1 = LABEL_W + m.from * u;
        const x2 = LABEL_W + m.to * u;
        const side = m.side ?? "above";
        const ly = side === "above" ? top - 8 : top + BAR_H + 8;
        const tick = side === "above" ? 5 : -5;
        const ty = side === "above" ? ly - 5 : ly + 14;
        out.push(
          <g key={`m${pi}-${bi}-${m.from}-${m.to}`}>
            <path d={`M ${x1} ${ly + tick} V ${ly} H ${x2} V ${ly + tick}`} fill="none" stroke={INK} strokeWidth={1.2} />
            <text x={(x1 + x2) / 2} y={ty} fontSize={11.5} fontWeight={700} textAnchor="middle" fill={INK}>
              {m.text}
            </text>
          </g>,
        );
      }
    });
    if (panel.total) {
      const from = rows[panel.total.from ?? 0];
      const to = rows[panel.total.to ?? rows.length - 1];
      const x = LABEL_W + Math.max(...rows.map((r) => r.len)) + 8;
      out.push(
        <g key={`T${pi}`}>
          <path d={brace(x, from.top, to.top + BAR_H)} fill="none" stroke={INK} strokeWidth={1.3} />
          <text x={x + 14} y={(from.top + to.top + BAR_H) / 2 + 4.5} fontSize={13} fontWeight={700} fill={INK}>
            {panel.total.text}
          </text>
        </g>,
      );
    }
    y += pi < panels.length - 1 ? 10 : 0;
  });
  return { width, height: y + 2, out };
}

function Timeline({ ticks, jumps }: { ticks: { at: number; label: string }[]; jumps: { from: number; to: number; text: string }[] }) {
  const span = Math.max(...ticks.map((t) => t.at), ...jumps.map((j) => j.to));
  const left = 36;
  const right = 36;
  const W = 440;
  const x = (at: number) => left + (at / span) * (W - left - right);
  const lineY = 66;
  const out: React.ReactNode[] = [
    <path key="line" d={`M ${left - 14} ${lineY} H ${W - right + 14}`} stroke={INK} strokeWidth={1.4} markerEnd="url(#wm-arrow)" fill="none" />,
  ];
  for (const t of ticks)
    out.push(
      <g key={`k${t.at}`}>
        <path d={`M ${x(t.at)} ${lineY - 6} V ${lineY + 6}`} stroke={INK} strokeWidth={1.4} />
        <text x={x(t.at)} y={lineY + 22} fontSize={12.5} fontWeight={700} textAnchor="middle" fill={INK}>
          {t.label}
        </text>
      </g>,
    );
  jumps.forEach((j, i) => {
    const x1 = x(j.from);
    const x2 = x(j.to);
    const h = Math.min(34, 14 + (x2 - x1) / 6);
    out.push(
      <g key={`j${i}`}>
        <path d={`M ${x1} ${lineY - 6} Q ${(x1 + x2) / 2} ${lineY - 6 - h * 2} ${x2} ${lineY - 6}`} fill="none" stroke={INK} strokeWidth={1.2} markerEnd="url(#wm-arrow)" />
        <text x={(x1 + x2) / 2} y={lineY - 10 - h} fontSize={11.5} fontWeight={700} textAnchor="middle" fill={INK}>
          {j.text}
        </text>
      </g>,
    );
  });
  return { width: W, height: lineY + 30, out };
}

export function WorkedModelFigure({ model, label = "Model" }: { model: WorkedModel; label?: string }) {
  const drawn = model.kind === "bars" ? Bars({ panels: model.panels }) : Timeline(model);
  const desc =
    model.kind === "bars"
      ? model.panels.map((p) => `${p.title ? `${p.title}: ` : ""}${p.bars.map((b) => `${b.label} ${b.parts.map((x) => x.text ?? `${x.w} units`).join(" + ")}`).join("; ")}${p.total ? `; total ${p.total.text}` : ""}`).join(". ")
      : `Time line: ${model.ticks.map((t) => t.label).join(", ")}; ${model.jumps.map((j) => j.text).join(", ")}`;
  return (
    <svg viewBox={`0 0 ${drawn.width} ${drawn.height}`} width="100%" style={{ maxWidth: `${drawn.width * 0.26}mm`, display: "block" }} role="img" aria-label={`${label}. ${desc}`}>
      <defs>
        <marker id="wm-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={INK} />
        </marker>
      </defs>
      {drawn.out}
    </svg>
  );
}
