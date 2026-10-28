"use client";

// Admin → Skills (board AdminSkills; SKILL_ENGINE.md §7): the skill packs Kix's agents load, with their exam
// coverage, reviewed items and versions; for the picked pack, which agents may load it, its tools and topics, and
// Edit (board SkillEditor); Import a standard agent skill (board SkillImport); and a live trace of the agents'
// model calls (which agent, never which child).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { PackCard, PublicRun } from "@/lib/admin/hood";
import { AdminFrame } from "../AdminFrame";
import { call, failWords } from "./call";
import { ImportDialog } from "./ImportDialog";
import "./skills.css";

type Card = PackCard & { publishedVersion: string | null; draftVersion: string | null; versions: number };
type Catalogue = { live: boolean; packs: Card[]; updates: { pack: string; version: string; publishedAt: string }[]; runs: PublicRun[] };

const AGENT_NAME: Record<string, [string, string]> = {
  tutor: ["Kix Tutor", "Hints and “why?” in the question player"],
  vibe: ["Vibe Zone maker", "Flashcards from the child's brief"],
  parent: ["Parent summary", "The evening summary for grown-ups"],
  curator: ["Content Curator", "Reads uploaded papers into this pack"],
};
const MODES = [
  ["auto", "Auto"],
  ["on_demand", "On demand"],
  ["off", "Off"],
] as const;
const LEVEL_ORDER = ["P1", "P2", "P3", "P4", "P5", "P6", "Sec 1", "Sec 2", "Sec 3", "Sec 4"];
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Singapore" });
const short = (v: string) => v.replace(/\.0$/, "");

export function SkillsScreen() {
  const router = useRouter();
  const [data, setData] = useState<Catalogue | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [level, setLevel] = useState("All");
  const [picked, setPicked] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let live = true;
    void call<Catalogue>("GET", "/api/admin/skills").then((r) => {
      if (!live) return;
      if (r.ok && r.data) setData(r.data);
      else setFailed(r.status === 403 ? "Admins only." : failWords(r, "Couldn't load the skill packs."));
    });
    return () => {
      live = false;
    };
  }, []);

  const levels = useMemo(() => ["All", ...[...new Set((data?.packs ?? []).map((p) => p.level))].sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b))], [data]);
  const shown = (data?.packs ?? []).filter((p) => level === "All" || p.level === level);
  const pack = data?.packs.find((p) => p.id === picked) ?? shown[0] ?? null;

  return (
    <AdminFrame current="/admin/skills">
      <header className="ad-head">
        <div>
          <h1 className="ad-h1">Skills</h1>
          <p className="ad-lede">{data ? `${data.packs.length} skill packs.` : "Skill packs for P3, P6 and Sec 2."} Kix&apos;s agents load them as each lesson needs: read by id, never searched, and never able to change a score. Edit a pack, ask Muse to improve it, or import a skill; every change is a version you can diff, restore or delete.</p>
        </div>
        <div className="sk-tools">
          <button type="button" className="sk-btn" onClick={() => setImporting(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Import skill (.zip, .skill)
          </button>
          <Link href="/admin/knowledge" className="mk-btn mk-btn--primary ad-btn">
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18 }}>
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            Add knowledge
          </Link>
        </div>
      </header>
      {failed && <p className="ad-lede">{failed}</p>}
      {!data && !failed && <p className="ad-lede">Loading the skill packs…</p>}
      {data && (
        <>
          <div className="ad-filters" role="group" aria-label="Level">
            {levels.map((l) => (
              <button key={l} type="button" className="ad-filter ap-chip" aria-pressed={l === level} onClick={() => setLevel(l)}>
                {l}
              </button>
            ))}
          </div>
          <div className="ad-split">
            <div className="ad-packs">
              {shown.map((p) => (
                <button key={p.id} type="button" className="ad-pack" aria-pressed={p.id === pack?.id} onClick={() => setPicked(p.id)}>
                  <span className="ad-pack-top">
                    <span className="ad-level">{p.level}</span>
                    <span className="ad-ver">
                      v{short(p.version)} · {p.source === "version" ? "published" : "default"}
                    </span>
                  </span>
                  <span className="ad-pack-title">{p.title}</span>
                  <span className="ad-muted">
                    {p.topics.length} topics · {p.references} reference notes
                  </span>
                  <span className="ad-row">
                    <span>Exam coverage</span>
                    <strong>{p.coverage}%</strong>
                  </span>
                  <span className="ad-bar" aria-hidden="true">
                    <span style={{ width: `${p.coverage}%` }} />
                  </span>
                  <span className="ad-row">
                    <span>
                      <strong>{p.reviewed}</strong> reviewed
                    </span>
                    <span>
                      <strong>{p.drafts}</strong> to review
                    </span>
                  </span>
                  <span className="sk-badges" style={{ marginTop: 0 }}>
                    {p.draftVersion && <span className="sk-chip sk-draft">Draft v{short(p.draftVersion)}</span>}
                    {p.imported && <span className="sk-chip sk-plain">Imported</span>}
                    {p.versions > 0 && (
                      <span className="sk-chip sk-plain">
                        {p.versions} {p.versions === 1 ? "version" : "versions"}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            <div className="ad-col">
              {pack && (
                <section className="ad-card ad-col" aria-label={`${pack.title} details`}>
                  <div className="ad-head">
                    <h2 className="ad-h2">{pack.title}</h2>
                    <Link href={`/admin/skills/${pack.id}`} className="sk-btn sk-btn--pri">
                      Edit skill
                    </Link>
                  </div>
                  <p className="ad-muted">
                    {pack.source === "version" ? `Kix reads published v${short(pack.version)}.` : `Kix reads the built-in default v${short(pack.version)}.`}
                    {pack.draftVersion ? ` A draft v${short(pack.draftVersion)} waits for review.` : ""}
                  </p>
                  <span className="ad-muted">Which agents may load it</span>
                  <ul className="ad-agents">
                    {Object.entries(pack.agents).map(([id, mode]) => (
                      <li key={id} className="ad-agent">
                        <span>
                          <span className="ad-h3">{AGENT_NAME[id]?.[0] ?? id}</span>
                          <span className="ad-muted" style={{ display: "block" }}>
                            {AGENT_NAME[id]?.[1] ?? ""}
                          </span>
                        </span>
                        <span className="ad-seg" aria-label={`${AGENT_NAME[id]?.[0] ?? id}: ${mode.replace("_", " ")}`}>
                          {MODES.map(([m, label]) => (
                            <span key={m} data-on={m === mode}>
                              {label}
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="ad-tools">
                    <span className="ad-muted">Tools</span>
                    {pack.tools.map((t) => (
                      <code key={t} className="ad-tool">
                        {t}
                      </code>
                    ))}
                  </div>
                  <p className="ad-muted">Up to 2 subject skills at once · muse-spark-1.3 Standard (locked) · tools can&apos;t change scores. Set in the pack&apos;s skill.json (Edit skill).</p>
                  <h3 className="ad-h3">Topics</h3>
                  <ul className="ad-topics">
                    {pack.topics.map((t) => (
                      <li key={t.id}>
                        <span>{t.title}</span>
                        <span className="ad-muted">{t.items ? `${t.items} items` : "patterns only"}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="ad-card ad-col" aria-label="Live agent trace">
                <div className="ad-head">
                  <h2 className="ad-h2">Live agent trace</h2>
                  <span className="ad-muted">{data.live ? "Meta models live" : "No model key: cached answers"}</span>
                </div>
                {data.runs.length ? (
                  <ol className="ad-trace">
                    {data.runs.slice(0, 20).map((r, i) => (
                      <li key={i}>
                        <span className="ad-t">{time(r.at)}</span>
                        <span>
                          <strong>{r.agent}</strong> · {r.model}
                          {!r.ok && <span className="ad-fail"> · failed</span>}
                        </span>
                        <span className="ad-detail">
                          {r.operation.replace("_", " ")} · {r.latencyMs !== null ? `${(r.latencyMs / 1000).toFixed(1)} s` : "—"}
                          {r.inputTokens !== null ? ` · ${r.inputTokens} in / ${r.outputTokens ?? 0} out tokens` : ""}
                          {r.forChild ? " · for a child (Standard)" : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="ad-muted">No model calls logged yet. Ask Kix something and they appear here.</p>
                )}
              </section>
            </div>
          </div>
        </>
      )}
      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onImported={(p) => {
            setImporting(false);
            router.push(`/admin/skills/${p}`);
          }}
        />
      )}
    </AdminFrame>
  );
}
