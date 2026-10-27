import { describe, expect, it } from "vitest";
import { parseBlocks, parseInline, plainText, splitParagraphs, visualWidth } from "./markup.ts";

describe("parseInline", () => {
  it("reads bold, underline, blanks, numbered blanks, line breaks and &nbsp;", () => {
    expect(parseInline("Which is **only** living?")).toEqual([
      { t: "text", v: "Which is " },
      { t: "b", c: [{ t: "text", v: "only" }] },
      { t: "text", v: " living?" },
    ]);
    expect(parseInline("以下哪一个句子是__不对__的？")[1]).toEqual({ t: "u", c: [{ t: "text", v: "不对" }] });
    expect(parseInline("The box ____ on the shelf.")[1]).toEqual({ t: "blank" });
    expect(parseInline("went ___(1)___ the library")[1]).toEqual({ t: "blank", label: "(1)" });
    expect(parseInline("a\nb")[1]).toEqual({ t: "br" });
    expect(parseInline("1250, &nbsp;1350")).toEqual([{ t: "text", v: "1250,  1350" }]);
  });
});

describe("parseBlocks", () => {
  it("reads paragraphs, tables and lists", () => {
    const blocks = parseBlocks("The table shows it.\n\n| Stage | Days |\n| --- | --- |\n| egg | 3 |\n\n- one\n- **two**");
    expect(blocks.map((b) => b.t)).toEqual(["p", "table", "ul"]);
    const table = blocks[1] as Extract<(typeof blocks)[number], { t: "table" }>;
    expect(table.head).toHaveLength(2);
    expect(table.rows).toEqual([[[{ t: "text", v: "egg" }], [{ t: "text", v: "3" }]]]);
  });

  it("joins a header cell that wraps onto the next line", () => {
    const [table] = parseBlocks("| Bread | Sprinkled\nwith water |\n| --- | --- |\n| A | ✓ |");
    expect(table.t).toBe("table");
    const t = table as Extract<typeof table, { t: "table" }>;
    expect(t.head[1]).toEqual([{ t: "text", v: "Sprinkled" }, { t: "br" }, { t: "text", v: "with water" }]);
    expect(t.rows).toHaveLength(1);
  });

  it("can turn every line of a passage into its own paragraph", () => {
    expect(parseBlocks("line one\nline two", { linesAsParagraphs: true })).toHaveLength(2);
    expect(parseBlocks("line one\nline two")).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("splits paragraphs, strips markup and measures CJK as double width", () => {
    expect(splitParagraphs("a\n\n b \n\n\nc")).toEqual(["a", "b", "c"]);
    expect(plainText("**bold** and __u__ ___(2)___")).toBe("bold and u (2)");
    expect(visualWidth("准")).toBe(2);
    expect(visualWidth("is")).toBe(2);
  });
});
