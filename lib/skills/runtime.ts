// The Skill Engine runtime (docs/prd/SKILL_ENGINE.md §5). An agent starts with its quest's pack loaded and can
// load one more of the child's own packs on demand. Muse Spark calls tools; trusted code runs every one of them:
// read one reference section by id, find reviewed items (never their answers), check an answer by code, read a
// Notebook page. A deterministic policy decides what may load, and every load, refusal and tool call becomes a
// skill event for Under the hood (ids and names only, never a child's words). No RAG: sections are chosen by id
// from an index the agent sees. Server only.
import type { ChatCompletionMessageToolCall, ChatCompletionTool } from "openai/resources/chat/completions";
import type { NotebookPage, StoredSkillEvent } from "../auth/store.ts";
import { markItem } from "../domain/marking.ts";
import type { SparkMessage, SparkToolsRequest, SparkToolsResult } from "../meta/spark.ts";
import { PAGES } from "../notebook/notebook.ts";
import type { SkillItem, SkillManifest, SkillTopic } from "../types.ts";
import { allPackIds, overridesGeneration, packFile, packFilesIn } from "./overrides.ts";
import { SkillItemSchema, SkillManifestSchema } from "./schema.ts";

export type SkillAgent = "tutor" | "ask-kix";
export type ToolName = "load_skill" | "read_reference" | "find_items" | "check_answer" | "notebook_read";

/** What each agent may do (SKILL_ENGINE §5 "Agents in the MVP"). */
export const POLICY: Record<SkillAgent, { tools: ToolName[]; maxLoaded: number; maxRounds: number }> = {
  tutor: { tools: ["load_skill", "read_reference", "find_items", "check_answer", "notebook_read"], maxLoaded: 2, maxRounds: 3 },
  "ask-kix": { tools: ["load_skill", "read_reference", "find_items", "notebook_read"], maxLoaded: 2, maxRounds: 3 },
};

const SECTION_MAX = 2400;
const READS_MAX = 4;

export interface Section {
  /** `p3-science/content-cycles#4`: pack, file stem and the section's place in the manifest. */
  id: string;
  title: string;
  file: string;
}

export interface Pack {
  id: string;
  title: string;
  level: string;
  subject: string;
  version: string;
  /** The manifest's topics (titles, weights and subskills): the Learn pages show them as they are. */
  topics: SkillTopic[];
  sections: Section[];
  items: SkillItem[];
  core: string;
}

const cache = new Map<string, Pack | null>();

/** One published pack with its section index and reviewed items, or null. Reads the pack's published version when
 *  an admin has published one (lib/skills/overrides.ts), else the pack on disk. */
export function loadPack(id: string, root = process.cwd()): Pack | null {
  const key = `${overridesGeneration()}|${root}|${id}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  if (cache.size > 200) cache.clear();
  let pack: Pack | null = null;
  try {
    const manifestText = packFile(id, "skill.json", root);
    const parsed = manifestText === null ? null : SkillManifestSchema.safeParse(JSON.parse(manifestText));
    if (parsed?.success && parsed.data.status === "published") {
      const m = parsed.data as SkillManifest;
      const sections = m.references.flatMap((r) => {
        const stem = r.file.replace(/^references\//, "").replace(/\.md$/, "");
        return (r.sections ?? []).map((title, i) => ({ id: `${m.id}/${stem}#${i + 1}`, title, file: r.file }));
      });
      const items: SkillItem[] = [];
      for (const f of packFilesIn(id, "items", root)) {
        let raw: unknown;
        try {
          raw = JSON.parse(packFile(id, f, root) ?? "[]");
        } catch {
          continue;
        }
        for (const r of Array.isArray(raw) ? raw : []) {
          const item = SkillItemSchema.safeParse(r);
          if (item.success && item.data.status === "reviewed" && item.data.skill === m.id) items.push(item.data as SkillItem);
        }
      }
      const core = (packFile(id, "SKILL.md", root) ?? "").slice(0, 1600);
      pack = { id: m.id, title: m.title, level: m.level, subject: m.subject, version: m.version, topics: m.topics, sections, items, core };
    }
  } catch {
    pack = null;
  }
  cache.set(key, pack);
  return pack;
}

/** The packs a child at this level may load ("P3" → p3-*, "Sec 2" → s2-*), published only: on disk, or imported. */
export function packsForChild(level: string | null, root = process.cwd()): string[] {
  const prefix = level?.startsWith("Sec") ? `s${level.slice(4).trim()}-` : `${(level ?? "P3").toLowerCase()}-`;
  return allPackIds(root).filter((p) => p.startsWith(prefix) && loadPack(p, root));
}

/** One section's text: from its heading to the next heading of the same or a higher level, trimmed. */
export function readSection(sectionId: string, root = process.cwd()): { section: Section; text: string } | null {
  const packId = sectionId.split("/")[0];
  const pack = loadPack(packId, root);
  const section = pack?.sections.find((s) => s.id === sectionId);
  if (!section) return null;
  const lines = (packFile(packId, section.file, root) ?? "").split("\n");
  const start = lines.findIndex((l) => /^#{1,4}\s/.test(l) && l.replace(/^#+\s*/, "").trim() === section.title);
  if (start < 0) return null;
  const level = (lines[start].match(/^#+/) ?? ["#"])[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const h = lines[i].match(/^(#{1,6})\s/);
    if (h && h[1].length <= level) {
      end = i;
      break;
    }
  }
  const text = lines.slice(start, end).join("\n").trim();
  return { section, text: text.length > SECTION_MAX ? `${text.slice(0, SECTION_MAX)}\n…` : text };
}

/** An item as an agent may see it: never the answer, working, hints or distractor notes. */
export function publicItem(i: SkillItem) {
  return { id: i.id, topic: i.topic, subskill: i.subskill, difficulty: i.difficulty, type: i.type, stem: i.stem, ...(i.options ? { options: i.options } : {}) };
}

export interface AgentState {
  agent: SkillAgent;
  level: string | null;
  allowed: string[];
  loaded: string[];
  /** The question the child is answering now: Kix may never check it for them. */
  currentItemId: string | null;
  notebook: readonly NotebookPage[];
  reads: { id: string; title: string; text: string }[];
  events: Omit<StoredSkillEvent, "at" | "householdId" | "profileId">[];
  root: string;
}

const event = (s: AgentState, kind: StoredSkillEvent["kind"], pack: string | null, tool: ToolName | null, target: string | null, ok: boolean, note: string | null = null) =>
  s.events.push({ agent: s.agent, kind, pack, tool, target: target?.slice(0, 120) ?? null, ok, note: note?.slice(0, 160) ?? null });

/** Load a pack if the policy allows it: the child's own level, published, and no more than `maxLoaded` at once. */
export function loadSkill(s: AgentState, pack: string, how: "auto" | "on_demand"): { ok: true } | { ok: false; reason: string } {
  if (s.loaded.includes(pack)) return { ok: true };
  const refuse = (reason: string) => {
    event(s, "refuse", pack, how === "auto" ? null : "load_skill", pack, false, reason);
    return { ok: false as const, reason };
  };
  if (!s.allowed.includes(pack)) return refuse(`not one of this child's packs (${s.allowed.join(", ") || "none"})`);
  if (s.loaded.length >= POLICY[s.agent].maxLoaded) return refuse(`at most ${POLICY[s.agent].maxLoaded} packs at once`);
  s.loaded.push(pack);
  event(s, "load", pack, how === "auto" ? null : "load_skill", pack, true, how);
  return { ok: true };
}

/** The index the agent sees: each loaded pack's core notes and its sections by id. */
export function packIndex(s: AgentState): string {
  return s.loaded
    .map((id) => loadPack(id, s.root))
    .filter((p): p is Pack => Boolean(p))
    .map((p) => `## Loaded pack ${p.id}@${p.version}: ${p.title}\n${p.core}\n### Sections (read one with read_reference)\n${p.sections.map((x) => `- ${x.id}: ${x.title}`).join("\n")}`)
    .join("\n\n");
}

/** Tool definitions for Muse Spark (OpenAI function format), limited to the agent's policy. */
export function toolDefs(s: AgentState): ChatCompletionTool[] {
  const fn = (name: ToolName, description: string, properties: Record<string, unknown>, required: string[]): ChatCompletionTool => ({
    type: "function",
    function: { name, description, parameters: { type: "object", additionalProperties: false, properties, required } },
  });
  const all: Record<ToolName, ChatCompletionTool> = {
    load_skill: fn("load_skill", "Load another of this child's skill packs (another subject at their level) when the question needs it. The child's own packs only; at most two loaded at once.", { pack: { type: "string", enum: s.allowed } }, ["pack"]),
    read_reference: fn("read_reference", "Read one section of a loaded pack's references, by its id from the section list (e.g. p3-science/content-cycles#4). Use it before explaining a method or a fact you need to get right.", { section: { type: "string" } }, ["section"]),
    find_items: fn("find_items", "Find reviewed practice questions in a loaded pack (never their answers), to suggest a similar one.", { pack: { type: "string" }, topic: { type: "string" }, subskill: { type: "string" }, n: { type: "integer", minimum: 1, maximum: 3 } }, ["pack"]),
    check_answer: fn("check_answer", "Check an answer to a practice question by code. Not for the question the child is answering now: they submit that themselves.", { item_id: { type: "string" }, answer: { type: "string" } }, ["item_id", "answer"]),
    notebook_read: fn("notebook_read", "Read one page of Kix's Notebook about this child (how they like to learn), to pitch the help.", { page: { type: "string", enum: [...PAGES] } }, ["page"]),
  };
  return POLICY[s.agent].tools.map((t) => all[t]);
}

/** Runs one tool call with trusted code. Returns the text the model sees. */
export function runTool(s: AgentState, name: string, rawArgs: string): string {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArgs || "{}") as Record<string, unknown>;
  } catch {
    event(s, "tool", null, null, name, false, "arguments were not JSON");
    return "Error: arguments must be JSON.";
  }
  const str = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : "");
  if (!POLICY[s.agent].tools.includes(name as ToolName)) {
    event(s, "refuse", null, null, name, false, "tool not allowed for this agent");
    return `Error: ${name} is not available.`;
  }
  switch (name as ToolName) {
    case "load_skill": {
      const r = loadSkill(s, str("pack"), "on_demand");
      return r.ok ? `Loaded.\n${packIndex({ ...s, loaded: [str("pack")] })}` : `Refused: ${r.reason}.`;
    }
    case "read_reference": {
      const id = str("section");
      const pack = id.split("/")[0];
      if (!s.loaded.includes(pack)) {
        event(s, "refuse", pack, "read_reference", id, false, "pack not loaded");
        return "Refused: load that pack first.";
      }
      if (s.reads.length >= READS_MAX) {
        event(s, "refuse", pack, "read_reference", id, false, "read limit");
        return "Refused: enough reading for one answer.";
      }
      const r = readSection(id, s.root);
      event(s, "tool", pack, "read_reference", id, Boolean(r), r ? cleanTitle(r.section.title) : "no such section");
      if (!r) return "No such section. Use an id from the section list.";
      s.reads.push({ id, title: r.section.title, text: r.text });
      return r.text;
    }
    case "find_items": {
      const pack = str("pack");
      const p = s.loaded.includes(pack) ? loadPack(pack, s.root) : null;
      if (!p) {
        event(s, "refuse", pack || null, "find_items", pack, false, "pack not loaded");
        return "Refused: load that pack first.";
      }
      const n = Math.min(3, Math.max(1, Number(args.n) || 2));
      const topic = str("topic").toLowerCase();
      const sub = str("subskill").toLowerCase();
      const found = p.items.filter((i) => i.id !== s.currentItemId && (!topic || i.topic.toLowerCase().includes(topic)) && (!sub || i.subskill.toLowerCase().includes(sub))).slice(0, n);
      event(s, "tool", pack, "find_items", [topic && `topic ${topic}`, sub && `subskill ${sub}`].filter(Boolean).join(", ") || "any", true, `${found.length} found`);
      return JSON.stringify(found.map(publicItem));
    }
    case "check_answer": {
      const itemId = str("item_id");
      if (itemId === s.currentItemId) {
        event(s, "refuse", null, "check_answer", itemId, false, "the child's current question");
        return "Refused: the child checks this one by submitting their own answer.";
      }
      const item = s.loaded.map((id) => loadPack(id, s.root)).flatMap((p) => p?.items ?? []).find((i) => i.id === itemId);
      if (!item) {
        event(s, "tool", null, "check_answer", itemId, false, "no such item in a loaded pack");
        return "No such item in a loaded pack.";
      }
      const answer = str("answer");
      const mark = markItem(item, item.type === "mcq" ? Number(answer) : answer);
      const verdict = mark.correct === null ? "needs a grown-up to check" : mark.correct ? "correct" : "not correct";
      event(s, "tool", item.skill, "check_answer", itemId, true, verdict);
      return verdict;
    }
    case "notebook_read": {
      const slug = str("page");
      const page = s.notebook.find((p) => p.slug === slug);
      event(s, "tool", null, "notebook_read", slug, true, page?.body.trim() ? "read" : "empty page");
      return page?.body.trim() ? page.body.slice(0, 1500) : "This page is empty so far.";
    }
  }
  return "Error: unknown tool.";
}

export type ToolsCall = (req: SparkToolsRequest) => Promise<SparkToolsResult>;

export interface AgentRun {
  text: string;
  state: AgentState;
  rounds: number;
}

/**
 * The agent loop: Muse Spark answers or calls tools; code runs the tools and hands back the results, up to the
 * policy's rounds, after which it must answer with what it has. Throws if the model fails, so the caller's
 * cached fallback answers instead (rule 7).
 */
export async function runSkillAgent(o: {
  agent: SkillAgent;
  level: string | null;
  autoPack: string | null;
  currentItemId?: string | null;
  notebook?: readonly NotebookPage[];
  system: string;
  user: SparkMessage;
  call: ToolsCall;
  root?: string;
}): Promise<AgentRun> {
  const root = o.root ?? process.cwd();
  const s: AgentState = { agent: o.agent, level: o.level, allowed: packsForChild(o.level, root), loaded: [], currentItemId: o.currentItemId ?? null, notebook: o.notebook ?? [], reads: [], events: [], root };
  if (o.autoPack) loadSkill(s, o.autoPack, "auto");
  const messages: SparkMessage[] = [
    { role: "system", content: `${o.system}\n\n# Your skills\nUse the tools: read a section before explaining a method; load another of the child's packs only if the question is in another subject.\n\n${packIndex(s)}` },
    o.user,
  ];
  const max = POLICY[o.agent].maxRounds;
  for (let round = 0; ; round++) {
    const last = round >= max;
    const res = await o.call({ messages, tools: toolDefs(s), toolChoice: last ? "none" : "auto" });
    const calls: ChatCompletionMessageToolCall[] = res.toolCalls ?? [];
    if (!calls.length || last) return { text: res.text, state: s, rounds: round + 1 };
    messages.push({ role: "assistant", content: res.text || null, tool_calls: calls });
    for (const c of calls) messages.push({ role: "tool", tool_call_id: c.id, content: c.type === "function" ? runTool(s, c.function.name, c.function.arguments) : "Error: unsupported tool." });
  }
}

/** The trace a child's screen may show: which skills Kix loaded and which sections it read (titles only). */
export function publicTrace(s: AgentState): { loaded: string[]; read: string[] } {
  return { loaded: [...s.loaded], read: s.reads.map((r) => cleanTitle(r.title)).slice(0, 4) };
}

/** "3. Animal groups (`animal_groups`)" → "Animal groups": a section title fit for a child's screen. */
export function cleanTitle(t: string): string {
  return t.replace(/^\s*[\dA-Z]+[.)]\s+/, "").replace(/\s*\(`[^)]*`\)\s*/g, " ").replace(/`/g, "").replace(/\s+/g, " ").trim().slice(0, 48);
}
