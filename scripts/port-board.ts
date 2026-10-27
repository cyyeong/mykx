// First-pass port of a design-canvas board (.dc.html) to a React component and a global stylesheet.
//
//   node scripts/port-board.ts <board.dc.html> <ComponentName> <outDir> [--map <blob-map.json>] [--force]
//
// Writes <outDir>/<ComponentName>.tsx and <outDir>/<componentName>.css, then lists what needs a hand pass.
//
// Handles: <helmet><style> → the CSS file (canvas boilerplate `body`/`a` rules dropped, blob urls mapped);
// markup → JSX (class/for, SVG and HTML attribute names, inline style strings → style objects, comments,
// text escaping, whitespace); {{a.b}} holes → `vals.a.b` (loop variables stay bare); `<sc-for>` → `.map`
// with keys; `<sc-if>` → `&&`; `onClick="{{x}}"` → handlers; `<img src="/_blob/…">` → <Art base> for
// /art paths (sizes from a px width) or a plain <img> for /brand SVGs; `<a href="X.dc.html">` → <Link>;
// `<dc-import>` → a component tag. The DCLogic class is kept as a comment beside a `vals` stub.
//
// Doesn't: port the DCLogic logic (renderVals, state, handlers), type `vals`, turn style-string holes
// (`style="{{x.style}}"`) into objects, map dynamic image holes to <Art>, choose real routes (board links get a
// guessed one, flagged), or extract shared components. HTML whitespace follows JSX rules (a line break between
// inline elements is no space). Re-running needs --force, because the output is meant to be finished by hand.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

// ---------------------------------------------------------------- HTML parsing

export type HtmlAttr = { name: string; value: string | null };
export type HtmlElement = { type: "element"; tag: string; attrs: HtmlAttr[]; children: HtmlNode[] };
export type HtmlText = { type: "text"; text: string };
export type HtmlComment = { type: "comment"; text: string };
export type HtmlNode = HtmlElement | HtmlText | HtmlComment;

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW_TAGS = new Set(["script", "style"]);

/** A small, forgiving parser for the canvas's machine-written HTML (quoted attributes, void tags, SVG self-closing). */
export function parseHtml(src: string): HtmlNode[] {
  const root: HtmlElement = { type: "element", tag: "#root", attrs: [], children: [] };
  const stack: HtmlElement[] = [root];
  const top = () => stack[stack.length - 1];
  let i = 0;

  while (i < src.length) {
    if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i + 4);
      const stop = end === -1 ? src.length : end;
      top().children.push({ type: "comment", text: src.slice(i + 4, stop) });
      i = stop + 3;
    } else if (src.startsWith("</", i)) {
      const end = src.indexOf(">", i);
      const tag = src.slice(i + 2, end === -1 ? src.length : end).trim().toLowerCase();
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s].tag.toLowerCase() === tag) {
          stack.length = s;
          break;
        }
      }
      i = end === -1 ? src.length : end + 1;
    } else if (src.startsWith("<!", i) || src.startsWith("<?", i)) {
      const end = src.indexOf(">", i);
      i = end === -1 ? src.length : end + 1;
    } else if (src[i] === "<" && /[A-Za-z]/.test(src[i + 1] ?? "")) {
      const { el, end, selfClosing } = readTag(src, i);
      top().children.push(el);
      i = end;
      const lower = el.tag.toLowerCase();
      if (RAW_TAGS.has(lower) && !selfClosing) {
        const close = src.toLowerCase().indexOf(`</${lower}`, i);
        const stop = close === -1 ? src.length : close;
        el.children.push({ type: "text", text: src.slice(i, stop) });
        const gt = src.indexOf(">", stop);
        i = gt === -1 ? src.length : gt + 1;
      } else if (!selfClosing && !VOID_TAGS.has(lower)) {
        stack.push(el);
      }
    } else {
      const next = src.indexOf("<", i + 1);
      const stop = next === -1 ? src.length : next;
      const parent = top();
      const last = parent.children[parent.children.length - 1];
      const text = src.slice(i, stop);
      if (last?.type === "text") last.text += text;
      else parent.children.push({ type: "text", text });
      i = stop;
    }
  }
  return root.children;
}

function readTag(src: string, start: number): { el: HtmlElement; end: number; selfClosing: boolean } {
  const nameRe = /[A-Za-z][\w:.-]*/y;
  nameRe.lastIndex = start + 1;
  const tag = nameRe.exec(src)?.[0] ?? "div";
  const el: HtmlElement = { type: "element", tag, attrs: [], children: [] };
  let i = start + 1 + tag.length;
  const attrRe = /[^\s=/>]+/y;
  const unquotedRe = /[^\s>]+/y;
  const skipSpace = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };

  for (;;) {
    skipSpace();
    if (i >= src.length) return { el, end: i, selfClosing: false };
    if (src.startsWith("/>", i)) return { el, end: i + 2, selfClosing: true };
    if (src[i] === ">") return { el, end: i + 1, selfClosing: false };
    attrRe.lastIndex = i;
    const name = attrRe.exec(src)?.[0];
    if (!name) {
      i++;
      continue;
    }
    i += name.length;
    skipSpace();
    if (src[i] !== "=") {
      el.attrs.push({ name, value: null });
      continue;
    }
    i++;
    skipSpace();
    const quote = src[i];
    if (quote === '"' || quote === "'") {
      const end = src.indexOf(quote, i + 1);
      const stop = end === -1 ? src.length : end;
      el.attrs.push({ name, value: src.slice(i + 1, stop) });
      i = stop + 1;
    } else {
      unquotedRe.lastIndex = i;
      const value = unquotedRe.exec(src)?.[0] ?? "";
      el.attrs.push({ name, value });
      i += value.length;
    }
  }
}

function findElement(nodes: HtmlNode[], test: (el: HtmlElement) => boolean): HtmlElement | null {
  for (const node of nodes) {
    if (node.type !== "element") continue;
    if (test(node)) return node;
    const found = findElement(node.children, test);
    if (found) return found;
  }
  return null;
}

function attr(el: HtmlElement, name: string): string | null {
  return el.attrs.find((a) => a.name.toLowerCase() === name)?.value ?? null;
}

function textOf(el: HtmlElement | null): string {
  if (!el) return "";
  return el.children.map((c) => (c.type === "text" ? c.text : c.type === "element" ? textOf(c) : "")).join("");
}

// ---------------------------------------------------------------- board structure

export type Board = { title: string; css: string; markup: HtmlNode[]; logic: string };

export function readBoard(html: string): Board {
  const doc = parseHtml(html);
  const xdc = findElement(doc, (el) => el.tag.toLowerCase() === "x-dc");
  if (!xdc) throw new Error("No <x-dc> root: is this a .dc.html board?");
  const helmet = findElement(xdc.children, (el) => el.tag.toLowerCase() === "helmet");
  const style = helmet ? findElement(helmet.children, (el) => el.tag.toLowerCase() === "style") : null;
  const script = findElement(doc, (el) => el.tag.toLowerCase() === "script" && attr(el, "type") === "text/x-dc");
  return {
    title: textOf(findElement(doc, (el) => el.tag.toLowerCase() === "title")).trim(),
    css: textOf(style),
    markup: xdc.children.filter((n) => !(n.type === "element" && n.tag.toLowerCase() === "helmet")),
    logic: textOf(script).trim(),
  };
}

// ---------------------------------------------------------------- blob ids → repo art

export type BlobMap = Record<string, string>;
const BLOB_RE = /\/_blob\/([0-9a-f]{32})/g;

/** canvas-blob-map.json: id → "/art/…" (no extension) or "/brand/….svg"; a trailing " *" marks an inferred id. */
export function parseBlobMap(json: string): BlobMap {
  const raw = JSON.parse(json) as Record<string, unknown>;
  const map: BlobMap = {};
  for (const [id, path] of Object.entries(raw)) {
    if (id.startsWith("_") || typeof path !== "string") continue;
    map[id] = path.replace(/\s*\*$/, "").trim();
  }
  return map;
}

const isArtBase = (path: string) => path.startsWith("/art/") && !/\.\w+$/.test(path);

/** In CSS a background needs a real file: the 800w variant is plenty for the boards' tiles and sheets. */
function cssUrlFor(path: string): string {
  return isArtBase(path) ? `${path}-800.webp` : path;
}

// ---------------------------------------------------------------- CSS

const BOILERPLATE_SELECTORS = new Set(["body", "a", "a:hover"]);

/** Split a stylesheet into its top-level blocks (rules, at-rules, comments), keeping the source text. */
export function splitCss(css: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let quote: string | null = null;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (depth === 0 && css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? css.length : end + 2;
      if (css.slice(start, i).trim()) parts.push(css.slice(start, i).trim());
      parts.push(css.slice(i, stop));
      i = stop - 1;
      start = stop;
    } else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        parts.push(css.slice(start, i + 1).trim());
        start = i + 1;
      }
    } else if (ch === ";" && depth === 0) {
      parts.push(css.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  if (css.slice(start).trim()) parts.push(css.slice(start).trim());
  return parts.filter(Boolean);
}

/** The board's helmet CSS as an app stylesheet: boilerplate element rules dropped, blob urls mapped. */
export function portCss(css: string, blobs: BlobMap, warnings: string[]): string {
  const kept = splitCss(css).filter((block) => {
    const brace = block.indexOf("{");
    if (brace === -1 || block.startsWith("/*") || block.startsWith("@")) return true;
    return !BOILERPLATE_SELECTORS.has(block.slice(0, brace).trim());
  });
  return kept
    .join("\n")
    .replace(BLOB_RE, (whole, id: string) => {
      const path = blobs[id];
      if (!path) {
        warnings.push(`CSS: no art mapped for blob ${id}`);
        return whole;
      }
      return cssUrlFor(path);
    });
}

// ---------------------------------------------------------------- holes, attributes, styles

const HOLE_RE = /\{\{\s*(.*?)\s*\}\}/g;
const LITERAL_RE = /^(true|false|null|undefined|-?\d+(\.\d+)?|'[^']*'|"[^"]*")$/;

/** `{{ a.b }}` → `vals.a.b`; loop variables (and `$index`) in scope stay bare; literals pass through. */
export function holeExpr(path: string, scope: ReadonlySet<string>): string {
  const p = path.trim();
  if (LITERAL_RE.test(p)) return p;
  const safe = p.replace(/\.(\d+)(?=\.|$)/g, "[$1]");
  const head = safe.split(/[.[]/)[0];
  return scope.has(head) ? safe : `vals.${safe}`;
}

type Value = { kind: "string"; text: string } | { kind: "expr"; code: string };

function holes(text: string): RegExpMatchArray[] {
  return [...text.matchAll(HOLE_RE)];
}

/** A string with holes → a JS expression: the bare value for a whole-value hole, a template literal otherwise. */
function interpolate(text: string, scope: ReadonlySet<string>): Value {
  const found = holes(text);
  if (found.length === 0) return { kind: "string", text };
  if (found.length === 1 && found[0][0] === text.trim()) return { kind: "expr", code: holeExpr(found[0][1], scope) };
  let code = "`";
  let last = 0;
  for (const m of found) {
    code += text.slice(last, m.index).replace(/[`\\]|\$\{/g, (c) => `\\${c}`);
    code += "${" + holeExpr(m[1], scope) + "}";
    last = (m.index ?? 0) + m[0].length;
  }
  code += text.slice(last).replace(/[`\\]|\$\{/g, (c) => `\\${c}`) + "`";
  return { kind: "expr", code };
}

const camel = (s: string) => s.replace(/[-:]([a-z])/g, (_, c: string) => c.toUpperCase());

/** `-webkit-mask-image` → `WebkitMaskImage`, `-ms-x` → `msX`, `--token` stays (quoted by the caller). */
export function cssPropToJs(prop: string): string {
  const p = prop.trim();
  if (p.startsWith("--")) return p;
  const lower = p.toLowerCase();
  if (lower.startsWith("-ms-")) return camel(lower.slice(1));
  if (lower.startsWith("-")) {
    const c = camel(lower.slice(1));
    return c[0].toUpperCase() + c.slice(1);
  }
  return camel(lower);
}

function splitDeclarations(css: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "{" && css[i + 1] === "{") {
      const end = css.indexOf("}}", i);
      if (end !== -1) i = end + 1;
    } else if (ch === ";" && depth === 0) {
      out.push(css.slice(start, i));
      start = i + 1;
    }
  }
  out.push(css.slice(start));
  return out.map((d) => d.trim()).filter(Boolean);
}

export type StyleResult = { code: string; customProps: boolean };

/** An inline style string → a JSX style expression (an object literal, or the hole's value for `{{x}}`). */
export function styleToJsx(css: string, scope: ReadonlySet<string>, blobs: BlobMap = {}): StyleResult {
  const whole = interpolate(css.trim(), scope);
  if (whole.kind === "expr" && !whole.code.startsWith("`")) return { code: whole.code, customProps: false };
  const entries: string[] = [];
  let customProps = false;
  for (const decl of splitDeclarations(css)) {
    const colon = decl.indexOf(":");
    if (colon === -1) continue;
    const prop = decl.slice(0, colon).trim();
    const raw = decl
      .slice(colon + 1)
      .trim()
      .replace(BLOB_RE, (w, id: string) => (blobs[id] ? cssUrlFor(blobs[id]) : w));
    const key = cssPropToJs(prop);
    if (key.startsWith("--")) customProps = true;
    const keyCode = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
    const value = interpolate(raw, scope);
    const code =
      value.kind === "expr"
        ? value.code
        : /^-?(\d+(\.\d+)?|\.\d+)$/.test(value.text) && !key.startsWith("--")
          ? String(Number(value.text))
          : JSON.stringify(value.text);
    entries.push(`${keyCode}: ${code}`);
  }
  const object = `{ ${entries.join(", ")} }`;
  return { code: customProps ? `${object} as CSSProperties` : object, customProps };
}

const ATTR_RENAME: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  readonly: "readOnly",
  maxlength: "maxLength",
  minlength: "minLength",
  colspan: "colSpan",
  rowspan: "rowSpan",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  autoplay: "autoPlay",
  contenteditable: "contentEditable",
  crossorigin: "crossOrigin",
  srcset: "srcSet",
  enctype: "encType",
  novalidate: "noValidate",
  playsinline: "playsInline",
  spellcheck: "spellCheck",
  accesskey: "accessKey",
  inputmode: "inputMode",
  enterkeyhint: "enterKeyHint",
  fetchpriority: "fetchPriority",
  referrerpolicy: "referrerPolicy",
  datetime: "dateTime",
  usemap: "useMap",
  allowfullscreen: "allowFullScreen",
  charset: "charSet",
  hreflang: "hrefLang",
  "http-equiv": "httpEquiv",
  "accept-charset": "acceptCharset",
  "xlink:href": "xlinkHref",
  "xml:space": "xmlSpace",
  "xmlns:xlink": "xmlnsXlink",
};
const NUMERIC_ATTRS = new Set(["tabIndex", "colSpan", "rowSpan", "maxLength", "minLength", "size", "cols", "rows", "span", "start"]);

/** HTML/SVG attribute → JSX prop name (`stroke-width` → `strokeWidth`; aria-* and data-* unchanged). */
export function jsxAttrName(name: string): string {
  const lower = name.toLowerCase();
  if (ATTR_RENAME[lower]) return ATTR_RENAME[lower];
  if (lower.startsWith("aria-") || lower.startsWith("data-")) return lower;
  if (name.includes("-") || name.includes(":")) return camel(name);
  return name;
}

// ---------------------------------------------------------------- JSX emission

type Imports = { fragment: boolean; cssProperties: boolean; art: boolean; link: boolean };
type Ctx = {
  scope: ReadonlySet<string>;
  blobs: BlobMap;
  imports: Imports;
  warnings: string[];
  handlers: boolean;
  usesVals: boolean;
};

const pad = (n: number) => "  ".repeat(n);

function escapeJsxText(text: string): string {
  return text.replace(/[{}<>"']/g, (c) => ({ "{": "&#123;", "}": "&#125;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c] ?? c);
}

/** A text node as JSX children: collapsed like HTML; spaces on the same line as a tag kept as {" "}. */
function textToJsx(raw: string, ctx: Ctx): string | null {
  if (!raw.trim()) return raw.includes("\n") || raw === "" ? null : '{" "}';
  const lead = /^\s*/.exec(raw)?.[0] ?? "";
  const trail = /\s*$/.exec(raw)?.[0] ?? "";
  const body = raw.trim().replace(/\s+/g, " ");
  let out = "";
  let last = 0;
  for (const m of holes(body)) {
    out += escapeJsxText(body.slice(last, m.index));
    const expr = holeExpr(m[1], ctx.scope);
    noteVals(expr, ctx);
    out += `{${expr}}`;
    last = (m.index ?? 0) + m[0].length;
  }
  out += escapeJsxText(body.slice(last));
  if (lead && !lead.includes("\n")) out = '{" "}' + out;
  if (trail && !trail.includes("\n")) out += '{" "}';
  return out;
}

function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" })[e] ?? _);
}

function noteVals(code: string, ctx: Ctx) {
  if (/\bvals\./.test(code)) ctx.usesVals = true;
}

function attrsToJsx(el: HtmlElement, ctx: Ctx, extra: string[] = []): string[] {
  const out = [...extra];
  for (const { name, value } of el.attrs) {
    const lower = name.toLowerCase();
    if (lower.startsWith("hint-")) continue;
    const prop = jsxAttrName(name);
    if (value === null) {
      out.push(prop);
      continue;
    }
    if (lower === "style") {
      const style = styleToJsx(value, ctx.scope, ctx.blobs);
      if (style.customProps) ctx.imports.cssProperties = true;
      noteVals(style.code, ctx);
      if (!style.code.startsWith("{") && !style.code.startsWith("(")) {
        ctx.warnings.push(`style hole ${value.trim()}: return a style object (CSSProperties), not a CSS string`);
      }
      out.push(`style={${style.code}}`);
      continue;
    }
    if (/^on[a-z]+$/.test(name)) {
      ctx.warnings.push(`<${el.tag} ${name}>: inline handler strings aren't ported; use a {{handler}} hole`);
      continue;
    }
    if (/^on[A-Z]/.test(name)) ctx.handlers = true;
    const v = interpolate(value, ctx.scope);
    if (v.kind === "expr") {
      noteVals(v.code, ctx);
      out.push(`${prop}={${v.code}}`);
    } else if (NUMERIC_ATTRS.has(prop) && /^-?\d+$/.test(v.text)) {
      out.push(`${prop}={${v.text}}`);
    } else if (v.text.includes('"')) {
      out.push(`${prop}={${JSON.stringify(decodeEntities(v.text))}}`);
    } else {
      out.push(`${prop}="${v.text}"`);
    }
  }
  return out;
}

const IMG_LINT = "{/* eslint-disable-next-line @next/next/no-img-element */}";

function kebab(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/** Tag name and attributes after the board-specific rewrites (blob images, links, child boards). */
function rewriteElement(el: HtmlElement, ctx: Ctx): { tag: string; attrs: string[]; lead: string[] } {
  const tag = el.tag;
  const lower = tag.toLowerCase();

  if (lower === "img") {
    const src = attr(el, "src") ?? "";
    const blob = /^\/_blob\/([0-9a-f]{32})$/.exec(src.trim());
    const others: HtmlElement = { ...el, attrs: el.attrs.filter((a) => a.name.toLowerCase() !== "src") };
    if (blob) {
      const path = ctx.blobs[blob[1]];
      if (!path) {
        ctx.warnings.push(`<img>: no art mapped for blob ${blob[1]}`);
        return { tag, attrs: attrsToJsx(el, ctx), lead: [IMG_LINT] };
      }
      if (isArtBase(path)) {
        ctx.imports.art = true;
        const width = /(?:^|;)\s*width:\s*(\d+)px/.exec(attr(el, "style") ?? "")?.[1];
        const sizes = width ? [`sizes="${width}px"`] : [];
        return { tag: "Art", attrs: attrsToJsx(others, ctx, [`base="${path}"`, ...sizes]), lead: [] };
      }
      return { tag, attrs: attrsToJsx(others, ctx, [`src="${path}"`]), lead: [IMG_LINT] };
    }
    if (holes(src).length) ctx.warnings.push(`<img src="${src}">: dynamic image; map it to <Art base> by hand`);
    return { tag, attrs: attrsToJsx(el, ctx), lead: [IMG_LINT] };
  }

  if (lower === "a") {
    const href = attr(el, "href") ?? "";
    const board = /^\/?(?:[\w-]+\/)*([\w-]+)\.dc\.html(#.*)?$/.exec(href);
    if (board) {
      ctx.imports.link = true;
      const route = `/${kebab(board[1])}${board[2] ?? ""}`;
      ctx.warnings.push(`link to ${href}: guessed route ${route}`);
      const others: HtmlElement = { ...el, attrs: el.attrs.filter((a) => a.name.toLowerCase() !== "href") };
      return { tag: "Link", attrs: attrsToJsx(others, ctx, [`href="${route}"`]), lead: [] };
    }
  }

  if (lower === "dc-import") {
    const name = attr(el, "name") ?? "Child";
    const props: HtmlElement = {
      ...el,
      attrs: el.attrs
        .filter((a) => a.name.toLowerCase() !== "name")
        .map((a) => ({ ...a, name: a.name.startsWith("hint-") ? a.name : camel(a.name) })),
    };
    ctx.warnings.push(`<dc-import name="${name}">: port ${name}.dc.html and import it`);
    return { tag: name, attrs: attrsToJsx(props, ctx), lead: [] };
  }

  return { tag, attrs: attrsToJsx(el, ctx), lead: [] };
}

function significant(nodes: HtmlNode[]): HtmlNode[] {
  return nodes.filter((n) => n.type === "element" || (n.type === "text" && n.text.trim()));
}

/** Children as JSX lines; text-only children come back as a single inline line. */
function childrenToJsx(nodes: HtmlNode[], ctx: Ctx, depth: number): { inline: string | null; lines: string[] } {
  const onlyText = nodes.every((n) => n.type === "text");
  if (onlyText) {
    const text = nodes.map((n) => (n.type === "text" ? textToJsx(n.text, ctx) ?? "" : "")).join("");
    return { inline: text, lines: [] };
  }
  const lines: string[] = [];
  for (const node of nodes) lines.push(...nodeToJsx(node, ctx, depth));
  return { inline: null, lines };
}

function withKey(lines: string[], key: string): string[] {
  const at = lines.findIndex((l) => /^\s*<[\w.-]+/.test(l));
  if (at === -1) return lines;
  const m = /^\s*<[\w.-]+/.exec(lines[at]);
  if (!m) return lines;
  const next = [...lines];
  next[at] = lines[at].replace(m[0], `${m[0]} key={${key}}`);
  return next;
}

function nodeToJsx(node: HtmlNode, ctx: Ctx, depth: number): string[] {
  if (node.type === "comment") {
    const text = node.text.trim().replace(/\*\//g, "*\\/");
    return text ? [`${pad(depth)}{/* ${text} */}`] : [];
  }
  if (node.type === "text") {
    const text = textToJsx(node.text, ctx);
    return text ? [pad(depth) + text] : [];
  }

  const lower = node.tag.toLowerCase();
  if (lower === "helmet" || lower === "script" || lower === "style") {
    if (lower === "style") ctx.warnings.push("<style> inside the markup was skipped; move it to the CSS file");
    return [];
  }

  if (lower === "sc-for") {
    const list = interpolate(attr(node, "list") ?? "", ctx.scope);
    const listCode = list.kind === "expr" ? list.code : "[]";
    noteVals(listCode, ctx);
    const as = attr(node, "as") ?? "item";
    const inner: Ctx = { ...ctx, scope: new Set([...ctx.scope, as, "$index"]) };
    const kids = significant(node.children);
    let body: string[];
    if (kids.length === 1 && kids[0].type === "element" && !kids[0].tag.toLowerCase().startsWith("sc-")) {
      body = withKey(nodeToJsx(kids[0], inner, depth + 1), "$index");
    } else {
      ctx.imports.fragment = true;
      body = [`${pad(depth + 1)}<Fragment key={$index}>`, ...childrenToJsx(node.children, inner, depth + 2).lines, `${pad(depth + 1)}</Fragment>`];
    }
    syncFlags(ctx, inner);
    return [`${pad(depth)}{${listCode}.map((${as}, $index) => (`, ...body, `${pad(depth)}))}`];
  }

  if (lower === "sc-if") {
    const cond = interpolate(attr(node, "value") ?? "", ctx.scope);
    const condCode = cond.kind === "expr" ? cond.code : JSON.stringify(Boolean(cond.text));
    noteVals(condCode, ctx);
    const kids = significant(node.children);
    let body: string[];
    if (kids.length === 1 && kids[0].type === "element") body = nodeToJsx(kids[0], ctx, depth + 1);
    else body = [`${pad(depth + 1)}<>`, ...childrenToJsx(node.children, ctx, depth + 2).lines, `${pad(depth + 1)}</>`];
    return [`${pad(depth)}{${condCode} && (`, ...body, `${pad(depth)})}`];
  }

  const { tag, attrs, lead } = rewriteElement(node, ctx);
  const open = `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}`;
  const leadLines = lead.map((l) => pad(depth) + l);
  const kids = node.children.filter((n) => !(n.type === "text" && !n.text.trim() && n.text.includes("\n")));
  if (kids.length === 0 || VOID_TAGS.has(lower)) return [...leadLines, `${pad(depth)}${open} />`];
  const { inline, lines } = childrenToJsx(kids, ctx, depth + 1);
  if (inline !== null) return [...leadLines, `${pad(depth)}${open}>${inline}</${tag}>`];
  return [...leadLines, `${pad(depth)}${open}>`, ...lines, `${pad(depth)}</${tag}>`];
}

function syncFlags(outer: Ctx, inner: Ctx) {
  outer.handlers ||= inner.handlers;
  outer.usesVals ||= inner.usesVals;
}

// ---------------------------------------------------------------- whole component

export type PortResult = { tsx: string; css: string; cssFile: string; warnings: string[] };

export function portBoard(html: string, componentName: string, blobs: BlobMap, sourceName = "board.dc.html"): PortResult {
  const board = readBoard(html);
  const warnings: string[] = [];
  const ctx: Ctx = {
    scope: new Set(),
    blobs,
    imports: { fragment: false, cssProperties: false, art: false, link: false },
    warnings,
    handlers: false,
    usesVals: false,
  };

  const roots = significant(board.markup).filter((n): n is HtmlElement => n.type === "element");
  let body: string[];
  if (roots.length === 1) body = nodeToJsx(roots[0], ctx, 2);
  else body = ["    <>", ...roots.flatMap((r) => nodeToJsx(r, ctx, 3)), "    </>"];

  const logic = board.logic.replace(BLOB_RE, (w, id: string) => blobs[id] ?? w);
  const stateful = /\bsetState\s*\(|^\s*state\s*=/m.test(logic);
  const client = ctx.handlers || stateful;
  const cssFile = `${componentName[0].toLowerCase()}${componentName.slice(1)}.css`;
  const css = portCss(board.css, blobs, warnings);

  const reactImports = [ctx.imports.fragment ? "Fragment" : "", ctx.imports.cssProperties ? "type CSSProperties" : ""].filter(Boolean);
  const out: string[] = [
    `// Generated by scripts/port-board.ts from ${sourceName}${board.title ? ` ("${board.title}")` : ""}.`,
    ctx.usesVals
      ? "// First pass: port the board logic into useBoardVals(), then edit freely (re-running needs --force)."
      : "// First pass: edit freely (re-running needs --force).",
  ];
  if (client) out.push('"use client";');
  out.push("");
  if (reactImports.length) out.push(`import { ${reactImports.join(", ")} } from "react";`);
  if (ctx.imports.link) out.push('import Link from "next/link";');
  if (ctx.imports.art) out.push('import { Art } from "@/components/ui/Art";');
  out.push(`import "./${cssFile}";`, "");

  if (ctx.usesVals || logic) {
    const commented = logic
      .replace(/\*\//g, "*\\/")
      .split("\n")
      .map((l) => ` * ${l}`.trimEnd());
    out.push(
      "/*",
      " * Board logic (DCLogic), blob ids already mapped to art paths:",
      " *",
      ...commented,
      " */",
    );
  }
  if (ctx.usesVals) {
    out.push(
      "// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PORT: type what renderVals() returns.",
      "type Vals = any;",
      "",
      "function useBoardVals(): Vals {",
      "  // PORT: fixture data from renderVals(); interactive state with useState.",
      "  return {};",
      "}",
      "",
    );
  }
  out.push(`export function ${componentName}() {`);
  if (ctx.usesVals) out.push("  const vals = useBoardVals();");
  out.push("  return (", ...body, "  );", "}", "");

  const cssOut = [
    `/* Generated by scripts/port-board.ts from ${sourceName}: the board's <helmet> styles.`,
    "   A global stylesheet: every class is board-prefixed; the canvas boilerplate body/a rules are dropped. */",
    css,
    "",
  ].join("\n");

  return { tsx: out.join("\n"), css: cssOut, cssFile, warnings };
}

// ---------------------------------------------------------------- CLI

function main(argv: string[]) {
  const args = argv.filter((a) => !a.startsWith("--"));
  const force = argv.includes("--force");
  const mapIndex = argv.indexOf("--map");
  const mapPath = mapIndex === -1 ? "docs/design/canvas-blob-map.json" : argv[mapIndex + 1];
  const positional = args.filter((a) => a !== mapPath);
  const [boardPath, componentName, outDir] = positional;
  if (!boardPath || !componentName || !outDir || !/^[A-Z][A-Za-z0-9]*$/.test(componentName)) {
    console.error("Usage: node scripts/port-board.ts <board.dc.html> <ComponentName> <outDir> [--map <blob-map.json>] [--force]");
    process.exit(2);
  }
  if (!existsSync(mapPath)) {
    console.error(`Blob map not found: ${mapPath} (pass --map <path>)`);
    process.exit(2);
  }

  const result = portBoard(readFileSync(boardPath, "utf8"), componentName, parseBlobMap(readFileSync(mapPath, "utf8")), basename(boardPath));
  const tsxPath = join(outDir, `${componentName}.tsx`);
  const cssPath = join(outDir, result.cssFile);
  for (const path of [tsxPath, cssPath]) {
    if (existsSync(path) && !force) {
      console.error(`${path} exists (hand-finished?). Pass --force to overwrite.`);
      process.exit(1);
    }
  }
  mkdirSync(outDir, { recursive: true });
  writeFileSync(tsxPath, result.tsx);
  writeFileSync(cssPath, result.css);
  console.log(`Wrote ${tsxPath} and ${cssPath}.`);
  if (result.warnings.length) {
    console.log("\nNeeds a hand pass:");
    for (const w of new Set(result.warnings)) console.log(`  - ${w}`);
  }
}

if (import.meta.main) main(process.argv.slice(2));
