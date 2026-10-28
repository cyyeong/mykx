// The version rules for an agent's instructions (founder, 29 Oct). The built-in default is version 1 and can never
// be deleted: myKx always keeps a copy. The published instructions are the newest live published version, else the
// default. An admin works on one draft at a time. Restore publishes an older version's text (or the default's) again
// as a new version; delete is a soft delete of any other version, and deleting the published one falls back to the
// one before it, or the default. Pure rules, plus one function that applies an admin's action through the store; the
// route checks who is asking and writes the audit log.
import type { AuthStore, StoredAgentVersion } from "../auth/store.ts";
import { checkInstructions, cleanInstructions, defaultText, type EditableAgent } from "./instructions.ts";

const liveRows = (rows: readonly StoredAgentVersion[]) => rows.filter((r) => !r.deletedAt);
const newest = (rows: readonly StoredAgentVersion[]) => rows.reduce<StoredAgentVersion | null>((best, r) => (!best || r.version > best.version ? r : best), null);

/** The version Kix uses: the newest live published one, or null for the built-in default. */
export const publishedOf = (rows: readonly StoredAgentVersion[]) => newest(liveRows(rows).filter((r) => r.status === "published"));
/** The draft being worked on: the newest live one. */
export const draftOf = (rows: readonly StoredAgentVersion[]) => newest(liveRows(rows).filter((r) => r.status === "draft"));
/** The number a new version gets: one past every earlier one, deleted ones too (numbers are never reused). */
export const nextVersion = (rows: readonly StoredAgentVersion[]) => Math.max(1, ...rows.map((r) => r.version)) + 1;

/** The text Kix uses for this agent now, and its version (1 is the default). */
export function currentOf(agent: EditableAgent, rows: readonly StoredAgentVersion[]): { version: number; text: string } {
  const p = publishedOf(rows);
  return p ? { version: p.version, text: p.instructions } : { version: 1, text: defaultText(agent) };
}

/** What Publish would number the editor's text: the draft's own number when it is newer than the published one. */
export function publishTarget(rows: readonly StoredAgentVersion[]): number {
  const draft = draftOf(rows);
  return draft && draft.version > (publishedOf(rows)?.version ?? 1) ? draft.version : nextVersion(rows);
}

export type AgentAction =
  | { action: "save-draft"; instructions: string; note?: string | null }
  | { action: "publish"; instructions: string; note?: string | null }
  | { action: "restore"; version: number }
  | { action: "delete"; version: number };

export type ActionResult =
  | { ok: true; row: StoredAgentVersion; publishedChanged: boolean; audit: { action: "agent.draft" | "agent.publish" | "agent.restore" | "agent.delete"; detail: Record<string, string | number | boolean | null> } }
  | { ok: false; status: 400 | 404; reason: "invalid" | "not-found" | "not-allowed"; note: string };

const cleanNote = (note: string | null | undefined) => note?.trim().slice(0, 120) || null;
const refuse = (status: 400 | 404, reason: "invalid" | "not-found" | "not-allowed", note: string): ActionResult => ({ ok: false, status, reason, note });

/** Applies one admin action to an agent's versions. Throws AgentVersionsMissingError when the table isn't there. */
export async function applyAgentAction(store: AuthStore, agent: EditableAgent, a: AgentAction, adminId: string | null, nowIso = new Date().toISOString()): Promise<ActionResult> {
  const rows = await store.agents.versions(agent);
  const current = currentOf(agent, rows);
  const draft = draftOf(rows);

  if (a.action === "save-draft" || a.action === "publish") {
    const problem = checkInstructions(agent, a.instructions);
    if (problem) return refuse(400, "invalid", problem);
    const text = cleanInstructions(a.instructions);
    const note = cleanNote(a.note);
    if (a.action === "save-draft") {
      const row = (draft && (await store.agents.updateDraft(agent, draft.version, { instructions: text, note, status: "draft" }))) || (await store.agents.add({ agentId: agent, instructions: text, note, status: "draft", createdBy: adminId }));
      return { ok: true, row, publishedChanged: false, audit: { action: "agent.draft", detail: { agent, version: row.version, chars: text.length } } };
    }
    if (text === current.text) return refuse(400, "invalid", `Kix already uses these instructions (v${current.version}).`);
    // Publishing the draft in place keeps its number, but only while it is newer than what's published; a draft
    // made before a restore is published as a new version instead, and the old draft goes.
    let row = draft && draft.version > current.version ? await store.agents.updateDraft(agent, draft.version, { instructions: text, note: note ?? draft.note, status: "published" }) : null;
    if (!row) {
      row = await store.agents.add({ agentId: agent, instructions: text, note, status: "published", createdBy: adminId });
      if (draft) await store.agents.remove(agent, draft.version, nowIso);
    }
    return { ok: true, row, publishedChanged: true, audit: { action: "agent.publish", detail: { agent, version: row.version, chars: text.length } } };
  }

  if (a.action === "restore") {
    if (a.version === current.version) return refuse(400, "invalid", `v${a.version} is already what Kix uses.`);
    const source = a.version === 1 ? null : liveRows(rows).find((r) => r.version === a.version);
    if (a.version !== 1 && !source) return refuse(404, "not-found", `There's no v${a.version} to restore.`);
    if (source?.status === "draft") return refuse(400, "invalid", "A draft isn't published yet: open it in the editor and publish it.");
    const row = await store.agents.add({ agentId: agent, instructions: source?.instructions ?? defaultText(agent), note: `Restored v${a.version}${source ? "" : " (default)"}`, status: "published", createdBy: adminId });
    return { ok: true, row, publishedChanged: true, audit: { action: "agent.restore", detail: { agent, version: row.version, from: a.version } } };
  }

  // Delete. The default isn't a row, so it can't be: myKx always keeps a copy.
  if (a.version === 1) return refuse(400, "not-allowed", "The built-in default can't be deleted: myKx always keeps a copy.");
  const target = liveRows(rows).find((r) => r.version === a.version);
  if (!target || !(await store.agents.remove(agent, a.version, nowIso))) return refuse(404, "not-found", `There's no v${a.version} to delete.`);
  const wasCurrent = target.version === current.version;
  return { ok: true, row: { ...target, deletedAt: nowIso }, publishedChanged: wasCurrent, audit: { action: "agent.delete", detail: { agent, version: target.version, status: target.status, wasCurrent } } };
}
