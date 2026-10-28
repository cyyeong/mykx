"use client";

// The living space background of the Arcade and Star Typer (docs/design/canvas-src/ambience-space.html): three star
// layers, drifting fog, shooting stars and motes. heat 0–3 brightens it as the round goes well (warp lines at 2+),
// pulse "a"/"b" flips on every hit so the bloom replays, and two hidden tap spots (the sky, the planet) play their
// next reaction on each tap: no randomness, a different one each time. Reduced motion stills it (ambience.css).
import { useState, type CSSProperties } from "react";
import "./ambience.css";

const ACTS = { sky: ["frog", "shower", "rocket", "crown"], planet: ["moon", "ring", "glint"] } as const;
type Spot = keyof typeof ACTS;

const v = (o: Record<string, string | number>) => o as CSSProperties;

export function SpaceAmbience({ heat = 0, pulse = "", pokes = false }: { heat?: number; pulse?: string; pokes?: boolean }) {
  const [show, setShow] = useState<{ spot: Spot | ""; act: string; n: Record<Spot, number> }>({ spot: "", act: "", n: { sky: 0, planet: 0 } });
  const tap = (spot: Spot) =>
    setShow((s) => {
      const n = s.n[spot];
      return { spot, act: ACTS[spot][n % ACTS[spot].length], n: { ...s.n, [spot]: n + 1 } };
    });
  return (
    <div className="am am--space" data-heat={String(heat)} data-pulse={pulse} data-show={show.spot ? `${show.spot}-${show.act}` : ""} aria-hidden="true">
      <i className="am-stars am-stars--1" />
      <i className="am-stars am-stars--2" />
      <i className="am-stars am-stars--3" />
      <i className="am-fog" style={v({ "--c": "185, 167, 245", "--y": "-8%", "--h": "62%", "--d": "120s", "--o": ".34" })} />
      <i className="am-fog am-fog--r" style={v({ "--c": "247, 182, 207", "--y": "26%", "--h": "52%", "--d": "150s", "--o": ".2" })} />
      <i className="am-fog" style={v({ "--c": "168, 240, 212", "--y": "64%", "--h": "46%", "--d": "95s", "--o": ".16" })} />
      <i className="am-shoot" style={v({ "--x": "82%", "--y": "8%", "--d": "11s", "--dl": "2s" })} />
      <i className="am-shoot" style={v({ "--x": "60%", "--y": "3%", "--d": "17s", "--dl": "8s" })} />
      <i className="am-shoot" style={v({ "--x": "96%", "--y": "30%", "--d": "23s", "--dl": "14s" })} />
      <i className="am-mote am-mote--float" style={v({ "--x": "14%", "--y": "30%", "--s": "3px", "--c": "255, 227, 138", "--d": "14s", "--dl": "-3s", "--dx": "30px" })} />
      <i className="am-mote am-mote--float" style={v({ "--x": "34%", "--y": "58%", "--s": "2px", "--c": "237, 233, 255", "--d": "11s", "--dl": "-7s", "--dx": "-20px" })} />
      <i className="am-mote am-mote--float" style={v({ "--x": "66%", "--y": "22%", "--s": "3px", "--c": "168, 240, 212", "--d": "16s", "--dl": "-1s", "--dx": "24px" })} />
      <i className="am-mote am-mote--float" style={v({ "--x": "86%", "--y": "48%", "--s": "2px", "--c": "255, 227, 138", "--d": "12s", "--dl": "-9s", "--dx": "-28px" })} />
      <i className="am-mote am-mote--float am-mote--hot" style={v({ "--x": "24%", "--y": "74%", "--s": "3px", "--c": "247, 182, 207", "--d": "13s", "--dl": "-4s", "--dx": "18px" })} />
      <i className="am-mote am-mote--float am-mote--hot" style={v({ "--x": "74%", "--y": "66%", "--s": "3px", "--c": "255, 227, 138", "--d": "15s", "--dl": "-11s", "--dx": "-16px" })} />
      <div className="am-warp">
        <i />
        <i style={v({ "--dl": "-.9s" })} />
      </div>
      <div className="am-shower">
        <i style={v({ "--x": "70%", "--y": "6%" })} />
        <i style={v({ "--x": "84%", "--y": "14%", "--dl": ".35s" })} />
        <i style={v({ "--x": "58%", "--y": "2%", "--dl": ".7s" })} />
        <i style={v({ "--x": "92%", "--y": "26%", "--dl": "1s" })} />
      </div>
      <i className="am-bloom" style={v({ "--c": "255, 227, 138", "--bx": "50%", "--by": "70%" })} />
      {pokes && (
        <>
          <span className="am-poke am-poke--sky" data-act={show.spot === "sky" ? show.act : ""} onClick={() => tap("sky")} style={{ left: "4%", top: "16%", width: "26%", height: "34%" }}>
            <svg className="am-cons" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              <g data-k="frog">
                <polyline pathLength={1} points="28,40 34,28 44,34 56,34 66,28 72,40 82,60 68,76 32,76 18,60 28,40" />
                <circle cx="34" cy="28" r="2.2" /><circle cx="66" cy="28" r="2.2" /><circle cx="82" cy="60" r="1.8" /><circle cx="68" cy="76" r="1.8" /><circle cx="32" cy="76" r="1.8" /><circle cx="18" cy="60" r="1.8" />
              </g>
              <g data-k="rocket">
                <polyline pathLength={1} points="50,8 62,32 62,66 74,82 50,74 26,82 38,66 38,32 50,8" />
                <circle cx="50" cy="8" r="2.4" /><circle cx="62" cy="32" r="1.8" /><circle cx="74" cy="82" r="1.8" /><circle cx="26" cy="82" r="1.8" /><circle cx="38" cy="32" r="1.8" /><circle cx="50" cy="46" r="2" />
              </g>
              <g data-k="crown">
                <polyline pathLength={1} points="12,72 20,34 36,56 50,22 64,56 80,34 88,72 12,72" />
                <circle cx="20" cy="34" r="2" /><circle cx="50" cy="22" r="2.4" /><circle cx="80" cy="34" r="2" /><circle cx="12" cy="72" r="1.8" /><circle cx="88" cy="72" r="1.8" />
              </g>
            </svg>
          </span>
          <span className="am-poke am-poke--planet" data-act={show.spot === "planet" ? show.act : ""} onClick={() => tap("planet")} style={{ right: 0, top: 0, width: "20%", height: "24%" }}>
            <i className="am-r am-r1" />
            <i className="am-r am-r2" />
            <i className="am-r am-r3" />
          </span>
        </>
      )}
    </div>
  );
}
