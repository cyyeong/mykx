"use client";

// The ghost-hands keyboard (GAMES.md §3), ported from the arcade boards (docs/design/canvas-src/keyboard.js).
// Keys are tinted by the finger that owns them and carry its number (1–10 left to right, thumbs 5 and 6); two
// see-through hands rest on the home row and the right finger reaches for the next key, with a caption. Taps on
// the keys type too, for touch screens. Hands: on, fade or off (training wheels).
import type { CSSProperties } from "react";
import "./keyboard.css";

export type HandsMode = "on" | "fade" | "off";

const ROWS = ["qwertyuiop", "asdfghjkl;", "zxcvbnm,./"];
const OFF = [0, 0.25, 0.75];
const FINGER: Record<string, string> = { q: "lp", a: "lp", z: "lp", w: "lr", s: "lr", x: "lr", e: "lm", d: "lm", c: "lm", r: "li", f: "li", v: "li", t: "li", g: "li", b: "li", y: "ri", h: "ri", n: "ri", u: "ri", j: "ri", m: "ri", i: "rm", k: "rm", ",": "rm", o: "rr", l: "rr", ".": "rr", p: "rp", ";": "rp", "/": "rp", " ": "th" };
const HOME: Record<string, string> = { lp: "a", lr: "s", lm: "d", li: "f", ri: "j", rm: "k", rr: "l", rp: ";" };
const NUM: Record<string, number> = { lp: 1, lr: 2, lm: 3, li: 4, ri: 7, rm: 8, rr: 9, rp: 10 };
const NAME: Record<string, string> = { lp: "Left pinky", lr: "Left ring", lm: "Left middle", li: "Left pointer", ri: "Right pointer", rm: "Right middle", rr: "Right ring", rp: "Right pinky", th: "Thumb" };
const TINT: Record<string, string> = { lp: "255, 159, 196", rp: "255, 159, 196", lr: "255, 201, 138", rr: "255, 201, 138", lm: "168, 240, 212", rm: "168, 240, 212", li: "185, 167, 245", ri: "185, 167, 245", th: "255, 227, 138" };
const SPLAY: Record<string, number> = { lp: -9, lr: -4, lm: 0, li: 4, ri: -4, rm: 0, rr: 4, rp: 9 };
const LEN: Record<string, number> = { lp: 2, lr: 2.3, lm: 2.45, li: 2.35, ri: 2.35, rm: 2.45, rr: 2.3, rp: 2 };

const at = (k: string) => {
  if (k === " ") return { x: 5.75, y: 3.5 };
  for (let r = 0; r < 3; r++) {
    const c = ROWS[r].indexOf(k);
    if (c > -1) return { x: OFF[r] + c + 0.5, y: r + 0.5 };
  }
  return null;
};
const u = (n: number) => `calc(var(--u) * ${n.toFixed(3)})`;

export function GhostKeyboard({ nextKey, wrongKey, hands, onKey }: { nextKey: string | null; wrongKey: string | null; hands: HandsMode; onKey: (k: string) => void }) {
  const next = nextKey ? nextKey.toLowerCase() : "";
  const active = FINGER[next] ?? null;
  const hintNums = !active ? [] : active === "th" ? [5, 6] : [NUM[active]];
  return (
    <div className="kb" data-hands={hands}>
      <p className="kb-hint" aria-live="polite">
        {hintNums.map((n) => (
          <b key={n} className="kb-hint-n" style={{ "--f": TINT[active!] } as CSSProperties}>
            {n}
          </b>
        ))}
        {active ? `${NAME[active]} → ${next === " " ? "space" : next.toUpperCase()}` : ""}
      </p>
      <div className="kb-board" role="group" aria-label="Keyboard: tap a key or use your own keyboard">
        {ROWS.flatMap((row, r) =>
          row.split("").map((k, c) => {
            const f = FINGER[k];
            const cls = "kb-key" + (k === next ? " kb-key--next" : "") + (k === wrongKey ? " kb-key--wrong" : "") + (k === "f" || k === "j" ? " kb-key--bump" : "");
            return (
              <button
                key={k}
                className={cls}
                type="button"
                tabIndex={-1}
                style={{ left: u(OFF[r] + c + 0.05), top: u(r + 0.05), "--f": TINT[f] } as CSSProperties}
                aria-label={`${k === ";" ? "semicolon" : k.toUpperCase()}, finger ${NUM[f]}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onKey(k);
                }}
              >
                {k === ";" ? ";" : k.toUpperCase()}
                <i className="kb-kn" aria-hidden="true">
                  {NUM[f]}
                </i>
              </button>
            );
          }),
        )}
        <button
          className={"kb-key kb-key--space" + (next === " " ? " kb-key--next" : "")}
          type="button"
          tabIndex={-1}
          style={{ left: u(3), top: u(3.05), width: u(5.5), "--f": TINT.th } as CSSProperties}
          aria-label="space, thumb 5 or 6"
          onPointerDown={(e) => {
            e.preventDefault();
            onKey(" ");
          }}
        >
          space
        </button>
        <div className="kb-hands" data-mode={hands} aria-hidden="true">
          <span className="kb-palm" style={{ left: "calc(var(--u) * .3)" }} />
          <span className="kb-palm kb-palm--r" style={{ left: "calc(var(--u) * 6.25)" }} />
          {Object.keys(HOME).map((f) => {
            const h = at(HOME[f])!;
            const t = active === f ? at(next)! : h;
            return (
              <span
                key={f}
                className={"kb-finger" + (active === f ? " kb-finger--on" : "")}
                style={{ left: u(h.x - 0.32), top: u(h.y + 0.1), "--len": u(LEN[f]), "--rot": `${SPLAY[f]}deg`, transform: `translate(${u(t.x - h.x)}, ${u(t.y - h.y)}) rotate(${SPLAY[f]}deg)`, "--f": TINT[f] } as CSSProperties}
              >
                <b className="kb-num">{NUM[f]}</b>
              </span>
            );
          })}
          {[
            { n: 5, left: 3.65, rot: 24 },
            { n: 6, left: 7.15, rot: -24 },
          ].map((t) => (
            <span key={t.n} className={"kb-thumb" + (active === "th" ? " kb-finger--on" : "")} style={{ left: u(t.left), top: u(3.1), "--rot": `${t.rot}deg`, transform: `rotate(${t.rot}deg)`, "--f": TINT.th } as CSSProperties}>
              <b className="kb-num">{t.n}</b>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
