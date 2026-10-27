// compass: a compass beside a bar magnet. { angle (degrees clockwise from up, for the dark north-seeking end),
//   magnet: "right" | "left", magnet_labels: [near end, far end] }
import { INK, PAPER, circle, line, list, num, poly, str, type Renderer } from "../svg.ts";
import { barMagnet } from "./magnet-parts.ts";

const DIRS = ["up", "up and to the right", "to the right", "down and to the right", "down", "down and to the left", "to the left", "up and to the left"];

export const compass: Renderer = (d) => {
  const angle = num(d.angle, 0);
  const side = str(d.magnet, "right") === "left" ? "left" : "right";
  const [near = "N", far = "S"] = list(d.magnet_labels).map((l) => str(l));
  const W = 200;
  const H = 100;
  const cx = side === "right" ? 52 : W - 52;
  const cy = 50;
  const r = 36;
  const parts: string[] = [circle(cx, cy, r, { fill: PAPER, stroke: INK, "stroke-width": 2 })];
  for (let k = 0; k < 8; k++) {
    const a = (k * 45 * Math.PI) / 180;
    const r1 = k % 2 ? r - 4 : r - 7;
    parts.push(line(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1, cx + Math.sin(a) * r, cy - Math.cos(a) * r, { stroke: INK, "stroke-width": 1.2 }));
  }
  const a = (angle * Math.PI) / 180;
  const tip = (len: number): [number, number] => [cx + Math.sin(a) * len, cy - Math.cos(a) * len];
  const side8 = (w: number): [number, number] => [cx + Math.cos(a) * w, cy + Math.sin(a) * w];
  const [nx, ny] = tip(28);
  const [sx, sy] = tip(-28);
  const [lx, ly] = side8(6);
  const [rx, ry] = side8(-6);
  parts.push(poly([[nx, ny], [lx, ly], [rx, ry]], { fill: INK, stroke: INK, "stroke-width": 1.2 }));
  parts.push(poly([[sx, sy], [lx, ly], [rx, ry]], { fill: PAPER, stroke: INK, "stroke-width": 1.2 }));
  parts.push(circle(cx, cy, 2.6, { fill: PAPER, stroke: INK, "stroke-width": 1.2 }));
  const mx = side === "right" ? 106 : 10;
  parts.push(barMagnet(mx, cy - 13, 84, 26, { labels: side === "right" ? [near, far] : [far, near] }));
  const dir = DIRS[Math.round((((angle % 360) + 360) % 360) / 45) % 8];
  return {
    w: W,
    h: H,
    body: parts.join(""),
    alt: `A compass to the ${side === "right" ? "left" : "right"} of a bar magnet whose ${near} end is nearest the compass. The dark end of the needle points ${dir}.`,
  };
};
