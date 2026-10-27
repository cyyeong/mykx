// Contact sheets of rendered question figures, for the founder to check before approving items.
//
//   node scripts/figure-sheet.ts --out <dir> [--pw <dir>] [--chrome <path>] [--scale 1.5] [--all]
//
// Writes <out>/sheet-<pack>.html: one card per figure file, the figure shown at 320 px wide (the
// smallest phone width it must read at) beside its item ids, stems, options and answers. With --pw
// (a folder whose node_modules holds playwright-core) it also saves <out>/sheet-<pack>-<n>.png pages
// and reports any figure that fails to load as an image. Only items drawn by scripts/render-figures.ts
// are listed unless --all is given. Nothing in the repo is changed.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { RENDERED_NOTE } from "./render-figures.ts";

interface Item {
  id: string;
  stem: string;
  passage?: string;
  options?: string[];
  answer: number | string;
  figure?: string;
  figure_spec?: unknown;
  notes?: string;
}

const PER_PAGE = 6;

// The few Playwright calls used here (playwright-core is not a project dependency; --pw points at one).
interface PwPage {
  goto(url: string, o?: object): Promise<unknown>;
  evaluate<T>(fn: () => T): Promise<T>;
  locator(selector: string): { count(): Promise<number>; nth(i: number): { screenshot(o: { path: string }): Promise<unknown> } };
}
interface Playwright {
  chromium: { launch(o: object): Promise<{ newPage(o: object): Promise<PwPage>; close(): Promise<void> }> };
}

function arg(name: string, dflt?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inline = (s: string) =>
  esc(s)
    .replace(/&amp;nbsp;/g, " ")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

/** Stem text with **bold**, line breaks and Markdown tables. */
function md(s: string): string {
  const lines = s.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; ) {
    if (!lines[i].trim().startsWith("|")) {
      out.push(`${inline(lines[i])}<br>`);
      i++;
      continue;
    }
    const rows: string[][] = [];
    for (; i < lines.length && lines[i].trim().startsWith("|"); i++) rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
    const body = rows.filter((r) => !r.every((c) => /^:?-{3,}:?$/.test(c)));
    out.push(`<table>${body.map((r, k) => `<tr>${r.map((c) => (k ? `<td>${inline(c)}</td>` : `<th>${inline(c)}</th>`)).join("")}</tr>`).join("")}</table>`);
  }
  return out.join("");
}

function card(pack: string, figure: string, items: Item[], skills: string): string {
  const svg = readFileSync(join(skills, pack, figure));
  const src = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  const parts = items
    .map((it) => {
      const opts = it.options?.length ? `<ol class="opts">${it.options.map((o, i) => `<li${it.answer === i + 1 ? ' class="ans"' : ""}>${esc(o)}</li>`).join("")}</ol>` : "";
      const ans = typeof it.answer === "string" ? `<p class="ans-text"><b>Answer:</b> ${md(it.answer)}</p>` : "";
      return `<div class="part"><p class="id">${esc(it.id)}</p><p class="stem">${md(it.stem)}</p>${opts}${ans}</div>`;
    })
    .join("");
  return `<article><figure><img src="${src}" alt="${esc(figure)}" width="320"><figcaption>${esc(figure)}</figcaption></figure><div class="text">${parts}</div></article>`;
}

function sheet(pack: string, cards: string[]): string {
  const pages: string[] = [];
  for (let i = 0; i < cards.length; i += PER_PAGE) pages.push(`<section><h2>${esc(pack)} · page ${pages.length + 1}</h2>${cards.slice(i, i + PER_PAGE).join("")}</section>`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(pack)} figures</title><style>
body{margin:0;background:#eef1f5;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f2a37}
section{width:1400px;padding:20px 24px;box-sizing:border-box;display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
h2{grid-column:1/-1;margin:0;font-size:16px}
article{display:grid;grid-template-columns:320px 1fr;gap:16px;background:#fff;border-radius:12px;padding:14px;box-shadow:0 1px 3px #0001}
figure{margin:0}img{display:block;width:320px;height:auto;outline:1px solid #d3dae3}
figcaption{font-size:11px;color:#5c6878;margin-top:6px;word-break:break-all}
.part+.part{border-top:1px solid #e3e7ec;margin-top:8px;padding-top:8px}
.id{font:600 12px ui-monospace,monospace;color:#2f6fb0;margin:0}.stem{margin:4px 0}
table{border-collapse:collapse;margin:6px 0;font-size:12.5px}th,td{border:1px solid #d3dae3;padding:2px 6px;text-align:left}th{background:#f3f5f8}
.opts{margin:4px 0;padding-left:22px}.ans{font-weight:700}.ans::after{content:" ✓";color:#2f6fb0}.ans-text{margin:4px 0;color:#374151}
</style></head><body>${pages.join("")}</body></html>`;
}

async function screenshots(htmlPath: string, outPrefix: string, pwDir: string, chrome: string, scale: number): Promise<{ pngs: string[]; broken: string[] }> {
  const require = createRequire(join(pwDir, "package.json"));
  const { chromium } = require("playwright-core") as Playwright;
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: scale });
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    const broken = await page.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.alt));
    const n = await page.locator("section").count();
    const pngs: string[] = [];
    for (let i = 0; i < n; i++) {
      const png = `${outPrefix}-${i + 1}.png`;
      await page.locator("section").nth(i).screenshot({ path: png });
      pngs.push(png);
    }
    return { pngs, broken };
  } finally {
    await browser.close();
  }
}

async function main() {
  const out = arg("out");
  if (!out) {
    console.error("usage: node scripts/figure-sheet.ts --out <dir> [--pw <dir>] [--chrome <path>] [--scale 1.5] [--all]");
    process.exit(2);
  }
  const all = process.argv.includes("--all");
  const pw = arg("pw");
  const chrome = arg("chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") as string;
  const scale = Number(arg("scale", "1.5"));
  const skills = join(import.meta.dirname, "..", "content", "skills");
  mkdirSync(out, { recursive: true });
  for (const pack of readdirSync(skills).sort()) {
    const itemDir = join(skills, pack, "items");
    if (!existsSync(itemDir) || !statSync(itemDir).isDirectory()) continue;
    const byFigure = new Map<string, Item[]>();
    for (const f of readdirSync(itemDir).filter((x) => x.endsWith(".json")).sort()) {
      for (const it of JSON.parse(readFileSync(join(itemDir, f), "utf8")) as Item[]) {
        if (!it.figure || it.figure_spec === undefined || !it.figure.endsWith(".svg")) continue;
        if (!all && !(it.notes ?? "").includes(RENDERED_NOTE)) continue;
        byFigure.set(it.figure, [...(byFigure.get(it.figure) ?? []), it]);
      }
    }
    if (!byFigure.size) continue;
    const cards = [...byFigure].map(([fig, items]) => card(pack, fig, items, skills));
    const html = join(out, `sheet-${pack}.html`);
    writeFileSync(html, sheet(pack, cards));
    console.log(`${html}  (${byFigure.size} figures, ${[...byFigure.values()].flat().length} items)`);
    if (pw) {
      const { pngs, broken } = await screenshots(html, join(out, `sheet-${pack}`), pw, chrome, scale);
      for (const p of pngs) console.log(`  ${p}`);
      if (broken.length) {
        console.error(`  figures that failed to load: ${broken.join(", ")}`);
        process.exitCode = 1;
      }
    }
  }
}

if (import.meta.main) await main();
