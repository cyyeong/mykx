"use client";

// One Kix Synapse case (board SynapseCase): the trace from the kid's flag to the decision, what the kid saw and said,
// the reviewer's verdict, the fix (editable before approving), the test before and after, the computed confidence
// and its caps, and the admin's decision. Learners show by level only.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/account/api";
import type { AdminReport } from "@/lib/synapse/admin";
import { AGENT_NAME, Meter, statusChip, when } from "./SynapseScreen";
import "./synapse.css";

const SURFACE: Record<string, string> = { learn: "Learn", "ask-kix": "Ask Kix", tutor: "Kix Tutor", critter: "Critter Lab" };
const VERDICT: Record<string, string> = { problem: "A real problem", "not-a-problem": "Not a problem: Kix was right", unclear: "Unclear" };
const TITLE: Record<string, string> = { typo: "A word is spelt wrong", "marked-wrong": "My answer was marked wrong", figure: "The picture doesn't match", hint: "The hint didn't help", "question-wrong": "The question looks wrong", "answer-wrong": "Kix's answer looks wrong", confusing: "It doesn't make sense", "pet-wrong": "Not true for this stage", other: "Something else" };
const FIXKIND: Record<string, string> = { "item-text": "Fix the question's words", "item-accept": "Accept another answer", "item-answer": "Change the answer key", caution: "A learned caution", none: "No change" };

export function CaseScreen({ id }: { id: string }) {
  const [r, setR] = useState<AdminReport | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ before: string; after: string; when: string; check: string; kidNote: string } | null>(null);

  const load = useCallback(async () => {
    const res = await api<{ report: AdminReport }>("GET", `/api/admin/synapse/${id}`);
    if (res.ok && res.data) setR(res.data.report);
    else setFailed(res.status === 403 ? "Admins only." : "Couldn't load this case.");
  }, [id]);
  useEffect(() => {
    let live = true;
    void api<{ report: AdminReport }>("GET", `/api/admin/synapse/${id}`).then((res) => {
      if (!live) return;
      if (res.ok && res.data) setR(res.data.report);
      else setFailed(res.status === 403 ? "Admins only." : "Couldn't load this case.");
    });
    return () => {
      live = false;
    };
  }, [id]);

  // Reviewing takes a minute: look again while it runs.
  useEffect(() => {
    if (!r || !["new", "reviewing"].includes(r.status)) return;
    const t = setTimeout(() => void load(), 4000);
    return () => clearTimeout(t);
  }, [r, load]);

  async function act(action: "approve" | "reject" | "undo" | "retry") {
    if (!r) return;
    setBusy(true);
    setMsg(null);
    const body: Record<string, unknown> = { action };
    if (action === "approve" && edit) body.fix = { before: edit.before || null, after: edit.after || null, when: edit.when || null, check: edit.check || null };
    if ((action === "approve" || action === "reject") && edit?.kidNote) body.kidNote = edit.kidNote;
    const res = await api<{ report: AdminReport }>("POST", `/api/admin/synapse/${r.id}`, body);
    setBusy(false);
    if (res.ok && res.data) {
      setR(res.data.report);
      setEdit(null);
      setMsg(action === "approve" ? "Approved and shipped." : action === "reject" ? "Closed." : action === "undo" ? "Undone." : "Reviewing again…");
    } else setMsg(`That didn't go through${res.reason ? ` (${res.reason})` : ""}.`);
  }

  const review = r?.review;
  const f = review?.fix;
  const chip = r ? statusChip(r.status, r) : null;
  const decided = r && ["auto-fixed", "approved", "kix-was-right", "rejected", "undone"].includes(r.status);
  const scoring = f?.type === "item-accept" || f?.type === "item-answer";

  return (
    <>
      <div className="sx">
        <p className="sx-crumb">
          <Link href="/admin/synapse">Kix Synapse</Link> › Report {id.slice(0, 8)}
        </p>
        {failed && <p className="ad-lede">{failed}</p>}
        {!r && !failed && <p className="ad-lede">Loading…</p>}
        {r && chip && (
          <>
            <header className="sx-head">
              <div>
                <h1 className="ad-h1">{TITLE[r.kind] ?? "A report"}</h1>
                <p className="ad-lede">
                  {SURFACE[r.surface]} · {r.turn.packId ?? r.turn.subject ?? ""} · flagged by a {r.who} · {when(r.createdAt)}
                </p>
              </div>
              <span className="sx-chip" data-tone={chip.tone}>
                {chip.label}
              </span>
            </header>
            {msg && (
              <p className="sx-note" role="status">
                {msg}
              </p>
            )}
            <div className="sx-case">
              <section className="ad-card">
                <h2 className="ad-h2">Trace</h2>
                <p className="sx-muted">Ids and numbers for every call; words only for the turn the learner reported.</p>
                <ol className="sx-trace">
                  {r.steps.map((s, i) => (
                    <li key={i} data-k={s.kind}>
                      <em>{new Date(s.at).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Singapore" })}</em>
                      {s.title}
                      {s.detail && <small>{s.detail}</small>}
                    </li>
                  ))}
                </ol>
              </section>

              <section className="sx-col">
                <div className="ad-card">
                  <h2 className="ad-h2">What the learner saw, and their report</h2>
                  <div className="sx-saw">
                    <div className="sx-shown">
                      {r.case.item && (
                        <>
                          <b>Question {r.case.item.id}</b>
                          <p>{r.case.item.stem}</p>
                          {r.case.item.options && (
                            <ol>
                              {r.case.item.options.map((o, i) => (
                                <li key={i}>{o}</li>
                              ))}
                            </ol>
                          )}
                          <small>Answer key: {String(r.case.item.answer)}</small>
                        </>
                      )}
                      {r.case.ask && (
                        <p>
                          <b>Asked: </b>
                          {r.case.ask}
                        </p>
                      )}
                      {r.case.shown && <pre>{r.case.shown}</pre>}
                    </div>
                    <div className="sx-report">
                      <span className="sx-chip" data-tone="flag">
                        {r.kind.replace("-", " ")}
                      </span>
                      {r.case.note ? <p>&ldquo;{r.case.note}&rdquo;</p> : <p className="sx-muted">No note.</p>}
                      {r.case.answer && (
                        <p>
                          Their answer: <b>{r.case.answer}</b> {r.case.marked === false ? "(marked wrong)" : r.case.marked ? "(marked right)" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {review && f ? (
                  <div className="ad-card">
                    <div className="sx-row">
                      <h2 className="ad-h2">Synapse Reviewer</h2>
                      {r.reviewModel && (
                        <span className="sx-chip" data-tone="open">
                          {r.reviewModel.model === "muse-spark-1.3" ? "Muse Spark 1.3" : "Muse Spark Open"} · {r.reviewModel.provider === "baseten" ? "Baseten" : "Meta"}
                          {r.reviewModel.fallback ? " (fallback)" : ""}
                        </span>
                      )}
                    </div>
                    <p className="sx-verdict">
                      <b>{VERDICT[review.verdict]}</b> ({review.kind.replace("-", " ")}). {review.rationale}
                    </p>
                    {review.evidence.length > 0 && (
                      <ul className="sx-evidence">
                        {review.evidence.map((e, i) => (
                          <li key={i}>&ldquo;{e}&rdquo;</li>
                        ))}
                      </ul>
                    )}
                    <h3 className="ad-h3">Proposed fix: {FIXKIND[f.type]}</h3>
                    {edit ? (
                      <div className="sx-edit">
                        {f.type === "caution" ? (
                          <>
                            <label>
                              When <input value={edit.when} maxLength={110} onChange={(e) => setEdit({ ...edit, when: e.target.value })} />
                            </label>
                            <label>
                              check <input value={edit.check} maxLength={140} onChange={(e) => setEdit({ ...edit, check: e.target.value })} />
                            </label>
                          </>
                        ) : (
                          <>
                            {f.type === "item-text" && (
                              <label>
                                Before <input value={edit.before} maxLength={400} onChange={(e) => setEdit({ ...edit, before: e.target.value })} />
                              </label>
                            )}
                            <label>
                              {f.type === "item-text" ? "After" : "Answer"} <input value={edit.after} maxLength={400} onChange={(e) => setEdit({ ...edit, after: e.target.value })} />
                            </label>
                          </>
                        )}
                        <label>
                          For the learner <textarea value={edit.kidNote} maxLength={240} rows={2} onChange={(e) => setEdit({ ...edit, kidNote: e.target.value })} />
                        </label>
                      </div>
                    ) : f.type === "caution" ? (
                      <p className="sx-code">
                        <b>When</b> {f.when}, <b>check</b> {f.check}.
                      </p>
                    ) : f.type === "item-text" ? (
                      <p className="sx-code">
                        {f.field}: <del>{f.before}</del> → <ins>{f.after}</ins>
                      </p>
                    ) : f.type !== "none" ? (
                      <p className="sx-code">
                        {FIXKIND[f.type]}: <ins>{f.after}</ins>
                      </p>
                    ) : null}
                    {review.kidNote && !edit && (
                      <p className="sx-kid">
                        <b>The learner will hear: </b>
                        {review.kidNote}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="ad-card">
                    <p className="sx-muted">{r.status === "failed" ? "The review didn't finish. Retry it below." : "Reviewing… this takes about a minute."}</p>
                  </div>
                )}

                {review && (r.reproduce || r.retest) && (
                  <div className="ad-card">
                    <div className="sx-row">
                      <h2 className="ad-h2">
                        Test: {review.test.kind} {review.test.expect}
                      </h2>
                    </div>
                    <div className="sx-tests">
                      {r.reproduce && (
                        <div data-tone={r.reproduce.how === "model" ? (r.reproduce.failing > 0 ? "bad" : "ok") : r.reproduce.failing > 0 ? "ok" : "bad"}>
                          {r.reproduce.how === "model" ? `${r.reproduce.runs - r.reproduce.failing} of ${r.reproduce.runs} right` : r.reproduce.how === "pack" ? (r.reproduce.failing ? "Found in the pack" : "Not found in the pack") : "Can't re-run"}
                          <small>{r.reproduce.how === "model" ? "now, without the fix" : "reproduce"}</small>
                        </div>
                      )}
                      {r.retest && (
                        <div data-tone={r.retest.after === r.retest.runs ? "ok" : "bad"}>
                          {r.retest.after} of {r.retest.runs} right<small>with the caution</small>
                        </div>
                      )}
                      {r.retest?.others && (
                        <div data-tone={r.retest.others.passed === r.retest.others.total ? "ok" : "bad"}>
                          {r.retest.others.passed} / {r.retest.others.total}
                          <small>{AGENT_NAME[r.turn.agent ?? ""] ?? "The agent"}&apos;s other evals</small>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <section className="sx-col">
                <div className="ad-card">
                  <h2 className="ad-h2">Synapse confidence</h2>
                  <div className="sx-big">
                    <b>{r.confidence ?? "—"}</b>
                    <span>needs {r.threshold} to fix by itself</span>
                  </div>
                  {r.confidence !== null && <Meter value={r.confidence} threshold={r.threshold} />}
                  <ul className="sx-breakdown">
                    <li>
                      Reviewer<b>{review ? Math.round(review.confidence) : "—"}</b>
                    </li>
                    <li>
                      Reproduced<b>{r.reproduce ? (r.reproduce.how === "model" ? `${r.reproduce.failing} of ${r.reproduce.runs} runs` : r.reproduce.how === "pack" ? "in the pack" : "not possible") : "—"}</b>
                    </li>
                    <li>
                      Code checks
                      <b>
                        {r.checks.filter((c) => c.ok).length} of {r.checks.length}
                      </b>
                    </li>
                    <li>
                      Re-test<b>{r.retest ? `${r.retest.after} of ${r.retest.runs}` : "—"}</b>
                    </li>
                    <li>
                      Second opinion<b>{r.second ? `${r.second.agree ? "agrees" : "disagrees"} · ${r.second.confidence}` : scoring ? "needed" : "not needed"}</b>
                    </li>
                  </ul>
                  {r.caps.length > 0 && <p className="sx-muted">Capped: {r.caps.join(" · ")}</p>}
                  <div className="sx-actions">
                    {!decided && review && (
                      <>
                        <button type="button" className="mk-btn mk-btn--primary" disabled={busy} onClick={() => void act("approve")}>
                          {f?.type === "none" || review.verdict === "not-a-problem" ? "Approve: Kix was right" : f?.type === "caution" ? "Approve and add the caution" : "Approve and publish the fix"}
                        </button>
                        {f && f.type !== "none" && !edit && (
                          <button type="button" className="mk-btn mk-btn--secondary" onClick={() => setEdit({ before: f.before ?? "", after: f.after ?? "", when: f.when ?? "", check: f.check ?? "", kidNote: review.kidNote })}>
                            Edit the fix
                          </button>
                        )}
                        <button type="button" className="mk-btn mk-btn--secondary sx-del" disabled={busy} onClick={() => void act("reject")}>
                          {review.verdict === "not-a-problem" ? "Close without a note" : "Not a problem"}
                        </button>
                      </>
                    )}
                    {["failed", "waiting", "new"].includes(r.status) && (
                      <button type="button" className="mk-btn mk-btn--secondary" disabled={busy} onClick={() => void act("retry")}>
                        Review again
                      </button>
                    )}
                    {(r.status === "auto-fixed" || r.status === "approved") && r.fixRef && (
                      <button type="button" className="mk-btn mk-btn--secondary sx-del" disabled={busy} onClick={() => void act("undo")}>
                        Undo the fix
                      </button>
                    )}
                  </div>
                  {r.checks.some((c) => !c.ok) && (
                    <ul className="sx-checks">
                      {r.checks
                        .filter((c) => !c.ok)
                        .map((c) => (
                          <li key={c.name}>
                            {c.name}: {c.note}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
                <div className="ad-card">
                  <h2 className="ad-h2">Privacy</h2>
                  <p className="sx-muted">Only the turn the learner reported, nicknames replaced. {r.reviewModel?.provider === "baseten" ? "Reviewed on Baseten with zero data retention." : "Reviewed on Meta's Standard API."} Every action is logged. Cost so far ${r.costUsd.toFixed(4)}.</p>
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}
