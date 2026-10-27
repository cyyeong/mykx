# Meta Model API smoke log

Appended by `scripts/smoke-meta.ts`, one dated section per run, newest last:

```sh
node --env-file=.env.local scripts/smoke-meta.ts
```

Steps: **(0)** list models (free; also records which request-id headers the API sends) · **(a)** Muse Spark chat · **(b)** Spark structured output: 3 frog life-cycle flashcards, zod-validated · **(c)** Spark streaming: time to first token and total · **(d)** Muse Image edit of `public/art/kix/kix-base.webp` into the Terrarium pack · **(e)** SAM 3.1 cutout of Kix from (d) to a transparent PNG.

- Costs are estimates from `lib/meta/pricing.ts`; the Meta billing page is the source of truth. A run is capped at $0.10 and each step is retried at most once.
- "Request ID" is the first of `x-request-id`, `request-id`, `x-fb-request-id`, `x-fb-trace-id` present in the response headers; "Response ID" is the id in the body (`chatcmpl-…`, `resp_…`).
- Outputs go to `art-src/smoke/` (git-ignored). They are throwaway test images, not kept assets, so they get no `public/art/manifest.json` entry.
- Prompts are synthetic: no child data (hard rule 1).

## 27 Oct 2026, 12:00 SGT · not run live

Blocked: `.env.local` has no `MODEL_API_KEY` yet. `lib/meta` and this script were checked only against a local fake of the API (request bodies, SSE streams, SAM parsing, request ids, errors, timeouts). Run the command above once the key is in place; its section will appear below.
