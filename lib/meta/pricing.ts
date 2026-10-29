// Price table (USD), from dev.meta.ai/docs/pricing-rate-limits, checked 27 Oct 2026.
// Estimates only: the Meta billing page is the source of truth.

export interface ModelPrice {
  /** Per 1M uncached input tokens. */
  inputPerM?: number;
  /** Per 1M output tokens (reasoning included). */
  outputPerM?: number;
  /** Per 1M cached input tokens. */
  cachedInputPerM?: number;
  /** Per image returned (Muse Image) or segmented (SAM). */
  perImage?: number;
  /** Per second of audio processed (Muse Voice Transcribe). */
  perAudioSecond?: number;
}

export const PRICES: Readonly<Record<string, ModelPrice>> = {
  "muse-spark-1.3": { inputPerM: 1.25, outputPerM: 4.25, cachedInputPerM: 0.15 },
  "muse-wonder-1.0": { inputPerM: 4, outputPerM: 20, cachedInputPerM: 0.2 },
  // Muse Spark Open on Baseten: the launch hosts' listed price (third-party listing, 29 Oct); confirm on Baseten.
  "meta-models/muse-spark-open": { inputPerM: 1.25, outputPerM: 4.25, cachedInputPerM: 0.15 },
  // Image responses carry token usage "for reference only"; billing is per image.
  "muse-image-1.0": { perImage: 0.01 },
  "sam-3.1": { perImage: 0.0025 },
  // $0.18 per audio hour, billed on whole seconds (rounded down).
  "muse-voice-transcribe-1.0": { perAudioSecond: 0.18 / 3600 },
};

export interface UsageForCost {
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedInputTokens?: number | null;
  images?: number | null;
  audioSeconds?: number | null;
}

/**
 * Estimated cost in USD, rounded to 1e-6. Returns null when the model is not in the
 * price table or the usage it is billed on is missing.
 */
export function estimateCostUsd(model: string, usage: UsageForCost): number | null {
  const price = PRICES[model];
  if (!price) return null;

  if (price.perAudioSecond !== undefined) {
    if (usage.audioSeconds == null) return null;
    return round6(usage.audioSeconds * price.perAudioSecond);
  }

  if (price.perImage !== undefined) {
    if (usage.images == null) return null;
    return round6(usage.images * price.perImage);
  }

  const { inputTokens, outputTokens } = usage;
  if (inputTokens == null && outputTokens == null) return null;
  const input = inputTokens ?? 0;
  const cached = Math.min(usage.cachedInputTokens ?? 0, input);
  const cost =
    ((input - cached) * (price.inputPerM ?? 0) +
      cached * (price.cachedInputPerM ?? price.inputPerM ?? 0) +
      (outputTokens ?? 0) * (price.outputPerM ?? 0)) /
    1_000_000;
  return round6(cost);
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
