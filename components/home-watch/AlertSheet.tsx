"use client";

// One Home watch alert (board HomeNow, the sheet): the frames the rules flagged (the last one outlined by SAM 3.1), what
// Muse Spark said, why it's a note, and "Was Muse right?". A native dialog, so focus and Escape just work. The frames
// are kept 24 hours and then deleted; the note stays. "Not right" makes that camera's rule need one more match.
import { useEffect, useRef } from "react";
import { clock } from "@/components/location/types";
import type { HomeAlert } from "@/lib/home-watch/home-watch";
import { KIND_TITLE, KIND_WHY } from "./types";

export function AlertSheet({ alert, room, onClose, onVerdict, onMessage, busy }: { alert: (HomeAlert & { frames: string[] }) | null; room: string; onClose: () => void; onVerdict: (id: string, v: "right" | "not-right" | null) => void; onMessage: () => void; busy: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (alert && !d.open) d.showModal();
    if (!alert && d.open) d.close();
  }, [alert]);
  if (!alert) return <dialog ref={ref} className="hn-dialog" onClose={onClose} aria-label="Alert" />;
  const title = alert.reason.trim() || `Possibly ${KIND_TITLE[alert.kind] ?? "something to check"}`;
  const v = alert.verdict;
  return (
    <dialog ref={ref} className="hn-dialog" onClose={onClose} aria-labelledby="hn-alert-h" onClick={(e) => e.target === ref.current && onClose()}>
      <div className="hn-sheet">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <p className="lvl">
              {alert.level === "urgent" ? "Urgent" : "Watch"} · {room} · {clock(alert.at)}
            </p>
            <h2 id="hn-alert-h">{title}</h2>
          </div>
          <button type="button" className="mk-btn mk-btn--secondary" onClick={onClose} aria-label="Close" style={{ flex: "none", width: 44, height: 44, padding: 0, borderRadius: "50%", fontSize: 22 }}>
            ×
          </button>
        </div>
        {alert.frames.length > 0 ? (
          <>
            <div className="hn-frames">
              {alert.frames.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt={`Frame ${i + 1} of ${alert.frames.length} from the ${room} camera${i === alert.frames.length - 1 ? ", with the children outlined" : ""}`} />
              ))}
            </div>
            <p className="hn-note" style={{ marginTop: -6 }}>
              The last frame is outlined by SAM 3.1: a different colour for each child.
            </p>
          </>
        ) : (
          <p className="hn-note">The pictures were deleted after 24 hours. The note stays.</p>
        )}
        <p style={{ margin: 0, fontSize: 15, lineHeight: "22px" }}>
          {KIND_WHY[alert.kind] ?? "Muse Spark flagged this for a look."}
        </p>
        <p className="hn-note">Muse Spark’s confidence: {Math.round(alert.confidence * 100)}%. It can be wrong; that’s why you check.</p>
        {alert.level === "urgent" && <p className="hn-call">If someone is hurt, call 995 for an ambulance. For the police, call 999.</p>}
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>Was Muse right?</p>
          <div className="hn-verdict" role="group" aria-label="Was Muse right?">
            <button type="button" className="mk-btn mk-btn--secondary" aria-pressed={v === "right"} disabled={busy} onClick={() => onVerdict(alert.id, v === "right" ? null : "right")}>
              Right
            </button>
            <button type="button" className="mk-btn mk-btn--secondary" aria-pressed={v === "not-right"} disabled={busy} onClick={() => onVerdict(alert.id, v === "not-right" ? null : "not-right")}>
              Not right
            </button>
          </div>
          {v === "not-right" && <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: "20px" }}>Thanks. This camera now needs one more matching check before a note like this, for two weeks.</p>}
          {v === "right" && <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: "20px" }}>Thanks. Nothing changes; the note stays in today’s list.</p>}
        </div>
        <button type="button" className="mk-btn mk-btn--primary" onClick={onMessage}>
          Message them
        </button>
        <p className="hn-note">
          {alert.frames.length > 0 && alert.framesExpireAt ? `These frames are deleted at ${clock(alert.framesExpireAt)} tomorrow. ` : ""}
          Muse Spark reads a picture and then it’s gone, except the ones behind a note. Kix never sees any of this.
        </p>
      </div>
    </dialog>
  );
}
