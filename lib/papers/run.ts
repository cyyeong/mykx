// Server only: one scout run, saved (the weekly job and the admin's "Run the scout now" share it).
import { randomUUID } from "node:crypto";
import type { AuthStore } from "../auth/store.ts";
import { packsOnDisk } from "../knowledge/packs.ts";
import type { ScoutRun } from "./finds.ts";
import { scanSites } from "./scan.ts";

export async function runScout(store: AuthStore, trigger: ScoutRun["trigger"]): Promise<ScoutRun> {
  const at = new Date().toISOString();
  const { rows, problems } = await scanSites({ packs: packsOnDisk().map((p) => p.id) });
  return store.papers.saveScan({ id: randomUUID(), at, trigger, problems }, rows);
}
