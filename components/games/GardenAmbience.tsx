"use client";

// Word Garden's living terrarium (docs/design/canvas-src/ambience-garden.html): swaying sun rays, low mist, dust in
// the light, fireflies, drops sliding down the glass and a falling leaf. heat 0–3 follows the blooms (brighter
// rays, more fireflies), pulse "a"/"b" replays the bloom on each flower, and the pond and the fern play their next
// reaction on each tap: never random.
import { useState, type CSSProperties } from "react";
import "./ambience.css";

const ACTS = { pond: ["ripple", "bubbles", "double", "plip"], fern: ["spores", "dew", "fireflies"] } as const;
type Spot = keyof typeof ACTS;
const v = (o: Record<string, string>) => o as CSSProperties;

export function GardenAmbience({ heat = 0, pulse = "" }: { heat?: number; pulse?: string }) {
  const [show, setShow] = useState<{ spot: Spot | ""; act: string; n: Record<Spot, number> }>({ spot: "", act: "", n: { pond: 0, fern: 0 } });
  const tap = (spot: Spot) =>
    setShow((s) => {
      const n = s.n[spot];
      return { spot, act: ACTS[spot][n % ACTS[spot].length], n: { ...s.n, [spot]: n + 1 } };
    });
  const act = (spot: Spot) => (show.spot === spot ? show.act : "");
  return (
    <div className="am am--garden" data-heat={String(heat)} data-pulse={pulse} data-show={show.spot ? `${show.spot}-${show.act}` : ""} aria-hidden="true">
      <div className="am-rays">
        {[
          ["4%", "9%", "12s", "-3s"],
          ["16%", "6%", "9s", "-7s"],
          ["27%", "11%", "14s", "-1s"],
          ["42%", "5%", "10s", "-5s"],
        ].map(([x, w, d, dl]) => (
          <i key={x} className="am-ray" style={v({ "--x": x, "--w": w, "--d": d, "--dl": dl })} />
        ))}
      </div>
      <i className="am-fog" style={v({ "--c": "246, 252, 240", "--y": "62%", "--h": "42%", "--d": "85s", "--o": ".5" })} />
      <i className="am-fog am-fog--r" style={v({ "--c": "214, 236, 200", "--y": "74%", "--h": "34%", "--d": "115s", "--o": ".38" })} />
      {[
        ["58%", "18%", "3px", "9s", "-2s", "22px"],
        ["70%", "30%", "2px", "12s", "-6s", "-18px"],
        ["80%", "12%", "2px", "10s", "-4s", "16px"],
        ["64%", "40%", "3px", "14s", "-9s", "-24px"],
        ["88%", "26%", "2px", "11s", "-1s", "20px"],
        ["48%", "22%", "2px", "13s", "-7s", "-14px"],
      ].map(([x, y, s, d, dl, dx]) => (
        <i key={x + y} className="am-mote am-mote--float" style={v({ "--x": x, "--y": y, "--s": s, "--c": "255, 236, 170", "--d": d, "--dl": dl, "--dx": dx })} />
      ))}
      {[
        ["8%", "56%", "9s", "-2s", "26px", ""],
        ["22%", "70%", "12s", "-5s", "-20px", ""],
        ["38%", "62%", "10s", "-8s", "18px", ""],
        ["60%", "78%", "11s", "-3s", "-24px", ""],
        ["84%", "64%", "13s", "-6s", "20px", ""],
        ["30%", "44%", "12s", "-9s", "22px", " am-mote--hot"],
        ["72%", "52%", "10s", "-1s", "-18px", " am-mote--hot"],
        ["50%", "84%", "14s", "-4s", "16px", " am-mote--hot"],
      ].map(([x, y, d, dl, dx, hot]) => (
        <i key={x + y} className={`am-fly${hot}`} style={v({ "--x": x, "--y": y, "--d": d, "--dl": dl, "--dx": dx })} />
      ))}
      <i className="am-drip" style={v({ "--x": "3%", "--d": "17s", "--dl": "3s" })} />
      <i className="am-drip" style={v({ "--x": "96%", "--d": "23s", "--dl": "11s", "--trail": ".7" })} />
      <i className="am-leaf" style={v({ "--x": "30%", "--d": "24s", "--dl": "6s" })} />
      <i className="am-bloom" style={v({ "--c": "255, 236, 170", "--bx": "50%", "--by": "40%" })} />
      <span className="am-poke am-poke--pond" data-act={act("pond")} onClick={() => tap("pond")} style={{ left: "58%", top: "50%", width: "28%", height: "18%" }}>
        <i className="am-r am-r1" />
        <i className="am-r am-r2" />
        <i className="am-r am-r3" />
      </span>
      <span className="am-poke am-poke--fern" data-act={act("fern")} onClick={() => tap("fern")} style={{ left: 0, top: "18%", width: "20%", height: "40%" }}>
        <i className="am-r am-r1" style={v({ "--tx": "180%", "--ty": "-320%" })} />
        <i className="am-r am-r2" style={v({ "--tx": "320%", "--ty": "-160%" })} />
        <i className="am-r am-r3" style={v({ "--tx": "240%", "--ty": "-480%" })} />
      </span>
    </div>
  );
}
