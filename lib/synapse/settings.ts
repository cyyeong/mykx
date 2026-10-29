// Kix Synapse's settings (Admin → Kix Synapse → Settings): how much it may do by itself, which model does each job,
// and the budgets. One row; the defaults stand until an admin saves.
import { z } from "zod";
import { MUSE_SPARK_OPEN_MODEL, ROLE_DEFAULTS } from "../meta/open.ts";
import type { SynapseSettings } from "./types.ts";

export const DEFAULT_SETTINGS: SynapseSettings = {
  on: true,
  threshold: 100,
  scoringNeedsAdmin: true,
  repeatSkip: false,
  dailyAutoCap: 20,
  models: { ...ROLE_DEFAULTS },
  budgetReviewUsd: 2,
  budgetEvalUsd: 0.5,
  updatedAt: null,
  updatedBy: null,
};

/** The models an admin may pick for a job. Kid-facing agents aren't here: they stay on Muse Spark 1.3 (rule 1). */
export const MODEL_CHOICES = [
  { provider: "baseten", model: MUSE_SPARK_OPEN_MODEL, label: "Muse Spark Open", host: "Baseten · Meta open weights · zero data retention" },
  { provider: "meta", model: "muse-spark-1.3", label: "Muse Spark 1.3", host: "Meta Model API · Standard" },
] as const;

const roleModel = z.object({ provider: z.enum(["meta", "baseten"]), model: z.enum([MUSE_SPARK_OPEN_MODEL, "muse-spark-1.3"]) });

export const settingsPatch = z.strictObject({
  on: z.boolean().optional(),
  threshold: z.number().int().min(50).max(100).optional(),
  scoringNeedsAdmin: z.boolean().optional(),
  repeatSkip: z.boolean().optional(),
  dailyAutoCap: z.number().int().min(0).max(200).optional(),
  models: z.strictObject({ "synapse.reviewer": roleModel, "synapse.judge": roleModel, "synapse.second": roleModel }).partial().optional(),
  budgetReviewUsd: z.number().min(0).max(50).optional(),
  budgetEvalUsd: z.number().min(0).max(20).optional(),
});

export function withDefaults(saved: Partial<SynapseSettings> | null | undefined): SynapseSettings {
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}), models: { ...DEFAULT_SETTINGS.models, ...(saved?.models ?? {}) } };
}
