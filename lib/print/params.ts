// URL search params for the print page: ?seed=k3x9q2&length=full&topics=a,b&guide=with
// Pure parsing and link building, so every toolbar link is a plain <Link> and a paper's URL reproduces it.
import type { PaperLength } from "./paper.ts";

/** Paper and guide together, the paper alone, or the guide alone. */
export type GuideMode = "with" | "none" | "only";

export interface PaperOptions {
  seed: string | null;
  length: PaperLength;
  topics: string[];
  guide: GuideMode;
}

type Search = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const SEED = /^[a-z0-9]{1,12}$/;
const TOPIC = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

export function readPaperOptions(search: Search, defaults: { guide: GuideMode; length?: PaperLength }): PaperOptions {
  const seed = first(search.seed)?.toLowerCase() ?? "";
  const length = first(search.length);
  const guide = first(search.guide);
  const topics = (first(search.topics) ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => TOPIC.test(t));
  return {
    seed: SEED.test(seed) ? seed : null,
    length: length === "full" || length === "short" ? length : (defaults.length ?? "short"),
    topics: [...new Set(topics)].sort(),
    guide: guide === "with" || guide === "none" || guide === "only" ? guide : defaults.guide,
  };
}

/** A canonical link to one paper (params in a fixed order; topics sorted). */
export function paperHref(base: string, o: PaperOptions & { seed: string }): string {
  const q = new URLSearchParams({ seed: o.seed, length: o.length });
  if (o.topics.length) q.set("topics", [...o.topics].sort().join(","));
  q.set("guide", o.guide);
  return `${base}?${q.toString().replace(/%2C/g, ",")}`;
}

/** A fresh six-character seed. Call it at request time (after cookies or connection()). */
export function newSeed(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");
}

/** Toggle one topic in a list (for topic chips). */
export function toggleTopic(topics: readonly string[], id: string): string[] {
  return topics.includes(id) ? topics.filter((t) => t !== id) : [...topics, id].sort();
}
