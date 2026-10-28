// Server only: Muse Spark (Standard) reads one PDF into question patterns, traps and marking cues (and items, for our
// own or licensed material), routed to a skill pack (lib/knowledge/knowledge.ts). Used by Admin → Add knowledge and
// by the weekly paper scout's "Read it" (app/api/admin/papers). The PDF itself is never kept (rule 10); school
// papers keep patterns only (settle enforces it).
import { randomUUID } from "node:crypto";
import { publishedInstructions } from "../agents/runtime.ts";
import { hasMetaApiKey } from "../meta/client.ts";
import { sparkStructured } from "../meta/spark.ts";
import { extractionPrompt, extractionSchema, settle, type KnowledgeUpload, type Rights } from "./knowledge.ts";
import { packsOnDisk } from "./packs.ts";

export async function readPaper(o: { bytes: Uint8Array; fileName: string; rights: Rights; sourceUrl: string | null; uploadedBy: string; signal?: AbortSignal }): Promise<KnowledgeUpload> {
  const packs = packsOnDisk();
  const base: KnowledgeUpload = {
    id: randomUUID(),
    uploadedBy: o.uploadedBy,
    fileName: o.fileName.slice(0, 200),
    bytes: o.bytes.length,
    rights: o.rights,
    sourceUrl: o.sourceUrl,
    status: "failed",
    pack: null,
    packIsNew: false,
    extraction: null,
    review: {},
    publishedIn: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  if (!hasMetaApiKey()) return { ...base, error: "The Meta model key isn't set on this server, so the paper couldn't be read." };
  try {
    const { data } = await sparkStructured(
      {
        messages: [
          // The curator's published instructions (editable in Under the hood) with its fixed guardrails.
          { role: "system", content: extractionPrompt(o.rights, Object.fromEntries(packs.map((p) => [p.id, p.topics])), (await publishedInstructions("knowledge-agent")).text) },
          {
            role: "user",
            content: [
              { type: "text", text: `File: ${base.fileName}` },
              { type: "file", file: { filename: base.fileName, file_data: `data:application/pdf;base64,${Buffer.from(o.bytes).toString("base64")}` } },
            ],
          },
        ],
        schema: extractionSchema,
        schemaName: "knowledge_extraction",
        reasoningEffort: "medium",
      },
      { timeoutMs: 240_000, signal: o.signal },
    );
    const settled = settle(data, o.rights, packs.map((p) => p.id));
    return { ...base, status: "ready", extraction: settled.extraction, pack: settled.pack, packIsNew: settled.packIsNew };
  } catch (e) {
    return { ...base, error: `Muse Spark couldn't read it: ${(e as Error).message.slice(0, 200)}` };
  }
}
