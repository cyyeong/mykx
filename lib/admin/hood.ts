// Server only: what the admin's Skills catalogue and Under the hood pages show. The skill packs on disk with their
// topics, items and which agents may load them; the agents themselves (what each reads, which model, what it may
// never do); every model call from `model_runs`, summed per model; and the art manifest. Ids and numbers only: no
// child's words, answers or Notebook ever reach these pages (rule 13).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { StoredRun } from "../auth/store.ts";

export interface PackCard {
  id: string;
  title: string;
  level: string;
  subject: string;
  version: string;
  status: string;
  description: string;
  topics: { id: string; title: string; items: number }[];
  items: number;
  reviewed: number;
  drafts: number;
  /** Share of topics with at least one item, 0–100. */
  coverage: number;
  references: number;
  agents: Record<string, string>;
  tools: string[];
}

type SkillJson = { id: string; title?: string; level?: string; subject?: string; version: string; status?: string; description?: string; topics?: { id: string; title?: string }[]; references?: unknown[]; agents?: Record<string, string>; tools?: string[] };
type Item = { topic?: string; status?: string };

export function packCards(root = process.cwd()): PackCard[] {
  const dir = join(root, "content", "skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, "skill.json")))
    .map((d) => {
      const m = JSON.parse(readFileSync(join(dir, d, "skill.json"), "utf8")) as SkillJson;
      const itemsDir = join(dir, d, "items");
      const items: Item[] = existsSync(itemsDir)
        ? readdirSync(itemsDir)
            .filter((f) => f.endsWith(".json"))
            .flatMap((f) => {
              const j = JSON.parse(readFileSync(join(itemsDir, f), "utf8")) as Item[] | { items?: Item[] };
              return Array.isArray(j) ? j : (j.items ?? []);
            })
        : [];
      const topics = (m.topics ?? []).map((t) => ({ id: t.id, title: t.title ?? t.id, items: items.filter((i) => i.topic === t.id || i.topic?.startsWith(`${t.id}.`)).length }));
      return {
        id: m.id,
        title: m.title ?? m.id,
        level: m.level ?? "",
        subject: m.subject ?? "",
        version: m.version,
        status: m.status ?? "draft",
        description: m.description ?? "",
        topics,
        items: items.length,
        reviewed: items.filter((i) => i.status === "reviewed").length,
        drafts: items.filter((i) => i.status !== "reviewed").length,
        coverage: topics.length ? Math.round((topics.filter((t) => t.items > 0).length / topics.length) * 100) : 0,
        references: (m.references ?? []).length,
        agents: m.agents ?? {},
        tools: m.tools ?? [],
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export interface Agent {
  id: string;
  name: string;
  /** The `route` its calls are logged under, when it calls a model. */
  route: string | null;
  models: string[];
  reads: string;
  never: string;
}

/** Kix's agents and tools, for the demo's "under the hood". Child data only ever goes to Standard models (rule 1). */
export const AGENTS: readonly Agent[] = [
  { id: "tutor", name: "Kix Tutor", route: "tutor", models: ["muse-spark-1.3"], reads: "The question's skill pack, its worked steps and hints, Kix's Notebook", never: "Gives the answer away or changes a score; every ask counts as a hint" },
  { id: "ask-kix", name: "Ask Kix (homework)", route: "ask-kix", models: ["muse-spark-1.3"], reads: "A typed question or a photo (face-checked on the device, never stored), the level's packs, published updates, the Notebook", never: "Keeps the photo, or skips the guide-first steps" },
  { id: "memory-keeper", name: "Memory Keeper", route: "memory-keeper", models: ["muse-spark-1.3"], reads: "The child's own words to Kix after a session, the session's numbers, the Notebook", never: "Labels or diagnoses (refused in code), reads family messages, or touches mastery" },
  { id: "vibe", name: "Vibe Zone maker", route: "vibe", models: ["muse-spark-1.3"], reads: "The child's brief and the level's pack notes", never: "Writes code: it returns a validated spec drawn by trusted components" },
  { id: "curator", name: "Content Curator (knowledge agent)", route: "knowledge-agent", models: ["muse-spark-1.3"], reads: "Admin-uploaded PDFs (read as files)", never: "Keeps a school paper's questions: patterns only, and an admin approves before anything is published" },
  { id: "studio", name: "Sidekick Studio", route: "studio", models: ["muse-image-1.0", "sam-3.1"], reads: "The picked world and interests (chips only)", never: "Takes a child's photo or free text" },
  { id: "voice", name: "Talk to Kix (voice in)", route: "voice", models: ["muse-voice-transcribe-1.0"], reads: "A push-to-talk clip of up to 30 s", never: "Stores or logs audio: the transcript only" },
  { id: "guardian", name: "Guardian", route: null, models: [], reads: "Heartbeats, answers, the child's words to Kix, the parent's settings", never: "Calls a model, diagnoses, or changes rewards: deterministic rules only" },
  { id: "scout", name: "Past-paper scout", route: null, models: [], reads: "Admin-approved sites, respecting robots.txt and terms", never: "Bypasses a CAPTCHA, a sign-in or a robots block" },
];

export interface ModelTotal {
  model: string;
  calls: number;
  failed: number;
  avgLatencyMs: number | null;
  inputTokens: number;
  outputTokens: number;
  images: number;
  audioSeconds: number;
  costUsd: number;
}

export function totalsByModel(runs: readonly StoredRun[]): ModelTotal[] {
  const out = new Map<string, ModelTotal & { latencySum: number; latencyN: number }>();
  for (const r of runs) {
    const t = out.get(r.model) ?? { model: r.model, calls: 0, failed: 0, avgLatencyMs: null, inputTokens: 0, outputTokens: 0, images: 0, audioSeconds: 0, costUsd: 0, latencySum: 0, latencyN: 0 };
    t.calls += 1;
    if (!r.ok) t.failed += 1;
    if (r.latencyMs !== null) {
      t.latencySum += r.latencyMs;
      t.latencyN += 1;
    }
    t.inputTokens += r.inputTokens ?? 0;
    t.outputTokens += r.outputTokens ?? 0;
    t.images += r.images ?? 0;
    t.audioSeconds += r.audioSeconds ?? 0;
    t.costUsd += r.costUsd ?? 0;
    out.set(r.model, t);
  }
  return [...out.values()]
    .map(({ latencySum, latencyN, ...t }) => ({ ...t, avgLatencyMs: latencyN ? Math.round(latencySum / latencyN) : null, costUsd: Math.round(t.costUsd * 10000) / 10000 }))
    .sort((a, b) => b.calls - a.calls);
}

export interface ManifestSummary {
  assets: number;
  byModel: { model: string; count: number }[];
  byKind: { kind: string; count: number }[];
  first: string | null;
  last: string | null;
  samples: { id: string; path: string; model: string; kind: string }[];
}

type ManifestEntry = { id: string; path: string; variants?: string[]; model: string; kind: string; created?: string };

export function manifestSummary(root = process.cwd()): ManifestSummary {
  const file = join(root, "public", "art", "manifest.json");
  const raw = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as ManifestEntry[] | { assets: ManifestEntry[] }) : [];
  const list = Array.isArray(raw) ? raw : raw.assets;
  const count = (key: (e: ManifestEntry) => string) => {
    const m = new Map<string, number>();
    for (const e of list) m.set(key(e), (m.get(key(e)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const dates = list.map((e) => e.created).filter((d): d is string => Boolean(d)).sort();
  const shown = list.filter((e) => e.model === "muse-image-1.0" && /\.webp$/.test(e.path) && ["kix", "card", "critter", "background", "scene", "door"].includes(e.kind));
  return {
    assets: list.length,
    // Masks and plates made in code (sharp) count as one line.
    byModel: count((e) => (e.model.startsWith("none") ? "code (sharp)" : e.model)).map(([model, n]) => ({ model, count: n })),
    byKind: count((e) => e.kind).map(([kind, n]) => ({ kind, count: n })),
    first: dates[0] ?? null,
    last: dates[dates.length - 1] ?? null,
    samples: shown.slice(0, 12).map((e) => ({ id: e.id, path: (e.variants?.find((v) => v.endsWith("-800.webp")) ?? e.path).replace(/^public/, ""), model: e.model, kind: e.kind })),
  };
}

/** A run as the admin pages show it: which agent, never which child. */
export function publicRun(r: StoredRun) {
  return {
    at: r.at,
    agent: AGENTS.find((a) => a.route === r.route)?.name ?? r.route,
    operation: r.operation,
    model: r.model,
    forChild: Boolean(r.profileId),
    latencyMs: r.latencyMs,
    firstTokenMs: r.firstTokenMs,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    images: r.images,
    costUsd: r.costUsd,
    ok: r.ok,
    requestId: r.requestId ?? r.responseId,
  };
}
export type PublicRun = ReturnType<typeof publicRun>;
