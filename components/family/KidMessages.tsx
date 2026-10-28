"use client";

// The kid's messages with their grown-ups (design board KidMessage; PARENT_INSIGHTS §3). Kix stands beside the
// newest message and reads it aloud on request (the device's voice); the message shows as a big card with its
// animated Kix sticker; replies are quick replies, stickers, words or hold-to-talk (only the transcript is sent, the
// audio is never kept, rule 9). Kix and every language model never read these (rule 12): Kix's line here is fixed
// copy. If the words carry distress, the helplines show (a fixed card, no model).
import { useEffect, useRef, useState } from "react";
import { api } from "@/components/account/api";
import { KixHero } from "@/components/scene/KixHero";
import { useSound } from "@/components/sound/SoundProvider";
import { KixBubble } from "@/components/ui/KixBubble";
import { TalkButton } from "@/components/voice/TalkButton";
import { useKixVoice } from "@/components/voice/useKixVoice";
import {
  QUICK_REPLIES,
  STICKERS,
  STICKER_INFO,
  type FamilyMessage,
  type Sticker,
} from "@/lib/family/messages";
import { KixSticker } from "./KixSticker";
import styles from "./kidMessages.module.css";

type GrownUp = {
  id: string;
  name: string;
  thread: FamilyMessage[];
  unread: number;
};
type Reply = { me: string; grownUps: GrownUp[] };
type Helpline = { name: string; number: string; note: string };

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-SG", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Singapore",
  });
const saying = (name: string, m: FamilyMessage) =>
  [
    m.body ? `${name} says: ${m.body}` : null,
    m.sticker
      ? `${m.body ? "And a" : `${name} sent you a`} ${STICKER_INFO[m.sticker].label} sticker.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

export function KidMessages({ nickname }: { nickname: string }) {
  const { play } = useSound();
  const { speak, speaking, supported } = useKixVoice("junior");
  const [data, setData] = useState<Reply | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [byVoice, setByVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [help, setHelp] = useState<Helpline[] | null>(null);
  const [failed, setFailed] = useState(false);
  const top = useRef<HTMLElement>(null);

  useEffect(() => {
    let live = true;
    void api<Reply>("GET", "/api/messages/mine").then((r) => {
      if (!live) return;
      if (!r.ok || !r.data) return setFailed(true);
      setData(r.data);
      const unread = r.data.grownUps.flatMap((g) =>
        g.thread
          .filter((m) => m.to === r.data!.me && !m.readAt)
          .map((m) => m.id),
      );
      if (unread.length)
        void api("PATCH", "/api/messages/mine", { read: unread });
    });
    return () => {
      live = false;
    };
  }, []);

  const grownUp =
    data?.grownUps.find((g) => g.id === who) ??
    data?.grownUps.find((g) => g.unread > 0) ??
    data?.grownUps[0] ??
    null;
  const theirs = grownUp?.thread.filter((m) => m.from === grownUp.id) ?? [];
  const newest = theirs[theirs.length - 1] ?? null;
  const earlier =
    grownUp?.thread.filter((m) => m.id !== newest?.id).reverse() ?? [];
  const kixLine = !grownUp
    ? `Hi ${nickname}! Messages from your grown-ups land here.`
    : sent
      ? `Sent! ${grownUp.name} will see it soon.`
      : newest
        ? `${grownUp.name} sent you a message!`
        : `Send ${grownUp.name} a sticker?`;

  const send = async (m: {
    body?: string;
    sticker?: Sticker;
    byVoice?: boolean;
  }) => {
    if (!grownUp) return;
    setBusy(true);
    const r = await api<{
      message: FamilyMessage;
      helplines: Helpline[] | null;
    }>("POST", "/api/messages/mine", { to: grownUp.id, message: m });
    setBusy(false);
    if (!r.ok || !r.data) return;
    play(m.sticker ? "reward" : "tap");
    setHelp(r.data.helplines);
    setSent(true);
    setData((d) =>
      d
        ? {
            ...d,
            grownUps: d.grownUps.map((g) =>
              g.id === grownUp.id
                ? { ...g, thread: [...g.thread, r.data!.message], unread: 0 }
                : g,
            ),
          }
        : d,
    );
    if (m.body && m.body === text.trim()) {
      setText("");
      setByVoice(false);
    }
  };

  return (
    <main className={styles.page} data-theme="terrarium" data-band="junior">
      <section className={styles.kixPane} aria-label="Kix">
        <h1 className={styles.title}>Messages</h1>
        <KixBubble raised className={styles.kixSays}>
          <span className={styles.says}>
            <span>{kixLine}</span>
            {newest && supported && (
              <button
                type="button"
                className={styles.listen}
                aria-pressed={speaking}
                onClick={() => speak(saying(grownUp!.name, newest))}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
                </svg>
                {speaking ? "Reading…" : "Read it to me"}
              </button>
            )}
          </span>
        </KixBubble>
        <KixHero
          pack="terrarium"
          base="/art/kix/terrarium"
          alt="Kix the explorer"
          className={styles.kix}
          sizes="(max-width: 599px) 160px, 300px"
        />
        {data && data.grownUps.length > 1 && (
          <div className={styles.who} role="group" aria-label="Who to talk to">
            {data.grownUps.map((g) => (
              <button
                key={g.id}
                type="button"
                className={styles.whoBtn}
                aria-pressed={g.id === grownUp?.id}
                onClick={() => {
                  setWho(g.id);
                  setSent(false);
                }}
              >
                {g.name}
                {g.unread > 0 && (
                  <span className={styles.badge}>{g.unread}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      <section
        className={styles.panel}
        aria-label={grownUp ? `Messages with ${grownUp.name}` : "Messages"}
        ref={top}
      >
        {failed ? (
          <p className={styles.lede}>
            Couldn&apos;t load your messages. Try again in a moment.
          </p>
        ) : !data ? (
          <p className={styles.lede}>Opening your messages…</p>
        ) : !grownUp ? (
          <p className={styles.lede}>No grown-ups to message yet.</p>
        ) : (
          <>
            {newest ? (
              <article
                className={styles.newest}
                aria-label={`Newest message from ${grownUp.name}`}
              >
                <div className={styles.newestText}>
                  <p className={styles.from}>
                    <span className={styles.fromBadge}>
                      From {grownUp.name}
                    </span>
                    <span className={styles.when}>{when(newest.at)}</span>
                  </p>
                  <p className={styles.newestBody}>
                    {newest.body ?? STICKER_INFO[newest.sticker!].label}
                  </p>
                </div>
                {newest.sticker && (
                  <span className={styles.newestSticker}>
                    <KixSticker
                      sticker={newest.sticker}
                      size={132}
                      label={false}
                    />
                  </span>
                )}
              </article>
            ) : (
              <div className={styles.empty}>
                <KixSticker sticker="party" size={120} label={false} />
                <p className={styles.emptyText}>
                  No messages from {grownUp.name} yet. Send one first!
                </p>
              </div>
            )}

            <div className={styles.replyHead}>
              <h2 className={styles.h2}>Reply to {grownUp.name}</h2>
              <span className={styles.private}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                Only you and {grownUp.name} can read this.
              </span>
            </div>
            {help && (
              <div className={styles.help} role="status">
                <p className={styles.helpTitle}>
                  {nickname}, if something feels too big, you can talk to
                  someone right now:
                </p>
                {help.map((h) => (
                  <p key={h.name} className={styles.helpLine}>
                    <strong>{h.name}</strong> {h.number} <span>({h.note})</span>
                  </p>
                ))}
              </div>
            )}
            <div
              className={styles.quick}
              role="group"
              aria-label="Quick replies"
            >
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={styles.chip}
                  disabled={busy}
                  onClick={() => void send({ body: q })}
                >
                  {q}
                </button>
              ))}
            </div>
            <div
              className={styles.tray}
              role="group"
              aria-label="Send a Kix sticker"
            >
              {STICKERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.trayBtn}
                  disabled={busy}
                  onClick={() => void send({ sticker: s })}
                  aria-label={`Send the ${STICKER_INFO[s].label} sticker`}
                >
                  <KixSticker sticker={s} size={68} still />
                </button>
              ))}
            </div>
            <div className={styles.compose}>
              <TalkButton
                onTranscript={(t) => {
                  setText(t.slice(0, 300));
                  setByVoice(true);
                }}
              />
              <form
                className={styles.write}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim()) void send({ body: text.trim(), byVoice });
                }}
              >
                <label className={styles.sr} htmlFor="km-text">
                  Your message to {grownUp.name}
                </label>
                <input
                  id="km-text"
                  value={text}
                  maxLength={300}
                  placeholder="Or type here…"
                  onChange={(e) => {
                    setText(e.target.value);
                    setByVoice(false);
                  }}
                />
                <button
                  type="submit"
                  className="mk-btn mk-btn--primary"
                  disabled={busy || !text.trim()}
                >
                  Send
                </button>
              </form>
            </div>

            {earlier.length > 0 && (
              <>
                <h2 className={styles.h3}>Earlier</h2>
                <ol className={styles.list}>
                  {earlier.map((m) => {
                    const mine = m.from === data.me;
                    return (
                      <li
                        key={m.id}
                        className={
                          mine ? `${styles.msg} ${styles.mine}` : styles.msg
                        }
                      >
                        {m.sticker && (
                          <KixSticker
                            sticker={m.sticker}
                            size={76}
                            still
                            label={false}
                          />
                        )}
                        {m.body && <p className={styles.bubble}>{m.body}</p>}
                        <span className={styles.meta}>
                          {mine
                            ? m.byVoice
                              ? "You said"
                              : "You"
                            : grownUp.name}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
