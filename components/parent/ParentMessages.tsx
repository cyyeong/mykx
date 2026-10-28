"use client";

// Messages (PARENT_INSIGHTS §3): the thread with one kid, quick encouragements, Kix stickers and words. Kix
// suggests a message from the guardian's flags (deterministic, never from reading the thread): family messages
// never reach Kix or a model (rule 12).
import { useEffect, useRef, useState } from "react";
import { api } from "@/components/account/api";
import { KixSticker } from "@/components/family/KixSticker";
import { ENCOURAGEMENTS, STICKERS, STICKER_INFO, type FamilyMessage, type Sticker } from "@/lib/family/messages";
import type { GuardianFlag } from "@/lib/guardian/flags";
import "./parentDash.css";
import "./family.css";

type KidRef = { id: string; nickname: string };
type Thread = { me: string; kids: KidRef[]; kid: KidRef | null; thread: FamilyMessage[]; unread: Record<string, number> };

/** A gentle message idea for the most pressing flag (or none). */
function suggestion(flags: GuardianFlag[], nickname: string): { why: string; body: string; sticker: Sticker } | null {
  const f = flags.find((x) => x.level !== "info");
  if (!f) return null;
  const idea: Record<GuardianFlag["kind"], { body: string; sticker: Sticker }> = {
    distress: { body: `I'm here for you, ${nickname}. Come find me?`, sticker: "hug" },
    "self-talk": { body: "You're learning, and that takes courage. Proud of you.", sticker: "proud" },
    "low-mood": { body: "Want to take a break together?", sticker: "hug" },
    "tired-evenings": { body: "Time to rest those eyes. Great effort today!", sticker: "rest" },
    "focus-low": { body: "Short break, then one more?", sticker: "got-this" },
    "over-limit": { body: "Screen time's up for today. See you at dinner!", sticker: "rest" },
    "late-night": { body: "Bedtime soon. Proud of today!", sticker: "rest" },
  };
  return { why: f.title, ...idea[f.kind] };
}

const at = (iso: string) => new Date(iso).toLocaleString("en-SG", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });

export function ParentMessages() {
  const [data, setData] = useState<Thread | null>(null);
  const [kidId, setKidId] = useState<string | null>(null);
  const [flags, setFlags] = useState<GuardianFlag[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => {
    let live = true;
    const q = kidId ? `?kid=${encodeURIComponent(kidId)}` : "";
    void api<Thread>("GET", `/api/messages${q}`).then((r) => {
      if (!live) return;
      if (r.ok && r.data) setData(r.data);
      else setFailed(true);
    });
    void api<{ view: { flags: GuardianFlag[] } | null }>("GET", `/api/guardian/summary${q}`).then((r) => live && r.ok && setFlags(r.data?.view?.flags ?? []));
    return () => {
      live = false;
    };
  }, [kidId, version]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [data?.thread.length]);

  if (failed) return <p className="pshell-p">Couldn&apos;t load messages. Check your connection and try again.</p>;
  if (!data) return <p className="pshell-p">Loading messages…</p>;
  if (!data.kid) return <p className="pshell-p">No kids yet. Add one in Your family to get started.</p>;
  const kid = data.kid;
  const idea = suggestion(flags, kid.nickname);

  const send = async (m: { body?: string; sticker?: Sticker }) => {
    setBusy(true);
    const r = await api<{ message: FamilyMessage }>("POST", "/api/messages", { kidId: kid.id, message: m });
    setBusy(false);
    if (r.ok && r.data) {
      setData((d) => (d ? { ...d, thread: [...d.thread, r.data!.message] } : d));
      if (m.body === text.trim()) setText("");
    }
  };

  return (
    <div className="fm-root">
      <div className="fm-head">
        <div>
          <h2 className="pd-h1">Messages with {kid.nickname}</h2>
          <span className="pd-muted">Just between you two. Kix never reads these.</span>
        </div>
        {data.kids.length > 1 && (
          <div className="pd-kids fm-kids" role="group" aria-label="Child">
            {data.kids.map((k) => (
              <button key={k.id} type="button" className="pd-click pd-kid" aria-pressed={k.id === kid.id} onClick={() => setKidId(k.id)}>
                {k.nickname}
                {data.unread[k.id] ? <span className="fm-count">{data.unread[k.id]}</span> : null}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="pd-card fm-thread" aria-label={`Thread with ${kid.nickname}`}>
        {data.thread.length === 0 ? (
          <div className="fm-empty">
            <KixSticker sticker="cheer" size={112} />
            <p className="pd-p">No messages yet. Send {kid.nickname} a cheer: it pops up on their Home.</p>
          </div>
        ) : (
          <ol className="fm-list">
            {data.thread.map((m) => {
              const mine = m.from === data.me;
              return (
                <li key={m.id} className={mine ? "fm-msg is-mine" : "fm-msg"}>
                  {m.sticker && <KixSticker sticker={m.sticker} size={96} />}
                  {m.body && <p className="fm-bubble">{m.body}</p>}
                  <span className="fm-meta">
                    {mine ? "You" : kid.nickname}
                    {m.byVoice ? " · said aloud" : ""} · {at(m.at)}
                    {mine && m.readAt ? " · seen" : ""}
                  </span>
                </li>
              );
            })}
            <li ref={end} aria-hidden="true" />
          </ol>
        )}
      </section>

      <section className="pd-card fm-compose" aria-label="Write to your kid">
        {idea && (
          <div className="fm-idea">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="fm-idea-icon">
              <path d="M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z" />
            </svg>
            <div>
              <p className="fm-idea-title">
                <strong>Kix suggests</strong> · {idea.why}
              </p>
              <button type="button" className="fm-chip is-idea" disabled={busy} onClick={() => void send({ body: idea.body, sticker: idea.sticker })}>
                Send “{idea.body}” with a {STICKER_INFO[idea.sticker].label.toLowerCase()} sticker
              </button>
            </div>
          </div>
        )}
        <div className="fm-chips" role="group" aria-label="Quick encouragements">
          {ENCOURAGEMENTS.map((e) => (
            <button key={e} type="button" className="fm-chip" disabled={busy} onClick={() => void send({ body: e })}>
              {e}
            </button>
          ))}
        </div>
        <div className="fm-tray" role="group" aria-label="Kix stickers">
          {STICKERS.map((s) => (
            <button key={s} type="button" className="fm-sticker" disabled={busy} onClick={() => void send({ sticker: s })} aria-label={`Send the ${STICKER_INFO[s].label} sticker`}>
              <KixSticker sticker={s} size={64} still />
            </button>
          ))}
        </div>
        <form
          className="fm-write"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void send({ body: text.trim() });
          }}
        >
          <label className="fm-sr" htmlFor="fm-text">
            Message to {kid.nickname}
          </label>
          <input id="fm-text" value={text} maxLength={300} placeholder={`Write to ${kid.nickname}…`} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="mk-btn mk-btn--primary" disabled={busy || !text.trim()}>
            Send
          </button>
        </form>
        <button type="button" className="fm-refresh" onClick={() => setVersion((v) => v + 1)}>
          Check for replies
        </button>
      </section>
    </div>
  );
}
