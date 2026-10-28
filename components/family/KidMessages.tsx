"use client";

// The kid's messages with their grown-ups (PARENT_INSIGHTS §3): big animated Kix stickers, quick replies, words, or
// hold-to-talk (only the transcript is sent; the audio is never kept, rule 9). Kix and every language model never
// read these (rule 12). If the words carry distress, the helplines show (a fixed card, no model).
import { useEffect, useRef, useState } from "react";
import { api } from "@/components/account/api";
import { useSound } from "@/components/sound/SoundProvider";
import { TalkButton } from "@/components/voice/TalkButton";
import { QUICK_REPLIES, STICKERS, STICKER_INFO, type FamilyMessage, type Sticker } from "@/lib/family/messages";
import { KixSticker } from "./KixSticker";
import styles from "./kidMessages.module.css";

type GrownUp = { id: string; name: string; thread: FamilyMessage[]; unread: number };
type Reply = { me: string; grownUps: GrownUp[] };
type Helpline = { name: string; number: string; note: string };

export function KidMessages({ nickname }: { nickname: string }) {
  const { play } = useSound();
  const [data, setData] = useState<Reply | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [byVoice, setByVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState<Helpline[] | null>(null);
  const [failed, setFailed] = useState(false);
  const end = useRef<HTMLLIElement>(null);

  useEffect(() => {
    let live = true;
    void api<Reply>("GET", "/api/messages/mine").then((r) => {
      if (!live) return;
      if (!r.ok || !r.data) return setFailed(true);
      setData(r.data);
      const unread = r.data.grownUps.flatMap((g) => g.thread.filter((m) => m.to === r.data!.me && !m.readAt).map((m) => m.id));
      if (unread.length) void api("PATCH", "/api/messages/mine", { read: unread });
    });
    return () => {
      live = false;
    };
  }, []);

  const grownUp = data?.grownUps.find((g) => g.id === who) ?? data?.grownUps.find((g) => g.unread > 0) ?? data?.grownUps[0] ?? null;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [grownUp?.thread.length, grownUp?.id]);

  const send = async (m: { body?: string; sticker?: Sticker; byVoice?: boolean }) => {
    if (!grownUp) return;
    setBusy(true);
    const r = await api<{ message: FamilyMessage; helplines: Helpline[] | null }>("POST", "/api/messages/mine", { to: grownUp.id, message: m });
    setBusy(false);
    if (!r.ok || !r.data) return;
    play(m.sticker ? "reward" : "tap");
    setHelp(r.data.helplines);
    setData((d) => (d ? { ...d, grownUps: d.grownUps.map((g) => (g.id === grownUp.id ? { ...g, thread: [...g.thread, r.data!.message], unread: 0 } : g)) } : d));
    if (m.body && m.body === text.trim()) {
      setText("");
      setByVoice(false);
    }
  };

  return (
    <main className={styles.page} data-theme="terrarium" data-band="junior">
      <section className={styles.threadPane} aria-label="Messages">
        <header className={styles.head}>
          <h1 className={styles.title}>Messages</h1>
          <p className={styles.lede}>Just you and your grown-ups. Kix doesn&apos;t read these.</p>
        </header>
        {data && data.grownUps.length > 1 && (
          <div className={styles.who} role="group" aria-label="Who to talk to">
            {data.grownUps.map((g) => (
              <button key={g.id} type="button" className={styles.whoBtn} aria-pressed={g.id === grownUp?.id} onClick={() => setWho(g.id)}>
                {g.name}
                {g.unread > 0 && <span className={styles.badge}>{g.unread}</span>}
              </button>
            ))}
          </div>
        )}
        {failed ? (
          <p className={styles.lede}>Couldn&apos;t load your messages. Try again in a moment.</p>
        ) : !data ? (
          <p className={styles.lede}>Opening your messages…</p>
        ) : !grownUp ? (
          <p className={styles.lede}>No grown-ups to message yet.</p>
        ) : grownUp.thread.length === 0 ? (
          <div className={styles.empty}>
            <KixSticker sticker="party" size={150} />
            <p className={styles.emptyText}>Nothing here yet. Send {grownUp.name} a sticker!</p>
          </div>
        ) : (
          <ol className={styles.list} aria-live="polite">
            {grownUp.thread.map((m) => {
              const mine = m.from === data.me;
              return (
                <li key={m.id} className={mine ? `${styles.msg} ${styles.mine}` : styles.msg}>
                  {m.sticker && <KixSticker sticker={m.sticker} size={mine ? 104 : 136} />}
                  {m.body && <p className={styles.bubble}>{m.body}</p>}
                  <span className={styles.meta}>{mine ? (m.byVoice ? "You said" : "You") : grownUp.name}</span>
                </li>
              );
            })}
            <li ref={end} aria-hidden="true" />
          </ol>
        )}
      </section>

      <section className={styles.replyPane} aria-label={grownUp ? `Reply to ${grownUp.name}` : "Reply"}>
        <h2 className={styles.h2}>{grownUp ? `Reply to ${grownUp.name}` : "Reply"}</h2>
        {help && (
          <div className={styles.help} role="status">
            <p className={styles.helpTitle}>{nickname}, if something feels too big, you can talk to someone right now:</p>
            {help.map((h) => (
              <p key={h.name} className={styles.helpLine}>
                <strong>{h.name}</strong> {h.number} <span>({h.note})</span>
              </p>
            ))}
          </div>
        )}
        <div className={styles.quick} role="group" aria-label="Quick replies">
          {QUICK_REPLIES.map((q) => (
            <button key={q} type="button" className={styles.chip} disabled={busy || !grownUp} onClick={() => void send({ body: q })}>
              {q}
            </button>
          ))}
        </div>
        <div className={styles.tray} role="group" aria-label="Send a Kix sticker">
          {STICKERS.map((s) => (
            <button key={s} type="button" className={styles.trayBtn} disabled={busy || !grownUp} onClick={() => void send({ sticker: s })} aria-label={`Send the ${STICKER_INFO[s].label} sticker`}>
              <KixSticker sticker={s} size={72} still />
            </button>
          ))}
        </div>
        <form
          className={styles.write}
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void send({ body: text.trim(), byVoice });
          }}
        >
          <label className={styles.sr} htmlFor="km-text">
            Your message
          </label>
          <input
            id="km-text"
            value={text}
            maxLength={300}
            placeholder="Write a message…"
            onChange={(e) => {
              setText(e.target.value);
              setByVoice(false);
            }}
          />
          <button type="submit" className="mk-btn mk-btn--primary" disabled={busy || !text.trim() || !grownUp}>
            Send
          </button>
        </form>
        <div className={styles.talk}>
          <TalkButton
            onTranscript={(t) => {
              setText(t.slice(0, 300));
              setByVoice(true);
            }}
          />
        </div>
      </section>
    </main>
  );
}
