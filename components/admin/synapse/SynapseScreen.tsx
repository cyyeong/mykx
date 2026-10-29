"use client";

// Admin → Kix Synapse (docs/prd/SYNAPSE.md §7; boards SynapseInbox, SynapseLearned, SynapseSettings): the loop with
// this week's numbers, the inbox, learned cautions per agent, evals, settings and the retrain adapter. Learners show by
// level only. Reads /api/admin/synapse (admins, behind the PIN).
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/account/api";
import type { AdminReport, Overview } from "@/lib/synapse/admin";
import type { LearnedCaution, ReportStatus, SynapseSettings } from "@/lib/synapse/types";
import "./synapse.css";

type Tab = "inbox" | "learned" | "evals" | "settings" | "retrain";
const TABS: [Tab, string][] = [["inbox", "Inbox"], ["learned", "Learned"], ["evals", "Evals"], ["settings", "Settings"], ["retrain", "Retrain"]];
const SPARK = "M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z";
export const AGENT_NAME: Record<string, string> = { "ask-kix": "Ask Kix", tutor: "Kix Tutor", "critter-keeper": "Critter Keeper", "skill-packs": "Skill packs" };
const SURFACE: Record<string, string> = { learn: "Learn", "ask-kix": "Ask Kix", tutor: "Kix Tutor", critter: "Critter Lab" };
const KIND: Record<string, string> = { typo: "Typo", "marked-wrong": "Marking", figure: "Figure", hint: "Hint", "question-wrong": "Question", "answer-wrong": "Kix's reply", confusing: "Confusing", "pet-wrong": "Pet's reply", other: "Other" };
const FILTERS: [string, string, (r: AdminReport) => boolean][] = [
  ["waiting", "Waiting for you", (r) => ["waiting", "failed", "new", "reviewing"].includes(r.status)],
  ["auto", "Fixed by Synapse", (r) => r.status === "auto-fixed"],
  ["approved", "Approved", (r) => r.status === "approved"],
  ["right", "Kix was right", (r) => r.status === "kix-was-right"],
  ["team", "For the team", (r) => r.status === "for-team"],
  ["all", "All", () => true],
];

export function statusChip(s: ReportStatus, r?: Pick<AdminReport, "fixRef">): { label: string; tone: string } {
  switch (s) {
    case "auto-fixed":
    case "approved":
      return { label: `${s === "auto-fixed" ? "Fixed" : "Approved"}: ${r?.fixRef?.type === "skill-version" ? `${r.fixRef.packId} v${r.fixRef.version}` : r?.fixRef?.type === "caution" ? `caution for ${AGENT_NAME[r.fixRef.agent] ?? r.fixRef.agent}` : "done"}`, tone: "ok" };
    case "kix-was-right":
      return { label: "Kix was right: explained", tone: "def" };
    case "for-team":
      return { label: "For the team", tone: "team" };
    case "rejected":
      return { label: "Closed: not a problem", tone: "def" };
    case "undone":
      return { label: "Undone", tone: "def" };
    case "new":
    case "reviewing":
      return { label: "Reviewing…", tone: "wait" };
    case "failed":
      return { label: "Review failed: retry", tone: "flag" };
    default:
      return { label: "Waiting for you", tone: "wait" };
  }
}

export const when = (iso: string) => new Date(iso).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Singapore" });
const mins = (ms: number | null) => (ms === null ? "—" : ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`);

export function Meter({ value, threshold, tone }: { value: number; threshold: number; tone?: string }) {
  return (
    <span className="sx-meter" data-tone={tone ?? (value >= threshold ? "ok" : "wait")} role="img" aria-label={`Confidence ${value} of 100; needs ${threshold}`}>
      <i style={{ width: `${value}%` }} />
      <b style={{ left: `calc(${threshold}% - 1px)` }} />
    </span>
  );
}

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return <span className="sx-muted">one run so far</span>;
  const d = points.map((p, i) => `${((i / (points.length - 1)) * 180).toFixed(1)},${(28 - (Math.max(70, p) - 70) * 0.85).toFixed(1)}`).join(" ");
  const bad = points[points.length - 1] < 100;
  return (
    <svg viewBox="0 0 180 30" preserveAspectRatio="none" className="sx-spark" aria-hidden="true">
      <line x1="0" y1="2.5" x2="180" y2="2.5" />
      <polyline points={d} data-bad={bad || undefined} />
    </svg>
  );
}

export function SynapseScreen() {
  const [data, setData] = useState<Overview | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("inbox");
  const [filter, setFilter] = useState("all");
  const [agent, setAgent] = useState("ask-kix");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<SynapseSettings | null>(null);

  const load = useCallback(async () => {
    const r = await api<Overview>("GET", "/api/admin/synapse");
    if (r.ok && r.data) {
      setData(r.data);
      setDraft(r.data.settings);
    } else setFailed(r.status === 403 ? "Admins only." : "Couldn't load Kix Synapse.");
  }, []);

  useEffect(() => {
    const h = window.location.hash.slice(1) as Tab;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the tab comes from the URL once, after hydration
    if (TABS.some(([t]) => t === h)) setTab(h);
    void load();
  }, [load]);

  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };

  async function caution(c: LearnedCaution, action: "confirm" | "retire") {
    setBusy(c.id);
    const r = await api("POST", "/api/admin/synapse/cautions", { id: c.id, action });
    setBusy(null);
    setNote(r.ok ? (action === "confirm" ? "Confirmed: it no longer expires." : "Retired: the agent stops using it within a minute.") : "That didn't save.");
    await load();
  }

  async function runEvals() {
    setBusy("evals");
    const r = await api<{ run: { passed: number; total: number } }>("POST", "/api/admin/synapse/evals");
    setBusy(null);
    setNote(r.ok && r.data ? `Evals: ${r.data.run.passed} of ${r.data.run.total} pass.` : "The evals didn't run.");
    await load();
  }

  async function saveSettings() {
    if (!draft) return;
    setBusy("settings");
    const { on, threshold, scoringNeedsAdmin, repeatSkip, dailyAutoCap, models, budgetReviewUsd, budgetEvalUsd } = draft;
    const r = await api("POST", "/api/admin/synapse/settings", { on, threshold, scoringNeedsAdmin, repeatSkip, dailyAutoCap, models, budgetReviewUsd, budgetEvalUsd });
    setBusy(null);
    setNote(r.ok ? "Saved." : r.status === 503 ? "Saving needs the Kix Synapse tables: run supabase/migrations/20261030_synapse.sql." : "That didn't save.");
    await load();
  }

  const s = data?.stages;
  const list = data ? data.reports.filter(FILTERS.find((f) => f[0] === filter)![2]) : [];
  const agents = data ? [...new Set(["ask-kix", "tutor", "critter-keeper", ...data.cautions.map((c) => c.agent)])] : [];
  const live = (c: LearnedCaution) => c.status === "active";

  return (
    <>
      <div className="sx">
        <header className="sx-head">
          <div>
            <h1 className="ad-h1">Kix Synapse</h1>
            <p className="ad-lede">Kids flag what&apos;s wrong. Synapse reproduces it, reviews it with Muse Spark Open and ships the fixes it can prove. The rest wait for you.</p>
          </div>
          {data && (
            <span className="sx-chip" data-tone="open">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d={SPARK} />
              </svg>
              Fixes by itself at {data.settings.threshold}
            </span>
          )}
        </header>
        <nav className="sx-tabs" aria-label="Kix Synapse">
          {TABS.map(([t, label]) => (
            <button key={t} type="button" aria-current={tab === t ? "page" : undefined} onClick={() => go(t)}>
              {label}
            </button>
          ))}
        </nav>
        {note && (
          <p className="sx-note" role="status">
            {note}
          </p>
        )}
        {failed && <p className="ad-lede">{failed}</p>}
        {!data && !failed && <p className="ad-lede">Loading…</p>}

        {data && s && tab === "inbox" && (
          <>
            <section className="sx-loop" aria-label="This week">
              <div className="sx-stages">
                {[
                  ["Flagged", String(s.flagged), "by learners"],
                  ["Traced", String(s.traced), "the turn they saw"],
                  ["Reviewed", String(s.reviewed), data.openModelKey ? "Muse Spark Open" : "Muse Spark 1.3 (fallback)"],
                  ["Fixed", String(s.fixed), `${s.bySynapse} Synapse · ${s.byAdmin} you`],
                  ["Re-tested", `${s.retestedGreen}/${s.retested}`, "green after the fix"],
                ].map(([k, v, d], i) => (
                  <div key={k} className="sx-stage">
                    {i > 0 && <span className="sx-arrow" aria-hidden="true" />}
                    <span>{k}</span>
                    <b>{v}</b>
                    <small>{d}</small>
                  </div>
                ))}
              </div>
              <div className="sx-waiting">
                <b>{data.waiting}</b>
                <span>waiting for you · median flag to fix {mins(data.medianFixMs)}</span>
              </div>
            </section>
            <div className="sx-filters" role="group" aria-label="Show">
              {FILTERS.map(([k, label, fn]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {label} {data.reports.filter(fn).length}
                </button>
              ))}
            </div>
            <section className="ad-card sx-table">
              {list.length === 0 ? (
                <p className="sx-muted">Nothing here. Kids flag things from Learn, Ask Kix and the Critter Lab; their reports land here.</p>
              ) : (
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Report</th>
                      <th>Kind</th>
                      <th>Reviewed by</th>
                      <th>Confidence (needs {data.settings.threshold})</th>
                      <th>Outcome</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => {
                      const chip = statusChip(r.status, r);
                      return (
                        <tr key={r.id}>
                          <td>
                            <Link href={`/admin/synapse/${r.id}`} className="sx-link">
                              {r.case.note || KIND[r.kind]}
                            </Link>
                            <small className="sx-sub">
                              {SURFACE[r.surface]} · {r.who}
                              {r.turn.packId ? ` · ${r.turn.packId}` : ""}
                            </small>
                          </td>
                          <td>{KIND[r.kind]}</td>
                          <td>{r.reviewModel ? `${r.reviewModel.model === "muse-spark-1.3" ? "Muse Spark 1.3" : "Muse Spark Open"}${r.reviewModel.fallback ? " (fallback)" : ""}` : "—"}</td>
                          <td>
                            {r.confidence === null ? (
                              <span className="sx-muted">not scored</span>
                            ) : (
                              <span className="sx-conf">
                                <Meter value={r.confidence} threshold={r.threshold} tone={r.status === "kix-was-right" ? "def" : undefined} />
                                {r.confidence}
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="sx-chip" data-tone={chip.tone}>
                              {chip.label}
                            </span>
                          </td>
                          <td className="sx-when">{when(r.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
            <p className="sx-fine">Learners show as their level only. A report shares only the turn it&apos;s about; nicknames are replaced before any review.</p>
          </>
        )}

        {data && tab === "learned" && (
          <div className="sx-learned">
            <nav className="ad-card sx-agents" aria-label="Agents">
              {agents.map((a) => (
                <button key={a} type="button" aria-pressed={agent === a} onClick={() => setAgent(a)}>
                  {AGENT_NAME[a] ?? a}
                  <small>{data.cautions.filter((c) => c.agent === a && live(c)).length}</small>
                </button>
              ))}
            </nav>
            <section className="sx-col">
              <div className="ad-card">
                <h2 className="ad-h2">
                  {AGENT_NAME[agent] ?? agent}: {data.cautions.filter((c) => c.agent === agent && live(c)).length} learned cautions
                </h2>
                <p className="sx-muted">Each came from a report, was proven by a test, and only narrows what the agent does. 12 at most; each expires after 30 days unless you confirm it.</p>
                <div className="sx-cautions">
                  {data.cautions
                    .filter((c) => c.agent === agent && c.status !== "retired")
                    .map((c) => (
                      <article key={c.id} className="sx-caution">
                        <p>
                          <b>When</b> {c.when.replace(/[.,;]+$/, "")}, <b>check</b>: {c.check.replace(/\.+$/, "")}.
                        </p>
                        <div className="sx-meta">
                          {[c.scope.level ?? "All levels", c.scope.subject].filter(Boolean).map((t) => (
                            <span key={t} className="sx-chip" data-tone="def">
                              {t}
                            </span>
                          ))}
                          <span className="sx-muted">
                            From {c.reportIds.length} report{c.reportIds.length === 1 ? "" : "s"} · {c.createdBy === "synapse" ? "added by Synapse" : "approved by an admin"} · {when(c.createdAt)}
                          </span>
                        </div>
                        <div className="sx-row">
                          <span className="sx-chip" data-tone={c.expiresAt ? "wait" : "ok"}>
                            {c.expiresAt ? `expires ${when(c.expiresAt)}` : "confirmed"}
                          </span>
                          <span className="sx-acts">
                            {c.expiresAt && (
                              <button type="button" className="mk-btn mk-btn--secondary" disabled={busy === c.id} onClick={() => void caution(c, "confirm")}>
                                Confirm
                              </button>
                            )}
                            <button type="button" className="mk-btn mk-btn--secondary sx-del" disabled={busy === c.id} onClick={() => void caution(c, "retire")}>
                              Retire
                            </button>
                          </span>
                        </div>
                      </article>
                    ))}
                  {!data.cautions.some((c) => c.agent === agent && c.status !== "retired") && <p className="sx-muted">None yet. When a kid reports a mistake this agent made and the fix is proven, it appears here.</p>}
                </div>
              </div>
              <div className="ad-card">
                <h2 className="ad-h2">How {AGENT_NAME[agent] ?? agent}&apos;s prompt is put together</h2>
                <ol className="sx-stack">
                  <li data-k="1">
                    <span>Instructions</span>
                    <small>editable in Under the hood</small>
                  </li>
                  <li data-k="2">
                    <span>Learned cautions</span>
                    <small>only the ones whose level and subject fit the question</small>
                  </li>
                  <li data-k="3">
                    <span>Guardrails, fixed in code</span>
                    <small>always last, always win</small>
                  </li>
                </ol>
              </div>
            </section>
          </div>
        )}

        {data && tab === "evals" && (
          <section className="ad-card sx-evals">
            <div className="sx-row">
              <h2 className="ad-h2">Evals, latest runs</h2>
              <button type="button" className="mk-btn mk-btn--primary" disabled={busy === "evals"} onClick={() => void runEvals()}>
                {busy === "evals" ? "Running…" : "Run all evals now"}
              </button>
            </div>
            <p className="sx-muted">Every fixed report becomes a case. Cases run before a fix ships, on demand, and nightly at 03:30.</p>
            {data.evals.length === 0 ? (
              <p className="sx-muted">No eval cases yet: the first fixed report adds one.</p>
            ) : (
              <div className="sx-evlist">
                {data.evals.map((e) => (
                  <div key={e.group} className="sx-ev">
                    <span>{AGENT_NAME[e.group] ?? e.group}</span>
                    <Spark points={e.points} />
                    <b data-bad={e.last.passed < e.last.total || undefined}>
                      {e.last.passed}/{e.last.total}
                    </b>
                  </div>
                ))}
              </div>
            )}
            {data.failing.length > 0 && (
              <div className="sx-fail">
                <b>{data.failing.length} failing.</b> {data.failing.map((f) => `${AGENT_NAME[f.group] ?? f.group}: ${f.detail}`).join(" · ")}. Their reports are back in the inbox.
              </div>
            )}
          </section>
        )}

        {data && draft && tab === "settings" && (
          <div className="sx-settings">
            <section className="ad-card">
              <h2 className="ad-h2">Fix by itself</h2>
              <p className="sx-muted">Synapse fixes a report by itself only when its confidence reaches this line: the problem reproduced, every code check passed and the re-test green.</p>
              <label className="sx-threshold">
                <span>Threshold</span>
                <b>{draft.threshold}</b>
                <input type="range" min={50} max={100} step={1} value={draft.threshold} onChange={(e) => setDraft({ ...draft, threshold: Number(e.target.value) })} />
              </label>
              {(
                [
                  ["scoringNeedsAdmin", "Scoring changes always need me", "Answer keys and marking rules wait for you, with a second opinion, at any confidence."],
                  ["repeatSkip", "Repeated reports may skip the queue at 95", "When two or more learners report the same problem."],
                  ["on", "Synapse is on", "Off: reports are still kept; nothing is reviewed."],
                ] as const
              ).map(([k, label, help]) => (
                <label key={k} className="sx-toggle">
                  <span>
                    <b>{label}</b>
                    <small>{help}</small>
                  </span>
                  <input type="checkbox" role="switch" checked={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })} />
                </label>
              ))}
              <label className="sx-toggle">
                <span>
                  <b>Fixes by itself a day</b>
                  <small>After this many, the rest wait for you.</small>
                </span>
                <input type="number" min={0} max={200} value={draft.dailyAutoCap} onChange={(e) => setDraft({ ...draft, dailyAutoCap: Math.max(0, Math.min(200, Number(e.target.value) || 0)) })} />
              </label>
            </section>
            <section className="ad-card">
              <h2 className="ad-h2">Models for each job</h2>
              <p className="sx-muted">Each job can use its own model. {data.openModelKey ? "Baseten is connected." : "No Baseten key is set, so the Muse Spark Open jobs run on Muse Spark 1.3 and each case says so."}</p>
              {(
                [
                  ["synapse.reviewer", "Reviewer", "Reads each report and drafts the fix"],
                  ["synapse.second", "Second opinion", "Any fix that changes a score"],
                  ["synapse.judge", "Eval judge", "Checks meaning when code can't"],
                ] as const
              ).map(([role, label, help]) => (
                <label key={role} className="sx-model">
                  <span>
                    <b>{label}</b>
                    <small>{help}</small>
                  </span>
                  <select
                    value={draft.models[role].model}
                    onChange={(e) => {
                      const c = data.choices.find((x) => x.model === e.target.value)!;
                      setDraft({ ...draft, models: { ...draft.models, [role]: { provider: c.provider, model: c.model } } });
                    }}
                  >
                    {data.choices.map((c) => (
                      <option key={c.model} value={c.model}>
                        {c.label} · {c.host}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <div className="sx-model">
                <span>
                  <b>Kid-facing agents</b>
                  <small>Kix, Ask Kix, Critter Keeper…</small>
                </span>
                <span className="sx-chip" data-tone="def">
                  Muse Spark 1.3, Standard only (rule 1)
                </span>
              </div>
              <h3 className="ad-h3">Budget</h3>
              <div className="sx-budget">
                <label>
                  <span>Reviews a day ($)</span>
                  <input type="number" min={0} max={50} step={0.5} value={draft.budgetReviewUsd} onChange={(e) => setDraft({ ...draft, budgetReviewUsd: Number(e.target.value) || 0 })} />
                </label>
                <label>
                  <span>Evals a night ($)</span>
                  <input type="number" min={0} max={20} step={0.1} value={draft.budgetEvalUsd} onChange={(e) => setDraft({ ...draft, budgetEvalUsd: Number(e.target.value) || 0 })} />
                </label>
                <div>
                  <span>Spent today</span>
                  <b>${data.spentToday.toFixed(2)}</b>
                </div>
              </div>
              <div className="sx-row sx-save">
                <button type="button" className="mk-btn mk-btn--primary" disabled={busy === "settings"} onClick={() => void saveSettings()}>
                  {busy === "settings" ? "Saving…" : "Save settings"}
                </button>
              </div>
            </section>
          </div>
        )}

        {data && tab === "retrain" && (
          <section className="sx-retrain">
            <div className="sx-row">
              <h2 className="ad-h2">Retrain Kix</h2>
              <span className="sx-chip" data-tone="open">
                Next
              </span>
            </div>
            <p>Every fix becomes a training example. When a trainer is connected, a myKx model learns from them, and it must pass the evals before it does any job.</p>
            <div className="sx-ds">
              <div>
                <b>{data.dataset.supervised}</b>fixed answers: question → better answer
              </div>
              <div>
                <b>{data.dataset.preference}</b>pairs: worse answer vs better
              </div>
              <div>
                <b>{data.dataset.families}</b>families turned on Help Kix learn
              </div>
              <div>
                <b>0</b>names, ids or Guardian data
              </div>
            </div>
            <ol className="sx-flow" aria-label="How retraining would work">
              <li>Dataset</li>
              <li data-dim>Train</li>
              <li data-dim>Evals gate</li>
              <li data-dim>Use for a job</li>
            </ol>
            <div className="sx-providers">
              <div>
                <span>
                  <b>Baseten Training</b>
                  <small>Fine-tune a Meta open-weight model</small>
                </span>
                <span className="sx-ghost">Not connected yet</span>
              </div>
              <div>
                <span>
                  <b>Your own trainer</b>
                  <small>Download the de-identified JSONL</small>
                </span>
                <a className="sx-ghost" href="/api/admin/synapse/dataset" download>
                  Export JSONL
                </a>
              </div>
            </div>
            <p className="sx-fine">Only from families who said yes (Family → Help Kix learn). A family that turns it off drops out of the next export.</p>
          </section>
        )}
      </div>
    </>
  );
}
