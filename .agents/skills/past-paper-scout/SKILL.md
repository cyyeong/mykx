---
name: past-paper-scout
description: Find and fetch the latest Singapore school exam papers from the admin-approved sites (sgexam, testpapersfree, sgtestpaper, tutorly, mathtutor) for myKx's levels, respecting robots.txt and site terms, and hand them to the knowledge agent. Load before crawling, downloading or adding any past paper, changing the paper allowlist, or feeding papers into a skill pack.
---

# Past-paper scout

Finds the newest past papers for myKx's levels (P3, P6, Sec 2), downloads the ones a site allows, and gives the admin a click-list for the rest. The papers then go through **Admin → Add knowledge** (multi-PDF upload), where the knowledge agent reads them with Muse Spark vision and grows the right skill pack (SKILL_ENGINE.md §6).

## Rules (never bend these)

1. **Allowlist only.** Fetch only from the sites in `scripts/papers/scout.ts` (`SITES`). Adding a site needs the founder's approval in chat; record it in the table below.
2. **robots.txt and terms decide.** Check robots.txt for both the page's host and the file's host. Disallowed → the admin downloads by hand. A site whose terms forbid reuse → skip until it gives written permission. Never work around a block (no other user agents, no headless browser to get past it, no mirrors).
3. **Be polite.** Identify as `myKx-paper-scout`, wait at least 1.5 s between requests, cap pages, PDFs only, ≤ 20 MB each.
4. **Private reference only** (AGENTS.md rule 10). Papers live in `MYKX_PAPERS_DIR` (default `../mykx-papers`, outside the repo) or the private Supabase bucket. Never commit them, never serve them to children, never show them to another household. The knowledge agent derives **archetypes, exam weights, common traps and mark-scheme cues**; Kix writes fresh questions from those, and every one is reviewed.
5. **Latest only.** Per level and subject, "latest" is the newest year with an end-of-year exam (EOY, SA2 or Prelim) across all sites, plus anything newer. A site with only older free papers is skipped for that level and subject, and the report says so.
6. **Say what went wrong.** Every failure (unreachable, layout changed, robots, terms, size, not a PDF) goes in the report's Problems list and in the summary to the founder.

## Run it

```bash
node scripts/papers/scout.ts            # report only: MYKX_PAPERS_DIR/scout/<date>.md and .json
node scripts/papers/scout.ts --fetch    # also downloads the "auto" papers into MYKX_PAPERS_DIR/<site>/<year>/
```

Then:
1. Read the report's **Problems** and tell the founder.
2. The admin opens the **Download by hand** list, saves the PDFs, and uploads them together with the agent's downloads in Admin → Add knowledge.
3. The knowledge agent routes each paper to its pack (`p3-science`, …) or proposes a new pack (`s2-maths`), extracts, and queues everything for review. Publishing bumps the pack's minor version.

## The sites (checked 28 Oct 2026)

| Site | What it has | Latest seen | Download | Why |
|---|---|---|---|---|
| sgexam.com | P1–P6 by level and subject | 2025 EOY, 2026 P6 prelims | by hand | PDFs are Google Drive links; Drive's robots.txt disallows `/` for bots |
| testpapersfree.com | Primary, secondary, JC; newest first, 25 a page | 2025 | by hand | robots.txt disallows `/paper-file.php`, the download link |
| sgtestpaper.com | Free primary papers to 2020; 2025 sets are paid (etestpaper.com) | 2015–2020 free | skip | no latest free papers; paid papers are out of scope |
| tutorly.sg | File API by topic | 2025 (mostly JC) | skip | terms: no reuse outside personal educational use without written permission |
| mathtutor.com.sg | Secondary maths papers and the tutor's own mock exams | 2024 (Sec 2) | auto | robots.txt allows; still private reference |

Gaps: no allowlisted site lists **Sec 2 Science**; P6 English has no pack yet (the agent proposes one). If a site's layout changes, `lib/papers/scout.ts` (`parseListing`) is the one place to fix, with a test in `scout.test.ts`.
