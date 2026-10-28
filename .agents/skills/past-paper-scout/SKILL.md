---
name: past-paper-scout
description: Find and fetch the latest Singapore school exam papers from the admin-approved sites (sgexam, testpapersfree, sgtestpaper, tutorly, mathtutor) for myKx's levels, respecting robots.txt and site terms, and hand them to the knowledge agent. Load before crawling, downloading or adding any past paper, changing the paper allowlist, or feeding papers into a skill pack.
---

# Past-paper scout

Finds the newest past papers for myKx's levels (P3, P6, Sec 2), downloads the ones a site allows, and gives the admin a click-list for the rest. The papers then go through **Admin → Add knowledge** (multi-PDF upload), where the knowledge agent reads them with Muse Spark vision and grows the right skill pack (SKILL_ENGINE.md §6).

## Rules (never bend these)

1. **Allowlist only.** Fetch only from the sites in `lib/papers/scan.ts` (`SITES`), shared by the CLI and the weekly job. Adding a site needs the founder's approval in chat; record it in the table below.
2. **robots.txt and terms decide.** Check robots.txt for both the page's host and the file's host. Disallowed → the admin downloads by hand, or a sanctioned API does it (Google's Drive API for public Drive files). A site whose terms forbid reuse → skip until it gives written permission. Never work around a block: no CAPTCHA solving, no sign-in, no other user agents, no headless browser to get past a check, no mirrors.
3. **Be polite.** Identify as `myKx-paper-scout`, wait at least 1.5 s between requests, cap pages, PDFs only, ≤ 20 MB each.
4. **Private reference only** (AGENTS.md rule 10). Papers live in `MYKX_PAPERS_DIR` (default `../mykx-papers`, outside the repo) or the private Supabase bucket. Never commit them, never serve them to children, never show them to another household. The knowledge agent derives **archetypes, exam weights, common traps and mark-scheme cues**; Kix writes fresh questions from those, and every one is reviewed.
5. **Latest only.** Per level and subject, "latest" is the newest year with an end-of-year exam (EOY, SA2 or Prelim) across all sites, plus anything newer. A site with only older free papers is skipped for that level and subject, and the report says so.
6. **Say what went wrong.** Every failure (unreachable, layout changed, robots, terms, size, not a PDF) goes in the report's Problems list and in the summary to the founder.

## Run it

```bash
node scripts/papers/scout.ts            # report only: MYKX_PAPERS_DIR/scout/<date>.md and .json
node scripts/papers/scout.ts --fetch    # also downloads the "auto" papers into MYKX_PAPERS_DIR/<site>/<year>/
```

**Weekly, on its own** (28 Oct): Vercel's scheduler calls `/api/cron/papers` every Monday at 06:00 SGT (`vercel.json`, `0 22 * * 0` UTC) with `Authorization: Bearer $CRON_SECRET` (set it in Vercel; without it the route refuses). It runs the same scan (`lib/papers/scan.ts`), downloads nothing, and saves each latest paper's link and decision to `paper_finds` (one row per run in `scout_runs`; migration `20261030_paper_scout.sql`). Admin → Add knowledge → **New papers found** lists them by level and subject, with the reason per site, and "Run the scout now". For an "auto" find, **Read it with the knowledge agent** has the server download it (allowlisted host and robots.txt checked again, PDF only, ≤ 20 MB) and Muse Spark read it as a school paper (`lib/knowledge/read.ts`), straight into the review queue; the PDF isn't kept. "Manual" finds open the site's page; the admin downloads and uploads them above.

Connectors for the two sites that can't be fetched directly (`scripts/papers/connect.ts`, works from the latest report):

```bash
node --env-file=.env.local scripts/papers/connect.ts sgexam --level P3 --subject science --limit 10
node scripts/papers/connect.ts testpapersfree --level P6 --limit 10
```

- **sgexam → Google Drive API.** sgexam's PDFs are public Drive files. Bots may not use Drive's download links, but the Drive API (`files.get`, `alt=media`, `GOOGLE_API_KEY` with only the Drive API enabled) is Google's sanctioned way to read a public file. Metadata first (PDF only, ≤ 20 MB), 2 s apart, at most 50 a run, stops on a 403/429. A manifest records each file's hash and source.
- **testpapersfree → your browser.** Its download is a form behind Google reCAPTCHA: never automated, never solved by the agent. The connector opens the next pages in the founder's browser; the founder passes the check and downloads, then uploads the PDFs together.

Then:
1. Read the report's **Problems** and tell the founder.
2. The admin opens the **Download by hand** list, saves the PDFs, and uploads them together with the agent's downloads in Admin → Add knowledge.
3. The knowledge agent routes each paper to its pack (`p3-science`, …) or proposes a new pack (`s2-maths`), extracts, and queues everything for review. Publishing bumps the pack's minor version.

## The sites (checked 28 Oct 2026)

| Site | What it has | Latest seen | Download | Why |
|---|---|---|---|---|
| sgexam.com | P1–P6 by level and subject | 2025 EOY, 2026 P6 prelims | Drive API connector | PDFs are public Google Drive files; Drive's robots.txt disallows bot downloads, so the connector uses the Drive API |
| testpapersfree.com | Primary, secondary, JC; newest first, 25 a page | 2025 | by hand (connector opens the pages) | the download (`/paper-file.php`) is disallowed in robots.txt and sits behind reCAPTCHA |
| sgtestpaper.com | Free primary papers to 2020; 2025 sets are paid (etestpaper.com) | 2015–2020 free | skip | no latest free papers; paid papers are out of scope |
| tutorly.sg | File API by topic | 2025 (mostly JC) | skip | terms: no reuse outside personal educational use without written permission |
| mathtutor.com.sg | Secondary maths papers and the tutor's own mock exams | 2024 (Sec 2) | auto | robots.txt allows; still private reference |

Gaps: no allowlisted site lists **Sec 2 Science**; P6 English has no pack yet (the agent proposes one). If a site's layout changes, `lib/papers/scout.ts` (`parseListing`) is the one place to fix, with a test in `scout.test.ts`.
