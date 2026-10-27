---
name: meta-model-api
description: Reference for calling Meta's models from myKx code — Meta Model API (api.meta.ai/v1) model IDs, Standard vs Contributor mode, chat completions, Responses API, structured output, streaming, Muse Image, SAM 3.1, Muse Voice Transcribe, pricing, rate limits, retries, and Baseten-hosted Muse Spark Open. Load before writing or changing any code that calls a Meta model, choosing a model for a task, estimating cost, or wiring provider switching.
---

# Meta Model API reference (checked 27 Oct 2026)

Docs: https://dev.meta.ai/docs/overview. Items marked **unverified** have not been exercised with a myKx key yet. Confirm them with a smoke test before relying on them.

## Auth and client

- Base URL `https://api.meta.ai/v1`, header `Authorization: Bearer <key>`.
- Env: docs use `MODEL_API_KEY`; Muse CLI reads `META_API_KEY`. In myKx server code, read `MODEL_API_KEY ?? META_API_KEY`. **Server-side only**, never in a client bundle.
- Drop-in compatible with the OpenAI SDK (and Anthropic SDK):

```ts
import OpenAI from "openai";
export const meta = new OpenAI({ baseURL: "https://api.meta.ai/v1", apiKey: process.env.MODEL_API_KEY ?? process.env.META_API_KEY });
```

## Models, price per 1M tokens (input / output / cached input)

| ID | Use in myKx | Price |
|---|---|---|
| `muse-spark-1.3` (Standard) | Kix tutor, hints, parent summary narration, homework-photo extraction (vision/PDF), safety screening of teen "flair" text | $1.25 / $4.25 / $0.15 |
| `muse-spark-1.3-contributor` | **dev-only**, synthetic data only. Prompts and outputs may train Meta models | $0.10 / $0.20 / $0.002 |
| `muse-wonder-1.0` (Standard only, preview) | rare hard reasoning: Vibe brief → spec validation | $4 / $20 / $0.20 |
| `muse-image-1.0` | all art (see `muse-image-assets`) | $0.01/image |
| `sam-3.1` | sticker cutouts; optional science-object highlight | $2.50 per 1k images |
| `muse-voice-transcribe-1.0` | optional "Hey Kix" voice input | $0.18/hour |

**Rule:** anything that touches a child's data (attempts, names, homework photos, summaries) uses **Standard** models. Contributor mode is only for Muse Code development on synthetic or fixture data. Muse Code's default model here is `muse-spark-1.3-contributor`, so never paste real child data into a Muse Code session.

Rate limits (per team): Spark/Wonder Standard 3,000 RPM / 4M TPM; contributor 150 RPM; Muse Image 150 RPM; SAM 3,000 RPM.
Retries: on 429/5xx, exponential backoff from ~500 ms with jitter, honour `Retry-After`, max 2 retries. Watch `x-ratelimit-remaining-*`.

## Chat completions + structured output

```ts
const res = await meta.chat.completions.create({
  model: "muse-spark-1.3",
  messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
  response_format: { type: "json_schema", json_schema: { name: "hint", schema: HintSchema } },
});
const hint = JSON.parse(res.choices[0].message.content!);
```

- Schemas: no recursive `$ref` (HTTP 400). Use `additionalProperties: false`, list every field in `required`, and use `enum` for closed sets.
- Streaming: `stream: true` on chat completions (OpenAI SDK semantics). **Unverified** for json_schema plus stream together. Stream plain text for the tutor and use non-streamed calls for structured output.
- Vision/PDF: OpenAI-style `image_url` content parts. File handling docs: PDF text up to page 100, images up to page 50; inline ≤ 50 MB, Files API ≤ 1 GiB. myKx limits uploads to 10 MB / 20 pages.

## Responses API (`POST /v1/responses`)

- Used by Muse Wonder, SAM 3.1 and multi-turn Muse Image (`previous_response_id`).
- Reasoning: `reasoning: { effort: "high" }`.
- Structured output here is `text.format`. Sending `response_format` returns HTTP 400.

## Muse Image

`/v1/images/generations` and `/v1/images/edits`, `n` 1–10, `size: "WxH"` (aspect ratio), `output_format` webp|png|jpeg, `response_format` b64_json|url. No transparency. Full details, prompts and script: `muse-image-assets`.

## SAM 3.1

```ts
const stream = await meta.responses.create({
  model: "sam-3.1",
  input: [{ type: "message", role: "user", content: [
    { type: "input_text", text: "star-shaped mascot" },          // short noun phrase, one object
    { type: "input_image", image_url: dataUrlOrHttpsUrl },
  ]}],
  stream: true,
});
// output_text: one line per image → boxes (x1,y1,x2,y2,w,h in source px) + one-bit masks.
// Decode masks with @meta-sam/parser decodeMaskToRaster → Uint8Array(W*H) of 0/1. Empty output = no match.
```

Box and point prompt JSON shapes: see the "segmenting with prompts" guide (**unverified**).

## Voice (optional)

`POST /v1/asr/transcribe` (file) or `wss://api.meta.ai/v1/asr/realtime`. Meta has no text-to-speech model, so use browser `speechSynthesis` for Kix read-aloud.

## Open weights: Muse Spark Open via Baseten (bonus: Best Build on Meta Open Weight Models)

- Endpoint `https://inference.baseten.co/v1/chat/completions` (OpenAI-compatible), model **`meta-models/muse-spark-open-1026`** (hackathon alias; the docs say `muse-spark-open`). Key: `BASETEN_API_KEY`.
- Bounded role: de-identified topic tagging (≤ 2k input / 128 output) behind the same typed adapter as Spark, so one env flag switches providers.
- Access and credits are **unverified** (Baseten credits are request-and-review). Cap setup at 45 min. If access fails, ship without it.

## Logging (every call)

Record provider, model, prompt/schema version, latency, usage tokens, request ID and output hash in `model_runs`. This is the "genuine provider evidence" shown in the demo.
