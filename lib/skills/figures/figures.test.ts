// The figure renderer: every kind draws what its spec says, output is static accessible SVG,
// and every figure_spec in the skill packs renders.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PENDING_NOTE, RENDERED_NOTE, figureName, withFigure } from "../../../scripts/render-figures.ts";
import { drawIcon } from "./icons.ts";
import { FigureError, figureKinds, figureTitle, normaliseSpec, renderDrawing, renderFigure } from "./index.ts";
import { KINDS } from "./kinds/index.ts";

const svgOf = (spec: unknown) => renderFigure(spec, { id: "test-1", title: "A test figure" });
const one = (d: Record<string, unknown>) => svgOf({ stem: [d] });
const count = (svg: string, re: RegExp) => (svg.match(new RegExp(re.source, "g")) ?? []).length;
/** Visible words: the text of every <text> element. */
const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
const desc = (svg: string) => /<desc[^>]*>([^<]*)<\/desc>/.exec(svg)?.[1] ?? "";

function wellFormed(svg: string): boolean {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    const [, close, name, self] = m;
    if (self) continue;
    if (close) {
      if (stack.pop() !== name) return false;
    } else stack.push(name);
  }
  return stack.length === 0;
}

function expectSafe(svg: string) {
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  expect(svg).toMatch(/ role="img"/);
  expect(svg).toMatch(/<title id="[^"]+">[^<]+<\/title>/);
  expect(svg).toMatch(/ viewBox="0 0 \d+ \d+"/);
  expect(svg).not.toMatch(/<script|foreignObject|href=|url\(|on[a-z]+="|<image|<style/i);
  expect(svg).not.toMatch(/NaN|undefined|Infinity/);
  expect(wellFormed(svg)).toBe(true);
}

describe("renderFigure", () => {
  it("makes a standalone, accessible, static SVG", () => {
    const svg = one({ kind: "beakers", beakers: [{ label: "P", level: 0.5 }] });
    expectSafe(svg);
    expect(svg).toMatch(/aria-labelledby="fig-test-1-title fig-test-1-desc"/);
    expect(desc(svg)).toContain("beaker P");
  });

  it("escapes text from the spec and the title", () => {
    const svg = renderFigure({ stem: [{ kind: "tree", root: "<b>&", children: [] }] }, { id: "x", title: 'a "quoted" <title>' });
    expect(svg).toContain("&lt;b&gt;&amp;");
    expect(svg).toContain("a &quot;quoted&quot; &lt;title&gt;");
    expectSafe(svg);
  });

  it("refuses unknown kinds and empty specs", () => {
    expect(() => one({ kind: "teleporter" })).toThrow(FigureError);
    expect(() => svgOf({})).toThrow(FigureError);
  });

  it("reads P3 `kind`, P6 `type`, posters, Chinese scenes and icon lists", () => {
    expect(normaliseSpec({ stem: [{ type: "circuit" }] }).stem[0].kind).toBe("circuit");
    expect(normaliseSpec({ poster: { title: "T" } }).stem[0].kind).toBe("poster");
    expect(normaliseSpec({ scene: { items: [] } }).stem[0].kind).toBe("picture");
    expect(normaliseSpec({ icons: ["handbag"] }).stem[0].kind).toBe("icon_set");
    expect(figureKinds({ stem: [{ kind: "row", items: [{ kind: "icon", icon: "frog" }] }], options: [{ kind: "compass" }] })).toEqual(["row", "icon", "compass"]);
  });

  it("draws option diagrams in a labelled 2×2 grid", () => {
    const svg = svgOf({ options: [1, 2, 3, 4].map((i) => ({ kind: "compass", angle: i * 90 })) });
    for (const i of [1, 2, 3, 4]) expect(texts(svg)).toContain(`Diagram ${i}`);
    expect(desc(svg)).toMatch(/Diagram 4: /);
  });

  it("keeps small figures on a canvas at least 320 wide", () => {
    expect(renderDrawing({ stem: [{ kind: "icon", icon: "seed", w: 40, h: 30 }] }).w).toBeGreaterThanOrEqual(320);
  });
});

describe("kinds", () => {
  it("has a renderer for every kind used in the packs", () => {
    for (const k of ["flowchart", "icon", "row", "container", "float_tank", "light_test", "bar_graph", "bar_chart", "life_cycle", "ring_stack", "stroke", "tree", "beakers", "magnet_layout", "electromagnet", "flex_test", "bowl_test", "germination", "strength_test", "magnet_distance", "magnets_table", "compass", "circuit", "line_graph", "spring_set", "scene", "flower", "food_web", "magnets", "poster", "picture", "icon_set"])
      expect(KINDS[k], k).toBeTypeOf("function");
  });

  it("flowchart: a box per question, the side answer to a letter, the other answer down", () => {
    const svg = one({ kind: "flowchart", start: "Animals", steps: [{ q: "Does it have feathers?", side: "Yes", out: "K" }, { q: "Does it have 6 legs?", side: "No", out: "Q" }], end: "N" });
    const t = texts(svg);
    expect(t).toEqual(expect.arrayContaining(["Animals", "Does it have feathers?", "Does it have 6 legs?", "K", "Q", "N"]));
    expect(t.filter((x) => x === "Yes")).toHaveLength(2); // side of step 1, and the way down from step 2
    expect(t.filter((x) => x === "No")).toHaveLength(2);
    expect(count(svg, /<polygon/)).toBe(5); // 2 side arrows + 3 down arrows
  });

  it("tree: root, headings and every item", () => {
    const t = texts(one({ kind: "tree", root: "Living things", children: [{ label: "X", children: [{ label: "", items: ["mushroom", "yeast"] }] }, { label: "Y", children: [{ label: "", items: ["moss"] }] }] }));
    expect(t).toEqual(expect.arrayContaining(["Living things", "X", "Y", "mushroom", "yeast", "moss"]));
  });

  it("icons: a spider has 8 legs and no feelers; an insect has 3 body parts and the legs asked for", () => {
    const legPaths = (name: string, params = {}) => count(drawIcon(name, params).body, /<path/);
    expect(legPaths("spider")).toBe(8);
    expect(legPaths("insect")).toBe(6 + 2); // legs + feelers
    expect(legPaths("insect", { legs: 8 })).toBe(8 + 2);
    expect(count(drawIcon("insect").body, /<(ellipse|circle)/)).toBe(3);
    expect(drawIcon("insect", { legs: 8 }).alt).toContain("8 legs");
    expect(drawIcon("no_such_icon").body).toContain("no such icon");
  });

  it("icon and row: captions under each picture", () => {
    const svg = one({ kind: "row", items: [{ kind: "icon", icon: "frog" }, { kind: "icon", icon: "tadpole" }, { kind: "icon", icon: "frogspawn" }], captions: ["F", "G", "H"] });
    expect(texts(svg)).toEqual(["F", "G", "H"]);
    expect(texts(one({ kind: "icon", icon: "spider", caption: "Animal Z" }))).toEqual(["Animal Z"]);
  });

  it("container: lid holes, supplies and its letter", () => {
    const holes = one({ kind: "container", lid: "holes", items: ["food", "water"], animal: "grasshopper", label: "J" });
    const solid = one({ kind: "container", lid: "solid", items: ["food"], animal: "grasshopper", label: "K" });
    expect(count(holes, /<circle [^>]*r="2.4"/)).toBe(5);
    expect(count(solid, /r="2.4"/)).toBe(0);
    expect(texts(holes)).toEqual(expect.arrayContaining(["food", "water", "J"]));
    expect(texts(solid)).not.toContain("water");
  });

  it("float_tank: floating blocks sit at the surface, sinking ones on the bottom", () => {
    const d = KINDS.float_tank({ objects: [{ label: "P", level: "float" }, { label: "Q", level: "sink" }] }, { render: () => { throw new Error(); } });
    const ys = [...d.body.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="42"/g)].map((m) => Number(m[1]));
    expect(ys).toHaveLength(2);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(d.alt).toContain("P floats");
  });

  it("light_test and bar_graph: apparatus labels, one bar per non-zero value, scale numbers", () => {
    const svg = svgOf({ stem: [{ kind: "light_test", material_label: "sheet of material" }, { kind: "bar_graph", categories: ["no material", "A", "B", "C"], series: [{ values: [10, 2, 9, 0], fill: "dark" }], ylabel: "Light", xlabel: "Material", ymax: 12, ystep: 2 }] });
    expect(texts(svg)).toEqual(expect.arrayContaining(["sheet of material", "torch", "light sensor", "Light", "Material", "12", "0"]));
    expect(count(svg, /fill="#3d4a5c"/)).toBe(3);
  });

  it("bar_chart: hide_numbers leaves the scale unnumbered", () => {
    const t = texts(one({ type: "bar_chart", categories: ["kinetic", "heat and sound"], values: [6, 1], ylabel: "Energy", hide_numbers: true, ylim: [0, 7] }));
    expect(t.some((x) => /^\d+$/.test(x))).toBe(false);
    expect(texts(one({ type: "bar_chart", categories: ["A", "D"], values: [2.3, 3.4], yticks: [0, 1, 2, 3, 4], ylim: [0, 4] }))).toEqual(expect.arrayContaining(["0", "4"]));
  });

  it("life_cycle: blank stages show an empty box, never the stage name", () => {
    const svg = one({ type: "life_cycle", stages: ["egg", "larva", "pupa", "adult"], title: "Insect X", blank: [2] });
    expect(texts(svg)).toEqual(expect.arrayContaining(["egg", "larva", "adult", "Insect X"]));
    expect(svg).not.toContain("pupa");
    expect(count(svg, /<polygon/)).toBe(4);
  });

  it("life_cycle: custom edges and icons", () => {
    const svg = one({ kind: "life_cycle", stages: ["H", "G", "F"], size: "small", edges: [[0, 1], [0, 2], [1, 2]] });
    expect(count(svg, /<polygon/)).toBe(3);
    expect(desc(svg)).toContain("H → G; H → F; G → F");
    expect(one({ kind: "life_cycle", stages: ["egg", "", "", "adult"], icons: ["mosquito_eggs", "mosquito_larva", "mosquito_pupa", "mosquito"], blank: [1, 2] })).not.toContain("larva<");
  });

  it("ring_stack: one ring per entry, gaps make rings float, faces are labelled", () => {
    const svg = one({ kind: "ring_stack", rings: [{ name: "A" }, { name: "B", gap: 22 }, { name: "C", gap: 0 }], faces: [{ ring: 1, face: "bottom", text: "face P" }], rod_label: "wooden rod", base: "wooden base" });
    expect(count(svg, /width="96" height="20"/)).toBe(3);
    expect(texts(svg)).toEqual(expect.arrayContaining(["A", "B", "C", "face P", "wooden rod", "wooden base"]));
    expect(desc(svg)).toContain("B floats above A");
    expect(desc(svg)).toContain("C touches B");
  });

  it("stroke: one way has a dashed lift-back path; both ways a double-headed arrow", () => {
    const oneWay = one({ kind: "stroke", mode: "one_way", times: "40 times", object: "steel needle" });
    const both = one({ kind: "stroke", mode: "both_ways", times: "60 times", object: "steel needle" });
    expect(oneWay).toMatch(/stroke-dasharray="5 4"/);
    expect(both).not.toMatch(/stroke-dasharray="5 4"/);
    expect(count(both, /<polygon/)).toBe(2);
    expect(texts(oneWay)).toEqual(expect.arrayContaining(["steel needle", "40 times", "magnet"]));
  });

  it("beakers: water height follows the level", () => {
    const d = KINDS.beakers({ beakers: [{ label: "P", level: 0.8 }, { label: "R", level: 0.4 }] }, { render: () => { throw new Error(); } });
    const heights = [...d.body.matchAll(/height="([\d.]+)" fill="#dcebf8"/g)].map((m) => Number(m[1]));
    expect(heights[0]).toBeCloseTo(heights[1] * 2, 0);
  });

  it("magnet_layout: y counts upwards, vertical labels run top then bottom, [] is an answer box", () => {
    const d = KINDS.magnet_layout(
      { w: 200, h: 160, magnets: [{ type: "bar", x: 20, y: 120, len: 100, thick: 26, labels: ["[]", ""] }, { type: "bar", x: 120, y: 20, len: 120, thick: 26, vertical: true, labels: ["S", "N"] }] },
      { render: () => { throw new Error(); } },
    );
    const y = (s: string) => Number(new RegExp(`y="([\\d.]+)"[^>]*>${s}<`).exec(d.body)?.[1]);
    expect(y("S")).toBeLessThan(y("N"));
    expect(count(d.body, /width="18" height="18"/)).toBe(1);
    const u = one({ kind: "magnet_layout", w: 230, h: 160, magnets: [{ type: "u", x: 60, y: 40, w: 110, h: 112, arm: 22, open: "down", labels: ["A", "B"] }] });
    expect(texts(u)).toEqual(["A", "B"]);
  });

  it("electromagnet: turns, batteries, switch state and the clips it holds", () => {
    const p = KINDS.electromagnet({ turns: 10, cells: 1, switch: "closed", clips: 2 }, { render: () => { throw new Error(); } });
    const q = KINDS.electromagnet({ turns: 20, cells: 2, switch: "open", clips: 6 }, { render: () => { throw new Error(); } });
    const clips = (b: string) => count(b, /<path d="M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ A/);
    expect(clips(p.body)).toBe(2);
    expect(clips(q.body)).toBe(6);
    expect(count(q.body, /width="30" height="16"/)).toBe(2);
    expect(q.alt).toContain("switch open");
    expect(texts(svgOf({ stem: [{ kind: "electromagnet", turns: 12, core: "iron core" }] }))).toEqual(expect.arrayContaining(["12 turns", "iron core"]));
  });

  it("apparatus kinds label what the stem names", () => {
    expect(texts(one({ kind: "flex_test" }))).toEqual(expect.arrayContaining(["sheet", "d", "press"]));
    expect(texts(one({ kind: "bowl_test", label: "P", collected: false }))).toEqual(expect.arrayContaining(["bowl made of material P", "water", "container"]));
    const g = one({ kind: "germination", dishes: [{ label: "A", water: true, note: "wet, light, 30 °C" }, { label: "C", water: true, cover: "dark", note: "wet, dark, 30 °C" }] });
    expect(texts(g)).toEqual(expect.arrayContaining(["A", "C", "dark", "wet, light, 30 °C"]));
    const s = KINDS.strength_test({ mode: "bridge", bricks: 3, label: "material" }, { render: () => { throw new Error(); } });
    expect(count(s.body, /width="48" height="20"/)).toBe(3);
    expect(texts(one({ kind: "magnet_distance", object: "steel clip", magnet_label: "P" }))).toEqual(expect.arrayContaining(["magnet P", "steel clip", "distance"]));
    const t = texts(one({ kind: "magnets_table", magnets: [{ labels: ["N", "S"], name: "P" }, { labels: ["S", "N"], name: "Q" }], hold: 1 }));
    expect(t).toEqual(["N", "S", "magnet P", "S", "N", "magnet Q", "(held in place)"]);
  });

  it("compass: the dark end points along the bearing (clockwise from up)", () => {
    const tipX = (angle: number) => {
      const d = KINDS.compass({ angle, magnet: "right", magnet_labels: ["N", "S"] }, { render: () => { throw new Error(); } });
      return Number(/<polygon points="([\d.]+),/.exec(d.body)?.[1]);
    };
    expect(tipX(270)).toBeLessThan(52);
    expect(tipX(90)).toBeGreaterThan(52);
    expect(tipX(0)).toBeCloseTo(52, 0);
  });

  it("circuit: one symbol per part, rungs for parallel branches, open or closed switches", () => {
    const par = one({ type: "circuit", battery: { cells: 2 }, series: [{ switch: "S1", closed: true }], parallel: [[{ bulb: "P" }], [{ bulb: "Q" }, { bulb: "R" }]] });
    expect(count(par, /r="12" fill/)).toBe(3);
    expect(count(par, /r="3.4"/)).toBe(2); // junction dots
    expect(texts(par)).toEqual(expect.arrayContaining(["S1", "P", "Q", "R"]));
    const ser = KINDS.circuit({ battery: { cells: 2 }, series: [{ switch: "S", closed: false }, { box: "coil + iron rod" }, { bulb: "L" }] }, { render: () => { throw new Error(); } });
    expect(ser.alt).toContain("switch S (open)");
    expect(ser.body).toContain("coil + iron rod");
  });

  it("line_graph: dash styles, end labels, and one panel per labelled group", () => {
    const grouped = one({ type: "line_graph", hide_numbers: true, xlabel: "Days", ylabel: "Number of fish", series: [{ label: "J (tank X)", x: [0, 7], y: [5, 8] }, { label: "K (tank X)", x: [0, 7], y: [5, 2], style: ":" }, { label: "L (tank Y)", x: [0, 7], y: [5, 8], style: "--" }, { label: "K (tank Y)", x: [0, 7], y: [5, 2.5], style: "-." }] });
    expect(texts(grouped)).toEqual(expect.arrayContaining(["Tank X", "Tank Y", "J", "L"]));
    expect(texts(grouped).filter((t) => t === "K")).toHaveLength(2);
    expect(count(grouped, /stroke-dasharray="2 4"/)).toBe(1);
    const plain = one({ type: "line_graph", series: [{ x: [0, 10], y: [0, 100] }], xticks: [0, 10], yticks: [0, 50, 100], vlines: [5], end_labels: false });
    expect(texts(plain)).toEqual(expect.arrayContaining(["0", "10", "50", "100"]));
    expect(desc(plain)).toContain("(10, 100)");
  });

  it("spring_set and scene: springs, loads and apparatus", () => {
    const s = one({ type: "spring_set", springs: [{ label: "X", length: 2, load: "P" }, { label: "Z", length: 4, load: "R" }] });
    expect(texts(s)).toEqual(["P", "X", "R", "Z"]);
    const sc = one({
      type: "scene",
      box: [10, 5],
      items: [
        { prim: "ground", x0: 0.5, x1: 9.5, y: 0.4 },
        { prim: "testtube", x: 3, y: 0.9, h: 2.6, level: 0.9, plant: true, bubbles: true, label: "aquatic plant in water" },
        { prim: "lamp", x: 6.2, y: 2.6, facing: "left", on: true, label: "lamp" },
        { prim: "arrow", x0: 3.6, y0: 1.2, x1: 5.9, y1: 1.2, text: "distance" },
        { prim: "beaker", x: 1, y: 1, w: 2, h: 2, level: 0.5, label: "cup A" },
        { prim: "thermometer", x: 2, y: 1.5, h: 1.5 },
        { prim: "block", x: 7, y: 1, w: 1, h: 1, hatch: "xxx", label: "Z" },
      ],
    });
    expect(texts(sc)).toEqual(expect.arrayContaining(["aquatic plant in water", "lamp", "distance", "cup A", "Z"]));
  });

  it("flower: only the requested letters, never the part names", () => {
    const svg = one({ type: "flower", labels: { stigma: "J", anther: "K", ovary: "L", filament: "M" } });
    expect(texts(svg).sort()).toEqual(["J", "K", "L", "M"]);
    expect(svg).not.toMatch(/stigma|anther|ovary|filament/);
  });

  it("food_web and magnets: arrows from food to feeder; labelled objects", () => {
    const fw = one({ type: "food_web", nodes: { grass: [0, 0], grasshopper: [2, 1], bird: [4, 0] }, edges: [["grass", "grasshopper"], ["grasshopper", "bird"]] });
    expect(count(fw, /<polygon/)).toBe(2);
    expect(desc(fw)).toContain("grass → grasshopper");
    const m = one({ type: "magnets", box: [9, 3], items: [{ kind: "magnet", x: 0.6, y: 1.2, w: 1.8, poles: ["S", "N"], label: "magnet A" }, { kind: "bar", x: 5.2, y: 1.2, w: 2.4, label: "iron bar", hatch: "///", ends: ["X", "Y"] }], arrows: [{ x0: 5, y0: 2.3, x1: 3.4, y1: 2.3, text: "movement of bar" }] });
    expect(texts(m)).toEqual(expect.arrayContaining(["S", "N", "X", "Y", "magnet A", "iron bar", "movement of bar"]));
  });

  it("poster: every piece of text from the spec, in one accent colour", () => {
    const svg = one({
      kind: "poster",
      theme: "#2A7F62",
      accent: "#BFE3C9",
      presenter: "A Club presents",
      badge: "FREE|ENTRY!",
      title: "Kite Day",
      tagline: "Fly high!",
      facts: [{ icon: "calendar", label: "Date", value: "Saturday, 21 November" }],
      art: [{ kind: "person", pose: "wave" }],
      banner: "Activities",
      boxes: [{ title: "Workshop", sub: "3 p.m.", icon: "palette", body: "Make your own kite!\n$5 per child." }],
      wide_box: { title: "Register by 14 November", body: "Only 40 places!" },
      footer: ["Call 6123 4567."],
    });
    expect(texts(svg)).toEqual(expect.arrayContaining(["A Club presents", "FREE", "ENTRY!", "Kite Day", "Fly high!", "Date:", "Saturday, 21 November", "Activities", "Workshop", "3 p.m.", "Make your own kite!", "$5 per child.", "Register by 14 November", "Only 40 places!", "Call 6123 4567."]));
    expect(svg).not.toMatch(/javascript/i);
    expect(one({ kind: "poster", theme: "red;}", title: "T" })).not.toContain("red;}");
  });

  it("picture and icon_set (Chinese picture questions)", () => {
    expect(desc(svgOf({ scene: { w: 38, h: 38, items: [{ type: "clock", x: 20, y: 20, w: 60, time: "7:00" }] } }))).toContain("7:00");
    const bag = svgOf({ icons: ["handbag", "recycle"], w: 38 });
    expect(desc(bag)).toContain("a bag with handles with a recycling sign");
  });
});

describe("figureTitle", () => {
  it("uses the item's own opening words", () => {
    expect(figureTitle([{ stem: "Study the flowchart.\n\nWhich animals could be L and N?" }])).toBe("Study the flowchart. Which animals could be L and N?");
    expect(figureTitle([{ stem: "Siti made two electromagnets.\n\n(a) Which is stronger?" }, { stem: "Siti made two electromagnets.\n\n(b) Is this fair?" }])).toBe("Siti made two electromagnets.");
    expect(figureTitle([{ stem: "根据图意，选出最适当的词语。\n\n早上，____响了。" }])).toBe("早上，…响了。");
    expect(figureTitle([{ stem: "Q?", passage: "The Club presents\n**Kite Day**\nFly high" }])).toBe("The Club presents Kite Day");
  });
});

describe("scripts/render-figures.ts helpers", () => {
  it("names shared figures after their parts", () => {
    expect(figureName(["p3sci-x-b1a", "p3sci-x-b1b", "p3sci-x-b1c"])).toBe("p3sci-x-b1abc");
    expect(figureName(["p3eng-m-q10", "p3eng-m-q11", "p3eng-m-q13"])).toBe("p3eng-m-q10-q13");
    expect(figureName(["solo-q1"])).toBe("solo-q1");
  });

  it("sets figure just before figure_spec, swaps the note and touches nothing else", () => {
    const item = { id: "a", stem: "S", figure_spec: { stem: [] }, source: { kind: "own" }, status: "draft", notes: PENDING_NOTE };
    const out = withFigure(item, "figures/a.svg");
    expect(Object.keys(out)).toEqual(["id", "stem", "figure", "figure_spec", "source", "status", "notes"]);
    expect(out.notes).toBe(RENDERED_NOTE);
    expect(out.status).toBe("draft");
    expect(withFigure(out, "figures/a.svg")).toEqual(out);
  });
});

describe("skill-pack figures", () => {
  const skills = join(import.meta.dirname, "..", "..", "..", "content", "skills");
  const items = readdirSync(skills)
    .filter((p) => existsSync(join(skills, p, "items")) && statSync(join(skills, p, "items")).isDirectory())
    .flatMap((pack) =>
      readdirSync(join(skills, pack, "items"))
        .filter((f) => f.endsWith(".json"))
        .flatMap((f) => (JSON.parse(readFileSync(join(skills, pack, "items", f), "utf8")) as { id: string; figure?: string; figure_spec?: unknown; notes?: string }[]).map((it) => ({ pack, ...it }))),
    )
    .filter((it) => it.figure_spec !== undefined);

  it.each(items.map((it) => [it.id, it] as const))("%s renders, and its rendered file is a safe SVG", (_id, it) => {
    expectSafe(svgOf(it.figure_spec));
    if (it.figure?.endsWith(".svg") && (it.notes ?? "").includes(RENDERED_NOTE)) expectSafe(readFileSync(join(skills, it.pack, it.figure), "utf8"));
  });
});
