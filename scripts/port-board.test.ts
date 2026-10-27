import { describe, expect, it } from "vitest";
import { cssPropToJs, holeExpr, jsxAttrName, parseBlobMap, parseHtml, portBoard, portCss, styleToJsx } from "./port-board.ts";

const BLOBS = parseBlobMap(
  JSON.stringify({
    _note: "ignored",
    "1be0285c83fc5de9a8d666fbb5e6c403": "/art/kix/dreamlight",
    "86d2ad40444eabc4ba4c8a0e9f1d4603": "/brand/wordmark-on-dark.svg",
    d950da4db91207a7c4dfc3844601ad5c: "/art/critters/frog-life-cycle *",
  }),
);

function board(markup: string, css = "", logic = "class Component extends DCLogic { renderVals() { return {}; } }") {
  return `<!doctype html><html><head><title>Test</title></head><body><x-dc><helmet><style>${css}</style></helmet>${markup}</x-dc>
<script type="text/x-dc" data-dc-script data-props='{}'>${logic}</script></body></html>`;
}

describe("parseHtml", () => {
  it("handles void tags, self-closing SVG and quoted attributes", () => {
    const [div] = parseHtml(`<div class="a" data-x='b "c"'><img src="x.png" alt=""><svg><path d="M0 0"/></svg>hi</div>`);
    expect(div.type).toBe("element");
    if (div.type !== "element") return;
    expect(div.attrs).toEqual([
      { name: "class", value: "a" },
      { name: "data-x", value: 'b "c"' },
    ]);
    expect(div.children.map((c) => (c.type === "element" ? c.tag : c.type))).toEqual(["img", "svg", "text"]);
  });
});

describe("names and values", () => {
  it("maps attribute names to JSX props", () => {
    expect(jsxAttrName("class")).toBe("className");
    expect(jsxAttrName("stroke-width")).toBe("strokeWidth");
    expect(jsxAttrName("aria-label")).toBe("aria-label");
    expect(jsxAttrName("viewBox")).toBe("viewBox");
    expect(jsxAttrName("xlink:href")).toBe("xlinkHref");
  });

  it("maps CSS properties to style keys", () => {
    expect(cssPropToJs("-webkit-mask-image")).toBe("WebkitMaskImage");
    expect(cssPropToJs("grid-template-columns")).toBe("gridTemplateColumns");
    expect(cssPropToJs("--mastery")).toBe("--mastery");
  });

  it("resolves holes against loop scope", () => {
    const scope = new Set(["t", "$index"]);
    expect(holeExpr("t.label", scope)).toBe("t.label");
    expect(holeExpr("tabs", scope)).toBe("vals.tabs");
    expect(holeExpr("true", scope)).toBe("true");
  });

  it("turns inline styles into objects, numbers and custom properties included", () => {
    const s = styleToJsx("display: flex; font-weight: 800; --mastery: 57; background: url(/_blob/1be0285c83fc5de9a8d666fbb5e6c403)", new Set(), BLOBS);
    expect(s.code).toBe('{ display: "flex", fontWeight: 800, "--mastery": "57", background: "url(/art/kix/dreamlight-800.webp)" } as CSSProperties');
    expect(s.customProps).toBe(true);
    expect(styleToJsx("{{t.style}}", new Set(["t"])).code).toBe("t.style");
    expect(styleToJsx("width: {{w}}px", new Set()).code).toBe("{ width: `${vals.w}px` }");
  });
});

describe("portCss", () => {
  it("drops the canvas boilerplate and maps blob urls", () => {
    const css = "body{margin:0}\na{color:var(--accent)}a:hover{color:var(--ink)}\n.x-sheet{background-image:url(/_blob/d950da4db91207a7c4dfc3844601ad5c)}\n@media (max-width: 599px){.x{a:b}}";
    expect(portCss(css, BLOBS, [])).toBe(".x-sheet{background-image:url(/art/critters/frog-life-cycle-800.webp)}\n@media (max-width: 599px){.x{a:b}}");
  });
});

describe("portBoard", () => {
  it("converts loops, conditions, handlers, images and text", () => {
    const html = board(
      `<div class="r" data-theme="dreamlight">
  <img src="/_blob/86d2ad40444eabc4ba4c8a0e9f1d4603" alt="myKx">
  <img src="/_blob/1be0285c83fc5de9a8d666fbb5e6c403" alt="Kix" style="width: 72px">
  <sc-for list="{{tabs}}" as="t" hint-placeholder-count="2">
    <button type="button" onClick="{{t.pick}}">{{t.label}}</button>
  </sc-for>
  <sc-if value="{{done}}" hint-placeholder-val="{{false}}"><span>It's done</span></sc-if>
  <span><svg viewBox="0 0 24 24"><path d="M0 0"/></svg>{{stars}} stars</span>
</div>`,
      ".r{display:grid}",
      "class Component extends DCLogic { state = { tab: 1 }; renderVals() { return {}; } }",
    );
    const { tsx, css, warnings } = portBoard(html, "TestScreen", BLOBS, "Test.dc.html");
    expect(tsx).toContain('"use client";');
    expect(tsx).toContain('<img src="/brand/wordmark-on-dark.svg" alt="myKx" />');
    expect(tsx).toContain('<Art base="/art/kix/dreamlight" sizes="72px" alt="Kix" style={{ width: "72px" }} />');
    expect(tsx).toContain("{vals.tabs.map((t, $index) => (");
    expect(tsx).toContain('<button key={$index} type="button" onClick={t.pick}>{t.label}</button>');
    expect(tsx).toContain("{vals.done && (");
    expect(tsx).toContain("<span>It&apos;s done</span>");
    expect(tsx).toContain("{vals.stars} stars");
    expect(tsx).not.toContain("hint-");
    expect(css).toContain(".r{display:grid}");
    expect(warnings).toEqual([]);
  });

  it("leaves a board without holes or state as a server component", () => {
    const { tsx } = portBoard(board(`<main><h1>Hi</h1></main>`), "Plain", BLOBS);
    expect(tsx).not.toContain('"use client"');
    expect(tsx).not.toContain("useBoardVals");
  });
});
