// bowl_test: a bowl of one material over a container; water poured into the bowl may leak through.
// { label, collected: boolean }
import { ACCENT, INK, PAPER, TINT, callout, line, path, pd, rect, str, type Renderer } from "../svg.ts";

export const bowlTest: Renderer = (d) => {
  const label = str(d.label, "P");
  const collected = d.collected === true;
  const W = 330;
  const cx = 165;
  const rim = 70;
  const parts: string[] = [];
  // container
  parts.push(path(pd("M", cx - 52, rim + 4, "L", cx - 52, 182, "L", cx + 52, 182, "L", cx + 52, rim + 4), { fill: PAPER, stroke: INK, "stroke-width": 2.2 }));
  if (collected) {
    parts.push(rect(cx - 51, 160, 102, 21, { fill: TINT, stroke: "none" }));
    parts.push(line(cx - 51, 160, cx + 51, 160, { stroke: ACCENT, "stroke-width": 1.6 }));
  }
  // bowl sitting in the container's mouth, with water in it
  parts.push(path(pd("M", cx - 66, rim, "A", 66, 46, 0, 0, 0, cx + 66, rim, "Z"), { fill: PAPER, stroke: INK, "stroke-width": 2.2 }));
  parts.push(path(pd("M", cx - 52, rim + 16, "A", 66, 46, 0, 0, 0, cx + 52, rim + 16, "Z"), { fill: TINT, stroke: "none" }));
  parts.push(line(cx - 52, rim + 16, cx + 52, rim + 16, { stroke: ACCENT, "stroke-width": 1.6 }));
  parts.push(path(pd("M", cx - 66, rim, "A", 66, 46, 0, 0, 0, cx + 66, rim), { fill: "none", stroke: INK, "stroke-width": 2.2 }));
  parts.push(callout(30, 34, cx - 62, rim + 14, `bowl made of material ${label}`, { anchor: "start" }));
  parts.push(callout(250, 104, cx + 20, rim + 30, "water", { anchor: "start" }));
  parts.push(callout(250, 150, cx + 52, 150, "container", { anchor: "start" }));
  return {
    w: W,
    h: 190,
    body: parts.join(""),
    alt: `A bowl made of material ${label} holding water sits on top of a container${collected ? "; some water has dripped into the container" : ""}.`,
  };
};
