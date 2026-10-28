// Server only: what Under the hood's agent editor shows for each agent. Its instructions and versions (editable
// agents), the guardrails, what code checks whatever the model says, the models and tools it uses; or, for the
// five with nothing to edit, why. Platform content only: never a child's data (rule 13).
import { AGENTS, type Agent } from "../admin/hood.ts";
import type { AuthStore, StoredAgentVersion } from "../auth/store.ts";
import { POLICY } from "../skills/runtime.ts";
import { AGENT_PROMPTS, defaultText, isEditableAgent, MAX_INSTRUCTIONS, type EditableAgent } from "./instructions.ts";
import { currentOf, draftOf, nextVersion, publishedOf, publishTarget } from "./versions.ts";

/** An agent's id in the editor and in agent_versions: the route its calls are logged under, else its own id. */
export const agentKey = (a: Agent) => a.route ?? a.id;
export const agentByKey = (key: string) => AGENTS.find((a) => agentKey(a) === key) ?? null;

interface Facts {
  /** Tools and inputs besides the model itself. */
  tools: string[];
  /** How the output is checked in code. */
  output: string;
  /** What holds whatever the instructions say. */
  enforced: string[];
}

const FACTS: Record<EditableAgent, Facts> = {
  tutor: {
    tools: [...POLICY.tutor.tools, "skill pack index"],
    output: "Hints: plain text. Reasons: reason_coach (reasonCoachSchema).",
    enforced: [
      "Distress words skip the model: the caring reply and the helplines answer instead (rule 12).",
      "The Skill Engine refuses check_answer on the child's current question and loads only their own level's packs.",
      "Every ask counts as a hint, so a helped answer is never mastery evidence (rule 5).",
      "After a wrong answer, `better` is set to null whatever the model says.",
    ],
  },
  "ask-kix": {
    tools: [...POLICY["ask-kix"].tools, "photo (vision)"],
    output: "kix_homework (explanationSchema), drawn by trusted components.",
    enforced: [
      "enforceStage strips the final answer and try-this before the full stage (guide first).",
      "The photo is face-checked on the device, read once and never stored.",
      "Distress words skip the model (rule 12).",
      "The research step that loads the pack and reads its method is fixed in code (Skill Engine).",
    ],
  },
  "memory-keeper": {
    tools: [],
    output: "session_read (sessionReadSchema): a mood with evidence and at most 5 Notebook patches.",
    enforced: [
      "applyPatches refuses label and diagnosis words, dedupes and caps each page (rule 11).",
      "A distress word always sets concern, whatever the model says.",
      "Only the child's own words to Kix are read; family messages never are (rule 12).",
      "It never touches mastery or rewards (rule 5).",
    ],
  },
  vibe: {
    tools: [],
    output: "flashcard spec (flashcardSpecSchema): 3 to 8 cards, pictures from a fixed list of four.",
    enforced: ["Trusted components draw the validated spec: no model-written code runs (rule 4).", "Saving pays the deterministic creation reward once (rule 5)."],
  },
  "knowledge-agent": {
    tools: ["PDF (file input)"],
    output: "knowledge_extraction (extractionSchema).",
    enforced: [
      "settle empties items for school papers whatever the model returns (rule 10).",
      "Routing to a pack is code (packFor), not the model.",
      "An admin reviews every pattern before anything is published.",
    ],
  },
  "home-reader": {
    tools: ["camera frames (vision)"],
    output: "home_reading (readerSchema).",
    enforced: [
      "settleReading nulls adults' names and cues, and accepts a child's name only from the household's nicknames at confidence 0.5 or more (rule 15).",
      "Alerts are raised by rules, never by the model, and every one needs the parent's Right / Not right.",
      "Unflagged frames are dropped after the read; flagged ones are kept 24 h.",
    ],
  },
  "guardian-brief": {
    tools: [],
    output: "guardian_brief: 10 to 360 characters.",
    enforced: ["It is given facts as words only: no coordinates.", "Cached per family by a digest of the facts.", "fallbackBrief says the same facts when the model fails."],
  },
  "outing-scout": {
    tools: ["web_search (Responses API)"],
    output: "Text with url_citation annotations; a run without citations fails.",
    enforced: ["Only the home area, radius, dates and interests can be filled in: never a child's name, age or whereabouts (rule 15)."],
  },
  "outing-planner": {
    tools: [],
    output: "outing_plan (plannerSchema).",
    enforced: ["settleIdeas drops any idea whose source the Scout didn't cite.", "It has no web access."],
  },
  tonight: {
    tools: [],
    output: "tonight_summary: 20 to 620 characters.",
    enforced: ["Facts come from the database and the Guardian rollups; the model only narrates.", "Cached per family by digest, at most every 5 minutes.", "fallbackTonight answers when the model fails."],
  },
};

/** Why an agent has nothing to edit. */
const READ_ONLY: Record<string, string> = {
  studio: "Muse Image gets a prompt built in code: Kix's canon, the picked world's style and up to two interest chips (lib/studio/prompt.ts). There is no free text, so a child's words or photo never reach it, and the art stays original (rules 2 and 4).",
  voice: "Speech to text has no instructions: Muse Voice Transcribe turns a push-to-talk clip of up to 30 s into words, and the audio is never kept (rule 9).",
  guardian: "No model: heartbeats, focus, mood from words and flags are tested rules in code (lib/guardian).",
  "whos-who": "SAM 3.1 gets one fixed prompt, \"child\", on a flagged frame. It draws outlines; it never identifies anyone (rule 15).",
  scout: "No model: an allowlist of five sites, robots.txt and tested parsers (lib/papers).",
  "skill-editor": "Its prompt is fixed in code for now (lib/skills/enhance.ts): it proposes changes to a skill as a diff an admin reviews and accepts into a draft; nothing it writes is published by itself.",
};

export interface AgentListRow {
  key: string;
  name: string;
  models: string[];
  editable: boolean;
  /** The version Kix uses (1 is the built-in default); null for agents with nothing to edit. */
  published: number | null;
  draft: number | null;
}

export function agentList(rows: readonly StoredAgentVersion[]): AgentListRow[] {
  return AGENTS.map((a) => {
    const key = agentKey(a);
    if (!isEditableAgent(key)) return { key, name: a.name, models: a.models, editable: false, published: null, draft: null };
    const mine = rows.filter((r) => r.agentId === key);
    return { key, name: a.name, models: a.models, editable: true, published: publishedOf(mine)?.version ?? 1, draft: draftOf(mine)?.version ?? null };
  });
}

export interface VersionView {
  version: number;
  kind: "default" | "published" | "draft" | "earlier";
  /** The one Kix uses now. */
  current: boolean;
  note: string | null;
  at: string | null;
  /** The admin who saved it (a grown-up's nickname). */
  by: string | null;
  text: string;
}

export async function agentDetail(store: AuthStore, key: string) {
  const a = agentByKey(key);
  if (!a) return null;
  const agent = { key, name: a.name, models: a.models, reads: a.reads, never: a.never };
  if (!isEditableAgent(key)) return { agent, readOnly: READ_ONLY[key] ?? "This agent has no instructions to edit.", editable: null, versions: [] as VersionView[], published: null, draft: null, next: null, publishAs: null };
  const rows = await store.agents.versions(key);
  const live = rows.filter((r) => !r.deletedAt);
  const current = currentOf(key, rows);
  const draft = draftOf(rows);
  const admins = new Map<string, string | null>();
  await Promise.all(
    [...new Set(live.map((r) => r.createdBy).filter((id): id is string => Boolean(id)))].map(async (id) => {
      const p = await store.admin.profile(id).catch(() => null);
      admins.set(id, p?.role === "parent" ? p.nickname : null);
    }),
  );
  const versions: VersionView[] = [
    ...[...live].reverse().map((r) => ({
      version: r.version,
      kind: r.status === "draft" ? ("draft" as const) : r.version === current.version ? ("published" as const) : ("earlier" as const),
      current: r.version === current.version,
      note: r.note,
      at: r.createdAt,
      by: r.createdBy ? (admins.get(r.createdBy) ?? null) : null,
      text: r.instructions,
    })),
    { version: 1, kind: "default", current: current.version === 1, note: "Built into myKx; can't be deleted", at: null, by: null, text: defaultText(key) },
  ];
  const prompt = AGENT_PROMPTS[key];
  return {
    agent,
    readOnly: null,
    editable: {
      parts: prompt.parts.map((p) => ({ key: p.key, title: p.title })),
      multiPart: prompt.parts.length > 1,
      max: MAX_INSTRUCTIONS,
      vars: Object.entries(prompt.vars).map(([name, about]) => ({ name, about })),
      bands: Boolean(prompt.bands),
      guardrails: prompt.parts.flatMap((p) => p.guardrails.map((g) => ({ part: p.title, text: g.text, note: g.note ?? null }))),
      ...FACTS[key],
    },
    versions,
    published: current.version,
    draft: draft?.version ?? null,
    next: nextVersion(rows),
    publishAs: publishTarget(rows),
  };
}
export type AgentDetail = NonNullable<Awaited<ReturnType<typeof agentDetail>>>;
