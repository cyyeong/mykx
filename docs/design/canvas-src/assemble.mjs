// Assemble the arcade boards: inject the shared keyboard and living-background (ambience) CSS, markup and model,
// plus each board's living art (lib/scene/livingArt.ts), into docs/design/boards/<Board>.dc.html.
//   node docs/design/canvas-src/assemble.mjs
// The boards are published to the Claude Design canvas by Claude Code; the copies in docs/design/boards are the
// reference for porting. Living-art image URLs map through docs/design/canvas-blob-map.json.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { livingArtHtml } from "../../../lib/scene/livingArt.ts";
const here = import.meta.dirname, out = join(here, "../boards");
const read = (f) => readFileSync(`${here}/${f}`, "utf8").trimEnd();
const css = read("keyboard.css"), html = read("keyboard.html"), js = read("keyboard.js");
const amCss = read("ambience.css"), amJs = read("ambience.js");
const REPO = join(here, "../../..");
const laCss = readFileSync(`${REPO}/components/scene/livingArt.css`, "utf8").trimEnd();
const blobOf = Object.fromEntries(Object.entries(JSON.parse(readFileSync(`${REPO}/docs/design/canvas-blob-map.json`, "utf8"))).map(([id, base]) => [base, `/_blob/${id}`]));

const living = (_, art, ox, oy) => {
  const data = JSON.parse(readFileSync(`${REPO}/public/art/living/${art}.json`, "utf8"));
  return livingArtHtml(data, { ox, oy, indent: "    ", srcOf: (src) => { const b = blobOf[src.replace(/\.webp$/, "")]; if (!b) throw new Error(`no canvas upload for ${src}`); return b; } });
};
for (const name of ["StarTyper", "WordGarden", "NeonStrike", "Arcade", "TypingPath"]) {
  const src = readFileSync(`${here}/${name}.src.html`, "utf8");
  const board = src.replace("/*KEYBOARD_CSS*/", css).replace("    <!--KEYBOARD_HTML-->", html).replace("/*KEYBOARD_JS*/", js.trim())
    .replace("/*AMBIENCE_CSS*/", `${amCss}\n${laCss}`).replace("/*LIVING_CSS*/", laCss).replace("/*AMBIENCE_JS*/", amJs.trim())
    .replace(/  <!--AMBIENCE_HTML:(\w+)-->/, (_, scene) => read(`ambience-${scene}.html`))
    .replace(/ *<!--LIVING_ART:([\w-]+):([\d.]+%):([\d.]+%)-->/g, living);
  if (/(KEYBOARD|AMBIENCE|LIVING)_(CSS|HTML|JS|ART)/.test(board)) throw new Error(`${name}: a placeholder was not replaced`);
  const logic = /<script type="text\/dc-logic"[^>]*>([\s\S]*?)<\/script>/.exec(board)?.[1] ?? /<script[^>]*>([\s\S]*?)<\/script>/.exec(board)?.[1];
  if (logic) new Function(logic.replace(/^\s*export\s+/gm, "").replace(/class (\w+) extends DCLogic/, "class $1"));
  writeFileSync(`${out}/${name}.dc.html`, board);
  console.log(`${name}.dc.html`);
}
