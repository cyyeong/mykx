// light_test: torch → sheet of material → light sensor. { material_label }
import { INK, PAPER, SHADE, SOFT, circle, line, path, pd, rect, str, text, type Renderer } from "../svg.ts";

export const lightTest: Renderer = (d) => {
  const material = str(d.material_label, "sheet of material");
  const W = 380;
  const H = 128;
  const cy = 62;
  const ray = { stroke: SOFT, "stroke-width": 1.4, "stroke-dasharray": "5 4" };
  const parts = [
    // torch
    rect(16, cy - 13, 54, 26, { rx: 5, fill: SHADE, stroke: INK, "stroke-width": 1.8 }),
    path(pd("M", 70, cy - 13, "L", 88, cy - 22, "L", 88, cy + 22, "L", 70, cy + 13, "Z"), { fill: PAPER, stroke: INK, "stroke-width": 1.8 }),
    rect(34, cy - 18, 12, 5, { rx: 1.5, fill: INK }),
    text(52, cy + 36, "torch", { size: 12.5 }),
    // light
    line(94, cy - 14, 196, cy - 26, ray),
    line(94, cy, 196, cy, ray),
    line(94, cy + 14, 196, cy + 26, ray),
    line(212, cy - 10, 286, cy - 6, ray),
    line(212, cy, 286, cy, ray),
    line(212, cy + 10, 286, cy + 6, ray),
    // sheet
    rect(198, cy - 44, 10, 88, { fill: SHADE, stroke: INK, "stroke-width": 1.8 }),
    text(203, 8, material, { size: 12.5 }),
    // sensor
    rect(288, cy - 20, 62, 40, { rx: 6, fill: PAPER, stroke: INK, "stroke-width": 1.8 }),
    circle(292, cy, 6, { fill: SHADE, stroke: INK, "stroke-width": 1.4 }),
    line(305, cy - 8, 340, cy - 8, { stroke: INK, "stroke-width": 1 }),
    line(305, cy, 334, cy, { stroke: INK, "stroke-width": 1 }),
    text(319, cy + 36, "light sensor", { size: 12.5 }),
  ];
  return { w: W, h: H, body: parts.join(""), alt: `A torch shines through a ${material} onto a light sensor.` };
};
