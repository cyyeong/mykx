import { describe, expect, it } from "vitest";
import { DemoStore } from "../auth/store-demo.ts";
import { findKey } from "./finds.ts";
import { fetchPaper, scanSites, type Getter, type Site } from "./scan.ts";

const SITES: Site[] = [
  { id: "mathtutor", origin: "https://mathtutor.com.sg", pages: ["https://mathtutor.com.sg/secondary-2-math-exam-papers/"] },
  { id: "tutorly", origin: "https://www.tutorly.sg", pages: ["https://www.tutorly.sg/app/exam-papers"], terms: "“No reuse.”" },
];
const MT = `<a href="https://mathtutor.com.sg/wp-content/uploads/2025/10/Sec-2-Math-EOY-Mock-Exam-2025.pdf">EOY</a><a href="https://mathtutor.com.sg/wp-content/uploads/2025/03/Sec-2-Math-WA1-Mock-Exam-2025.pdf">WA1</a><a href="https://mathtutor.com.sg/wp-content/uploads/2024/10/Sec-2-Math-EOY-Mock-Exam-2024.pdf">old</a>`;
const fake =
  (pages: Record<string, string>, asked: string[] = []): Getter =>
  async (url) => {
    asked.push(url);
    return url in pages ? { status: 200, text: pages[url] } : { status: 404, text: "" };
  };

describe("the scout's scan", () => {
  it("reads robots.txt first, keeps the latest year, decides each paper and names the gaps", async () => {
    const asked: string[] = [];
    const scan = await scanSites({ packs: ["s2-maths", "s2-science"], sites: SITES, delayMs: 0, get: fake({ "https://mathtutor.com.sg/secondary-2-math-exam-papers/": MT }, asked) });
    expect(asked[0]).toBe("https://mathtutor.com.sg/robots.txt");
    expect(scan.rows.map((r) => [r.year, r.type, r.fetch, r.pack])).toEqual([
      [2025, "EOY", "auto", "s2-maths"],
      [2025, "WA1", "auto", "s2-maths"],
    ]);
    expect(scan.problems.some((p) => p.startsWith("tutorly: its terms say"))).toBe(true);
    expect(scan.problems.some((p) => p.includes("Sec 2 science"))).toBe(true);
    // Two papers listed on one page get two keys.
    expect(new Set(scan.rows.map(findKey)).size).toBe(2);
  });

  it("skips a listing robots.txt disallows and reports a site it couldn't reach", async () => {
    const get: Getter = async (url) => {
      if (url.endsWith("/robots.txt")) return { status: 200, text: "User-agent: *\nDisallow: /secondary-2" };
      throw new Error("offline");
    };
    const scan = await scanSites({ packs: [], sites: SITES.slice(0, 1), delayMs: 0, get });
    expect(scan.rows).toEqual([]);
    expect(scan.problems[0]).toMatch(/robots\.txt disallows the listing/);
  });
});

describe("downloading a find", () => {
  const res = (body: string | Uint8Array<ArrayBuffer>, status = 200) => new Response(body, { status });
  it("only takes PDFs from approved hosts that robots.txt allows", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.7 tiny");
    const ok = async (u: string) => (u.endsWith("robots.txt") ? res("User-agent: *\nDisallow: /private/") : res(pdf));
    await expect(fetchPaper("https://mathtutor.com.sg/wp-content/uploads/a.pdf", { get: ok })).resolves.toEqual(pdf);
    await expect(fetchPaper("https://elsewhere.example/a.pdf", { get: ok })).rejects.toThrow(/approved list/);
    await expect(fetchPaper("https://mathtutor.com.sg/private/a.pdf", { get: ok })).rejects.toThrow(/robots/);
    await expect(fetchPaper("https://mathtutor.com.sg/a.pdf", { get: async (u) => (u.endsWith("robots.txt") ? res("", 404) : res("<html>")) })).rejects.toThrow(/isn't a PDF/);
  });
});

describe("saving finds", () => {
  it("counts only new papers and keeps an admin's status across runs", async () => {
    const store = new DemoStore();
    const scan = await scanSites({ packs: ["s2-maths"], sites: SITES.slice(0, 1), delayMs: 0, get: fake({ "https://mathtutor.com.sg/secondary-2-math-exam-papers/": MT }) });
    const first = await store.papers.saveScan({ id: "r1", at: "2026-11-02T00:00:00.000Z", trigger: "weekly", problems: [] }, scan.rows);
    expect(first).toMatchObject({ found: 2, fresh: 2, auto: 2 });
    const [a] = await store.papers.finds();
    await store.papers.setFind(a.id, { status: "dismissed" });
    const second = await store.papers.saveScan({ id: "r2", at: "2026-11-09T00:00:00.000Z", trigger: "weekly", problems: [] }, scan.rows);
    expect(second.fresh).toBe(0);
    const again = await store.papers.find(a.id);
    expect(again).toMatchObject({ status: "dismissed", firstSeen: "2026-11-02T00:00:00.000Z", lastSeen: "2026-11-09T00:00:00.000Z" });
    expect((await store.papers.runs(5)).map((r) => r.id)).toEqual(["r2", "r1"]);
  });
});
