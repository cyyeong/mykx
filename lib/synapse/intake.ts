// Taking a kid's report in (docs/prd/SYNAPSE.md §4): a Learn question is looked up in the kid's own level's packs; an
// AI reply must come with its signed turn and the exact words shown. Names and contact details are removed before
// anything is stored or reviewed. Limits keep reports from becoming a game: 10 a day, one open report per question.
import { randomUUID } from "node:crypto";
import type { FailReason } from "../auth/schemas.ts";
import type { AuthStore, Profile } from "../auth/store.ts";
import { itemForKid } from "../learn/subjects.ts";
import { skillOverride } from "../skills/overrides.ts";
import { snapshotItem } from "./checks.ts";
import { deidentify } from "./deid.ts";
import { checkTurn } from "./turn.ts";
import { CLOSED, type ReportKind, type Surface, type SynapseReport } from "./types.ts";

export const DAILY_LIMIT = 10;

export interface ReportInput {
  surface: Surface;
  kind: ReportKind;
  note: string | null;
  itemId?: string | null;
  answer?: string | null;
  marked?: boolean | null;
  token?: string | null;
  shown?: string | null;
  ask?: string | null;
}

export type Intake = { ok: true; report: SynapseReport; duplicate: boolean } | { ok: false; status: number; reason: FailReason; note?: string };

/** The family's names, for de-identification and the name check (never sent to a model). */
export async function familyNames(store: AuthStore, householdId: string): Promise<{ learner: string[]; parent: string[] }> {
  const kids = await store.kids(householdId).catch(() => [] as Profile[]);
  const grownUps = await store.family.grownUps(householdId).catch(() => [] as Profile[]);
  return { learner: kids.flatMap((k) => [k.nickname, k.username ?? ""]).filter(Boolean), parent: grownUps.map((g) => g.nickname).filter(Boolean) };
}

export async function takeReport(store: AuthStore, householdId: string, kid: Profile, input: ReportInput, nowIso = new Date().toISOString()): Promise<Intake> {
  const mine = await store.synapse.reports({ householdId, profileId: kid.id, sinceIso: new Date(Date.parse(nowIso) - 24 * 3600_000).toISOString(), limit: 50 });
  const names = await familyNames(store, householdId);
  const clean = (s: string | null | undefined, max: number) => (s ? deidentify(s, names).slice(0, max) : null);

  let turn: SynapseReport["turn"] = { agent: null, agentVersion: null, packId: null, packVersion: null, itemId: null, level: kid.level, subject: null, stage: null, species: null, petStage: null, sections: [] };
  let item: SynapseReport["case"]["item"] = null;
  if (input.surface === "learn") {
    if (!input.itemId) return { ok: false, status: 400, reason: "invalid" };
    const access = itemForKid(kid.level, input.itemId);
    if (!access.ok) return { ok: false, status: access.reason === "other-level" ? 403 : 404, reason: access.reason === "other-level" ? "not-allowed" : "not-found" };
    const packId = access.subject.id;
    item = snapshotItem(access.item as unknown as Record<string, unknown>, packId);
    turn = { ...turn, packId, packVersion: skillOverride(packId)?.version ?? null, itemId: access.item.id, subject: packId.split("-").slice(1).join("-") || null };
  } else {
    if (!input.token || !input.shown) return { ok: false, status: 400, reason: "invalid" };
    const checked = checkTurn(input.token, { kidId: kid.id, shown: input.shown, ask: input.ask ?? null, now: Date.parse(nowIso) });
    if (!checked.ok) return checked.reason === "no-secret" ? { ok: false, status: 503, reason: "not-configured" } : { ok: false, status: 400, reason: "invalid", note: `turn: ${checked.reason}` };
    const t = checked.turn;
    turn = { agent: t.agent, agentVersion: t.agentVersion, packId: t.packId, packVersion: t.packVersion, itemId: t.itemId, level: t.level ?? kid.level, subject: t.subject, stage: t.stage, species: t.species, petStage: t.petStage, sections: t.sections.slice(0, 4) };
  }

  // One open report per question or reply: a second one joins the first.
  const sameTarget = (r: SynapseReport) => r.surface === input.surface && (input.surface === "learn" ? r.turn.itemId === turn.itemId : r.case.shown === clean(input.shown, 4000));
  const open = mine.find((r) => !CLOSED.includes(r.status) && sameTarget(r));
  if (open) return { ok: true, report: open, duplicate: true };
  if (mine.length >= DAILY_LIMIT) return { ok: false, status: 429, reason: "daily-limit" };

  const report: SynapseReport = {
    id: randomUUID(),
    householdId,
    profileId: kid.id,
    by: "kid",
    createdAt: nowIso,
    updatedAt: nowIso,
    surface: input.surface,
    kind: input.kind,
    status: "new",
    turn,
    case: { shown: clean(input.shown, 4000), ask: clean(input.ask, 800), note: clean(input.note, 300), answer: clean(input.answer, 200), marked: input.marked ?? null, item },
    steps: [
      { at: nowIso, kind: "report", title: "Learner flagged it", detail: `${input.kind}${input.note ? " · note screened" : ""}${input.surface === "learn" ? "" : " · signature checked"}` },
      { at: nowIso, kind: "case", title: "Case built", detail: "nicknames → Learner · ids removed" },
    ],
    review: null,
    reviewModel: null,
    second: null,
    reproduce: null,
    retest: null,
    checks: [],
    confidence: null,
    caps: [],
    threshold: 100,
    fixRef: null,
    evalCaseId: null,
    kidNote: null,
    decidedBy: null,
    decidedAt: null,
    duplicateOf: null,
    costUsd: 0,
  };
  await store.synapse.saveReport(report);
  return { ok: true, report, duplicate: false };
}

/** What a kid may see of their own report: the status and the note for them, nothing about models or admins. */
export function kidView(r: SynapseReport) {
  const state = r.status === "auto-fixed" || r.status === "approved" ? "fixed" : r.status === "kix-was-right" ? "right" : r.status === "rejected" ? "closed" : "checking";
  return { id: r.id, surface: r.surface, kind: r.kind, itemId: r.turn.itemId, state, note: state === "checking" ? null : r.kidNote, at: r.createdAt };
}
