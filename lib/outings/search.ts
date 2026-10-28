// Server only: one Muse Spark call with web search on the Responses API (docs: the `web_search` tool). It returns the
// answer text and the pages it cited. The run is logged like any other (`model_runs`, operation "web_search"). The
// prompt must never carry a child's name, age or whereabouts (the Scout's prompt is built from the area and interests).
import { assertStandardModel } from "../meta/guard.ts";
import { callSignal, createMetaClient, DEFAULT_SPARK_MODEL, pickRequestId } from "../meta/client.ts";
import { startRun, type RunFields } from "../meta/run.ts";
import type { CallOptions, RunInfo } from "../meta/types.ts";

export interface SearchResult {
  text: string;
  citations: { url: string; title: string | null }[];
  searches: number;
  run: RunInfo;
}

type Annotation = { type?: string; url?: string; title?: string };
type OutputItem = { type?: string; content?: { annotations?: Annotation[] }[] };

export async function sparkSearch(input: string, options: CallOptions & { model?: string } = {}): Promise<SearchResult> {
  const model = assertStandardModel(options.model ?? DEFAULT_SPARK_MODEL);
  const client = createMetaClient({ maxRetries: options.maxRetries });
  const { signal, timedOut } = callSignal(options);
  const clock = startRun("web_search", model);
  const fields: RunFields = {};
  try {
    const { data, response } = await client.responses.create({ model, input, tools: [{ type: "web_search" }] } as never, { signal }).withResponse();
    const r = data as unknown as { id?: string; output_text?: string; output?: OutputItem[]; usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } } };
    fields.requestId = pickRequestId(response.headers);
    fields.responseId = r.id ?? null;
    fields.inputTokens = r.usage?.input_tokens ?? null;
    fields.outputTokens = r.usage?.output_tokens ?? null;
    fields.cachedInputTokens = r.usage?.input_tokens_details?.cached_tokens ?? null;
    const output = r.output ?? [];
    const seen = new Map<string, string | null>();
    for (const item of output) for (const c of item.content ?? []) for (const a of c.annotations ?? []) if (a.type === "url_citation" && a.url && !seen.has(a.url)) seen.set(a.url, a.title ?? null);
    return { text: r.output_text ?? "", citations: [...seen].map(([url, title]) => ({ url, title })), searches: output.filter((o) => o.type === "web_search_call").length, run: clock.finish(fields) };
  } catch (err) {
    throw clock.toError(err, fields, timedOut());
  }
}
