"use client";

// Admin → Under the hood (PRD_REVIEW demo 2:35, USER_STORIES A-23): Kix's agents and what each may never do, every
// model call summed per Meta model (from model_runs: ids and numbers, never prompts or a child's words), the newest
// calls, and the art made during the event (public/art/manifest.json). Synthetic data is labelled (rule 8).
import { useEffect, useState } from "react";
import { api } from "@/components/account/api";
import type { Agent, ManifestSummary, ModelTotal, PublicRun, PublicSkillEvent } from "@/lib/admin/hood";
import { AdminFrame } from "../AdminFrame";

type Hood = { live: boolean; agents: Agent[]; totals: ModelTotal[]; runs: PublicRun[]; manifest: ManifestSummary; skills?: { loads: number; tools: number; refusals: number; events: PublicSkillEvent[] } };

const n = (v: number) => v.toLocaleString("en-SG");
const usd = (v: number) => (v < 0.01 && v > 0 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`);
const at = (iso: string) => new Date(iso).toLocaleString("en-SG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Singapore" });
const day = (d: string) => new Date(`${d}T04:00:00Z`).toLocaleDateString("en-SG", { day: "numeric", month: "short", timeZone: "UTC" });

export function HoodScreen() {
  const [data, setData] = useState<Hood | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void api<Hood>("GET", "/api/admin/hood").then((r) => {
      if (!live) return;
      if (r.ok && r.data) setData(r.data);
      else setFailed(r.status === 403 ? "Admins only." : "Couldn't load Under the hood.");
    });
    return () => {
      live = false;
    };
  }, []);

  const calls = data?.totals.reduce((s, t) => s + t.calls, 0) ?? 0;
  const cost = data?.totals.reduce((s, t) => s + t.costUsd, 0) ?? 0;
  const tokens = data?.totals.reduce((s, t) => s + t.inputTokens + t.outputTokens, 0) ?? 0;

  return (
    <AdminFrame current="/admin/under-the-hood">
      <header className="ad-head">
        <div>
          <h1 className="ad-h1">Under the hood</h1>
          <p className="ad-lede">How Kix thinks: the agents, the Meta models they call, and what each one may never do. Every call is logged with its model, time, tokens and cost; never a prompt, an answer or a child&apos;s words.</p>
        </div>
        <span className="ad-label">Demo family · synthetic data</span>
      </header>
      {failed && <p className="ad-lede">{failed}</p>}
      {!data && !failed && <p className="ad-lede">Loading…</p>}
      {data && (
        <>
          <section className="ad-card ad-stats" aria-label="Totals">
            <div className="ad-stat">
              <span className="ad-muted">Model calls logged</span>
              <p className="ad-big">{n(calls)}</p>
            </div>
            <div className="ad-stat">
              <span className="ad-muted">Meta models used</span>
              <p className="ad-big">{data.totals.length}</p>
            </div>
            <div className="ad-stat">
              <span className="ad-muted">Tokens</span>
              <p className="ad-big">{n(tokens)}</p>
            </div>
            <div className="ad-stat">
              <span className="ad-muted">Estimated cost</span>
              <p className="ad-big">{usd(cost)}</p>
            </div>
            <div className="ad-stat">
              <span className="ad-muted">Art from Muse Image + SAM</span>
              <p className="ad-big">{n(data.manifest.byModel.filter((m) => m.model === "muse-image-1.0" || m.model === "sam-3.1").reduce((s, m) => s + m.count, 0))}</p>
            </div>
          </section>

          <section className="ad-col" aria-label="Agents">
            <h2 className="ad-h2">Kix&apos;s agents</h2>
            <div className="ad-agentgrid">
              {data.agents.map((a) => (
                <article key={a.id} className="ad-agentcard">
                  <h3 className="ad-h3">{a.name}</h3>
                  <div className="ad-models">
                    {a.models.length ? (
                      a.models.map((m) => (
                        <code key={m} className="ad-model">
                          {m}
                        </code>
                      ))
                    ) : (
                      <span className="ad-model is-none">no model: rules in code</span>
                    )}
                  </div>
                  <p className="ad-muted">Reads: {a.reads}</p>
                  <p className="ad-never">
                    <strong>Never</strong> {a.never.charAt(0).toLowerCase() + a.never.slice(1)}.
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="ad-card ad-col" aria-label="Per model">
            <div className="ad-head">
              <h2 className="ad-h2">Per model</h2>
              <span className="ad-muted">{data.live ? "Live: Meta Model API, Standard keys only" : "No model key here: cached answers, nothing logged"}</span>
            </div>
            {data.totals.length ? (
              <div className="ad-scroll">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th className="ad-num">Calls</th>
                      <th className="ad-num">Failed</th>
                      <th className="ad-num">Avg time</th>
                      <th className="ad-num">Tokens in</th>
                      <th className="ad-num">Tokens out</th>
                      <th className="ad-num">Images</th>
                      <th className="ad-num">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.totals.map((t) => (
                      <tr key={t.model}>
                        <td>
                          <code>{t.model}</code>
                        </td>
                        <td className="ad-num">{n(t.calls)}</td>
                        <td className="ad-num">{t.failed || "—"}</td>
                        <td className="ad-num">{t.avgLatencyMs !== null ? `${(t.avgLatencyMs / 1000).toFixed(1)} s` : "—"}</td>
                        <td className="ad-num">{n(t.inputTokens)}</td>
                        <td className="ad-num">{n(t.outputTokens)}</td>
                        <td className="ad-num">{t.images || "—"}</td>
                        <td className="ad-num">{usd(t.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ad-muted">No calls logged yet.</p>
            )}
          </section>

          <section className="ad-card ad-col" aria-label="Skill Engine">
            <h2 className="ad-h2">Skill Engine: what Kix loaded and read</h2>
            <p className="ad-muted">
              Kix Tutor and Ask Kix call tools: load one of the child&apos;s packs, read a section by id, find a practice question, check one by code. Trusted code runs every tool;
              a rule decides what may load. {data.skills ? `${n(data.skills.loads)} loads, ${n(data.skills.tools)} tool calls, ${n(data.skills.refusals)} refused.` : ""}
            </p>
            {data.skills?.events.length ? (
              <div className="ad-scroll">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Agent</th>
                      <th>What</th>
                      <th>Pack</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.skills.events.slice(0, 20).map((e, i) => (
                      <tr key={i}>
                        <td>{at(e.at)}</td>
                        <td>{e.agent}</td>
                        <td>
                          {e.kind === "tool" ? <code>{e.tool}</code> : e.kind === "load" ? (e.tool ? "loaded on request" : "loaded for the quest") : e.kind}
                          {!e.ok && <span className="ad-fail"> · refused</span>}
                        </td>
                        <td>
                          <code>{e.pack ?? "—"}</code>
                        </td>
                        <td className="ad-muted">{[e.target && e.kind === "tool" ? e.target : null, e.note].filter(Boolean).join(": ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ad-muted">No skill events yet: ask Kix for a hint in a quest.</p>
            )}
          </section>

          <section className="ad-card ad-col" aria-label="Newest calls">
            <h2 className="ad-h2">Newest calls</h2>
            {data.runs.length ? (
              <div className="ad-scroll">
                <table className="ad-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Agent</th>
                      <th>Model</th>
                      <th className="ad-num">Time</th>
                      <th className="ad-num">First token</th>
                      <th className="ad-num">Tokens</th>
                      <th>Request id</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.runs.slice(0, 25).map((r, i) => (
                      <tr key={i}>
                        <td>{at(r.at)}</td>
                        <td>
                          {r.agent}
                          {r.forChild ? <span className="ad-muted"> · child</span> : null}
                          {!r.ok && <span className="ad-fail"> · failed</span>}
                        </td>
                        <td>
                          <code>{r.model}</code>
                        </td>
                        <td className="ad-num">{r.latencyMs !== null ? `${(r.latencyMs / 1000).toFixed(1)} s` : "—"}</td>
                        <td className="ad-num">{r.firstTokenMs !== null ? `${(r.firstTokenMs / 1000).toFixed(1)} s` : "—"}</td>
                        <td className="ad-num">{r.inputTokens !== null ? `${n(r.inputTokens)} / ${n(r.outputTokens ?? 0)}` : r.images ? `${r.images} img` : "—"}</td>
                        <td>
                          <code className="ad-muted">{r.requestId ? r.requestId.slice(0, 18) : "—"}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ad-muted">No calls logged yet.</p>
            )}
          </section>

          <section className="ad-card ad-col" aria-label="Art">
            <div className="ad-head">
              <h2 className="ad-h2">Art made for myKx</h2>
              <span className="ad-muted">
                {n(data.manifest.assets)} files in the manifest{data.manifest.first ? `, made ${day(data.manifest.first)}–${day(data.manifest.last!)}` : ""}. Original art only; every file has its prompt, model and hash.
              </span>
            </div>
            <div className="ad-models">
              {data.manifest.byModel.map((m) => (
                <span key={m.model} className={m.model === "code (sharp)" ? "ad-model is-none" : "ad-model"}>
                  {m.model} · {m.count}
                </span>
              ))}
            </div>
            <div className="ad-gallery">
              {data.manifest.samples.map((s) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={s.id} src={s.path} alt={`${s.kind} made with ${s.model}`} loading="lazy" />
              ))}
            </div>
          </section>
        </>
      )}
    </AdminFrame>
  );
}
