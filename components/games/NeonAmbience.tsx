"use client";

// The neon arena's living background for Neon Strike (docs/design/canvas-src/ambience-neon.html): four sweeping
// spotlights, light running along the grid, a pulsing horizon, drifting fog and rising sparks. heat 0–3 follows the
// combo (brighter spots and floor, then a laser fan), pulse "a"/"b" replays the bloom on every hit, and three
// hidden tap spots (the light rig, the fog machines) play their next reaction on each tap: never random.
import { useState, type CSSProperties } from "react";
import "./ambience.css";

const ACTS = { rig: ["swap", "strobe", "fan", "search"], fogl: ["puff", "ring", "burst"], fogr: ["ring", "burst", "puff"] } as const;
type Spot = keyof typeof ACTS;
const v = (o: Record<string, string>) => o as CSSProperties;

export function NeonAmbience({ heat = 0, pulse = "" }: { heat?: number; pulse?: string }) {
  const [show, setShow] = useState<{ spot: Spot | ""; act: string; n: Record<Spot, number> }>({ spot: "", act: "", n: { rig: 0, fogl: 0, fogr: 0 } });
  const tap = (spot: Spot) =>
    setShow((s) => {
      const n = s.n[spot];
      return { spot, act: ACTS[spot][n % ACTS[spot].length], n: { ...s.n, [spot]: n + 1 } };
    });
  const act = (spot: Spot) => (show.spot === spot ? show.act : "");
  return (
    <div className="am am--neon" data-heat={String(heat)} data-pulse={pulse} data-show={show.spot ? `${show.spot}-${show.act}` : ""} aria-hidden="true">
      <div className="am-spots">
        <i className="am-spot" style={{ left: "14%", ...v({ "--c": "61, 245, 255", "--d": "7s", "--dl": "-2s", "--rs": "-15deg" }) }} />
        <i className="am-spot" style={{ left: "37%", ...v({ "--c": "255, 61, 203", "--d": "9s", "--dl": "-6s", "--rs": "-6deg" }) }} />
        <i className="am-spot" style={{ left: "63%", ...v({ "--c": "201, 184, 255", "--d": "8s", "--dl": "-1s", "--rs": "6deg" }) }} />
        <i className="am-spot" style={{ left: "86%", ...v({ "--c": "61, 245, 255", "--d": "11s", "--dl": "-8s", "--rs": "15deg" }) }} />
      </div>
      <i className="am-fog" style={v({ "--c": "230, 232, 240", "--y": "-12%", "--h": "42%", "--d": "130s", "--o": ".14" })} />
      <i className="am-horizon" />
      <div className="am-lasers">
        <div className="am-fan">
          {[
            ["140deg", "61, 245, 255"],
            ["160deg", "255, 61, 203"],
            ["180deg", "140, 255, 201"],
            ["200deg", "255, 61, 203"],
            ["220deg", "61, 245, 255"],
          ].map(([r, c]) => (
            <i key={r} style={v({ "--r": r, "--c": c })} />
          ))}
        </div>
      </div>
      <i className="am-fog" style={v({ "--c": "201, 184, 255", "--y": "56%", "--h": "48%", "--d": "70s", "--o": ".42" })} />
      <i className="am-fog am-fog--r" style={v({ "--c": "255, 61, 203", "--y": "66%", "--h": "40%", "--d": "96s", "--o": ".2" })} />
      {[
        ["6%", "3px", "61, 245, 255", "9s", "-1s", "20px"],
        ["17%", "2px", "255, 61, 203", "12s", "-6s", "-14px"],
        ["28%", "3px", "201, 184, 255", "10s", "-3s", "18px"],
        ["41%", "2px", "61, 245, 255", "13s", "-9s", "-22px"],
        ["55%", "3px", "255, 61, 203", "11s", "-4s", "16px"],
        ["68%", "2px", "140, 255, 201", "9s", "-7s", "-18px"],
        ["79%", "3px", "61, 245, 255", "12s", "-2s", "22px"],
        ["92%", "2px", "255, 61, 203", "10s", "-8s", "-12px"],
      ].map(([x, s, c, d, dl, dx]) => (
        <i key={x} className="am-mote am-mote--rise" style={v({ "--x": x, "--s": s, "--c": c, "--d": d, "--dl": dl, "--dx": dx })} />
      ))}
      <i className="am-bloom" style={v({ "--c": "61, 245, 255", "--bx": "50%", "--by": "38%" })} />
      <span className="am-poke am-poke--rig" data-act={act("rig")} onClick={() => tap("rig")} style={{ left: "22%", top: 0, width: "56%", height: "14%" }} />
      <span className="am-poke am-poke--fog" data-act={act("fogl")} onClick={() => tap("fogl")} style={{ left: 0, top: "62%", width: "14%", height: "38%" }}>
        <i className="am-r am-r1" />
        <i className="am-r am-r2" />
        <i className="am-r am-r3" />
      </span>
      <span className="am-poke am-poke--fog" data-act={act("fogr")} onClick={() => tap("fogr")} style={{ right: 0, top: "62%", width: "14%", height: "38%" }}>
        <i className="am-r am-r1" />
        <i className="am-r am-r2" />
        <i className="am-r am-r3" />
      </span>
    </div>
  );
}
