import { describe, expect, it } from "vitest";
import { decide, latestPapers, packFor, parseListing, parseRobots, robotsAllows } from "./scout.ts";

const DRIVE = parseRobots("User-agent: *\nCrawl-delay: 1\nAllow: /$\nAllow: /viewer\nDisallow: /");
const TPF = parseRobots("User-agent: *\nDisallow: /newdesign/\nDisallow: /paper-file.php\nSitemap: https://testpapersfree.com/sitemap.xml");

describe("robots.txt", () => {
  it("reads the * group, honours longest match, and allows everything without a file", () => {
    expect(robotsAllows(TPF, "https://testpapersfree.com/show.php?testpaperid=1")).toBe(true);
    expect(robotsAllows(TPF, "https://testpapersfree.com/paper-file.php?id=1")).toBe(false);
    expect(robotsAllows(DRIVE, "https://drive.google.com/uc?export=download&id=x")).toBe(false);
    expect(robotsAllows(DRIVE, "https://drive.google.com/")).toBe(true);
    expect(robotsAllows(parseRobots(null), "https://sgexam.com/anything")).toBe(true);
    expect(robotsAllows(parseRobots("User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow:"), "https://x.sg/a")).toBe(true);
  });
});

describe("listing pages", () => {
  it("reads sgexam's paper links", () => {
    const html = `<a href="https://sgexam.com/subject/science/2025-p3-science-end-of-year-exam-nanyang-pdf/">2025-P3-Science-End Of Year Exam-Nanyang.pdf</a><a href="https://sgexam.com/grammar">Grammar</a>`;
    expect(parseListing("sgexam", html, "https://sgexam.com/primary-3-science/")).toEqual([
      { site: "sgexam", title: "2025-P3-Science-End Of Year Exam-Nanyang", level: "P3", subject: "science", year: 2025, type: "EOY", school: "Nanyang", pageUrl: "https://sgexam.com/subject/science/2025-p3-science-end-of-year-exam-nanyang-pdf/", fileUrl: null },
    ]);
  });

  it("reads testpapersfree's show pages and skips the 'View paper' duplicates", () => {
    const html = `<a href="/show.php?testpaperid=91330">P3 English 2025 WA1 - ACS Junior</a><a href="/show.php?testpaperid=91330">View paper →</a>`;
    const [p, ...rest] = parseListing("testpapersfree", html, "https://testpapersfree.com/p3/");
    expect(rest).toEqual([]);
    expect(p).toMatchObject({ level: "P3", subject: "english", year: 2025, type: "WA1", school: "ACS Junior", pageUrl: "https://testpapersfree.com/show.php?testpaperid=91330" });
  });

  it("reads sgtestpaper's file links and mathtutor's uploads", () => {
    const sgtp = parseListing("sgtestpaper", `<a href="http://www.sgtestpaper.com/moodle/pluginfile.php/4528/mod_resource/content/1/P3%20Science%20CA1%202015%20ACS%20Junior%20Exam%20Papers.pdf">P3 Science CA1 2015 ACS Junior Exam Papers File</a>`, "https://www.sgtestpaper.com/p3/");
    expect(sgtp[0]).toMatchObject({ level: "P3", subject: "science", year: 2015, type: "CA1", school: "ACS Junior" });
    const mt = parseListing("mathtutor", `<a href="https://mathtutor.com.sg/wp-content/uploads/2024/01/Sec-2-Math-WA1-Mock-Exam-2024.pdf">WA 1 Paper</a>`, "https://mathtutor.com.sg/secondary-2-math-exam-papers/");
    expect(mt[0]).toMatchObject({ level: "Sec 2", subject: "maths", year: 2024, type: "WA1", school: "mathtutor.com.sg mock paper" });
  });
});

describe("latest and decisions", () => {
  const base = { site: "sgexam" as const, pageUrl: "https://sgexam.com/p", fileUrl: null, title: "" };
  it("takes the newest year with an end-of-year exam, plus newer papers", () => {
    const [g] = latestPapers([
      { ...base, level: "P3", subject: "science", year: 2024, type: "EOY", school: "A" },
      { ...base, level: "P3", subject: "science", year: 2025, type: "EOY", school: "B" },
      { ...base, level: "P3", subject: "science", year: 2026, type: "WA1", school: "C" },
    ]);
    expect(g.year).toBe(2025);
    expect(g.papers.map((p) => p.school)).toEqual(["C", "B"]);
  });

  it("routes papers to existing packs or proposes new ones", () => {
    expect(packFor("P3", "science", ["p3-science"])).toEqual({ pack: "p3-science", isNew: false });
    expect(packFor("Sec 2", "maths", ["s2-science"])).toEqual({ pack: "s2-maths", isNew: true });
  });

  it("downloads only where allowed, hands the rest to the admin, and skips on terms or staleness", () => {
    const open = parseRobots(null);
    expect(decide({ ...base, fileUrl: "https://mathtutor.com.sg/wp-content/uploads/a.pdf", level: null, subject: null, year: null, type: null, school: null }, { pageRobots: open, fileRobots: open, termsBlock: null }).fetch).toBe("auto");
    expect(decide({ ...base, fileUrl: "https://drive.google.com/uc?id=x", level: null, subject: null, year: null, type: null, school: null }, { pageRobots: open, fileRobots: DRIVE, termsBlock: null }).fetch).toBe("manual");
    expect(decide({ ...base, level: null, subject: null, year: null, type: null, school: null }, { pageRobots: open, fileRobots: null, termsBlock: "no reuse." }).fetch).toBe("skip");
  });
});
