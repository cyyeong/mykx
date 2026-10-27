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

## 27 Oct 2026, 14:42 SGT

`scripts/smoke-meta.ts` · Node v24.22.0 · key from `MODEL_API_KEY` · 5/6 steps passed · est. cost $0.0217 (budget $0.10)

| Step | Model | Result | Latency | TTFT | Tokens in/out | Est. cost | Request ID | Response ID | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 0. List models (free) | – | pass | – | – | – | – | – | – | 9 models; muse-spark-1.3 listed, muse-image-1.0 listed, sam-3.1 listed. id-like headers: x-request-id (matched: x-request-id) |
| a. Spark chat | `muse-spark-1.3` | pass | 2,462 ms | – | 46/329 | $0.0015 | `235583d3-7c7c-4a4e-b161-a906d9188081` | `chatcmpl-01a17c18-9610-77ae-a298-23fdbefc43dd` | "Hello buddy, frogs drink water through their skin!" (finish: stop) |
| b. Spark structured | `muse-spark-1.3` | pass | 1,807 ms | – | 155/547 | $0.0025 | `6a71ba52-c06c-4a5b-8c57-34d7de3ee3fe` | `chatcmpl-01a17c18-9d5c-7531-a335-562df86d6a24` | zod ok, 3 cards: What is the first stage of a frog's life cycle? / What hatches from a frog's egg? / How does a tadpole become… |
| c. Spark streaming | `muse-spark-1.3` | pass | 2,788 ms | 2,723 ms | 47/625 | $0.0027 | `58383405-6854-4c62-b221-a90f5ba75b97` | `chatcmpl-01a17c18-a13b-746d-9cd2-44fdf8a6f111` | 4 deltas, first token 2,723 ms, total 2,788 ms; usage reported in stream |
| d. Muse Image edit | `muse-image-1.0` | pass | 12,937 ms | – | 1 img (12853/1367) | $0.0100 | `44d5df83-1f6a-4197-9c9b-90b65f751421` | – | 1600x1600 webp, 449 KB; within 25 s alone → art-src/smoke/20261027-1442-d-kix-terrarium.webp |
| e. SAM 3.1 cutout | `sam-3.1` | fail (2 tries) | 4,445 ms | – | 1 img (0/0) | $0.0025 | `5d0209dd-097a-445b-8c90-dfde4b33059e` | `resp_6ae047ec0841afce6f304b75` | SAM found no "star-shaped mascot" in the image (completed) |


## 27 Oct 2026, 14:44 SGT

`scripts/smoke-meta.ts` · Node v24.22.0 · key from `MODEL_API_KEY` · 6/6 steps passed · est. cost $0.0187 (budget $0.10) · transform path (d + e) 25,981 ms vs 25,000 ms Studio budget

| Step | Model | Result | Latency | TTFT | Tokens in/out | Est. cost | Request ID | Response ID | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 0. List models (free) | – | pass | – | – | – | – | – | – | 9 models; muse-spark-1.3 listed, muse-image-1.0 listed, sam-3.1 listed. id-like headers: x-request-id (matched: x-request-id) |
| a. Spark chat | `muse-spark-1.3` | pass | 2,130 ms | – | 46/318 | $0.0014 | `1fa4d15c-41ba-4740-8609-e1ea01c1e103` | `chatcmpl-01a17c1a-8396-732d-8dc7-fb0e9fe59f12` | "Hello buddy, frogs can drink water right through their skin!" (finish: stop) |
| b. Spark structured | `muse-spark-1.3` | pass | 1,842 ms | – | 155/443 | $0.0021 | `10089e3b-a90f-4b04-97c6-320065e976fc` | `chatcmpl-01a17c1a-8ad3-75cc-99f2-aba7228b404b` | zod ok, 3 cards: What is the first stage of a frog's life cycle? / What hatches from frog eggs? / How does a tadpole become a … |
| c. Spark streaming | `muse-spark-1.3` | pass | 2,800 ms | 2,757 ms | 47/622 | $0.0027 | `96c3cf2b-ce5c-413b-9cd0-42111ca949c5` | `chatcmpl-01a17c1a-8e15-7315-94c7-c570bb74a29a` | 4 deltas, first token 2,757 ms, total 2,800 ms; usage reported in stream |
| d. Muse Image edit | `muse-image-1.0` | pass | 20,840 ms | – | 1 img (22406/2187) | $0.0100 | `563cbbf2-6d88-408f-b08e-34e744250cf3` | – | 1600x1600 webp, 472 KB; within 25 s alone → art-src/smoke/20261027-1444-d-kix-terrarium.webp |
| e. SAM 3.1 cutout | `sam-3.1` | pass | 5,141 ms | – | 1 img (0/0) | $0.0025 | `a46f5df5-bdbc-4309-a379-407ab9b3b6e4` | `resp_6ae0486f5716a265a3604005` | from (d); 1 mask(s), covers 21.2%, 955x1043 PNG 1606 KB → art-src/smoke/20261027-1444-e-kix-terrarium-cutout.png |


## 27 Oct 2026, 15:26 SGT

`scripts/smoke-meta.ts` · Node v24.22.0 · key from `MODEL_API_KEY` · 2/2 steps passed · est. cost $0.0001 (budget $0.10)

| Step | Model | Result | Latency | TTFT | Tokens in/out | Est. cost | Request ID | Response ID | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 0. List models (free) | – | pass | – | – | – | – | – | – | 9 models; muse-spark-1.3 listed, muse-image-1.0 listed, sam-3.1 listed. id-like headers: x-request-id (matched: x-request-id) |
| f. Voice transcribe | `muse-voice-transcribe-1.0` | pass | 2,139 ms | – | – | $0.0001 | – | `voyager/transcribe/C4F50A4006FB40D68CAA92A51B0CFA98` | said "Kix, why does the tadpole lose its tail?" → heard "Kicks, why does the tadpole lose its tail?." (2400 ms audio, session voyager/transcribe/C4F50A4006FB40D68CAA92A51B0CFA98) |

