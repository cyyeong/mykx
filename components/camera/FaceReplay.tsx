"use client";

// The face-free replay of a focus note (parent side): the face-mesh points the device kept around each counted
// moment, drawn as lines (face outline, eyes, brows, lips, irises), never a picture. Mirrored like a selfie. Plays
// on its own (or step through with the slider); under reduced motion it waits for the slider.
import { useEffect, useMemo, useRef, useState } from "react";
import { CLIP_LABEL, CLOSED, MESH, partPoints, type MeshPart, type NoteReplay, type ReplayClip } from "@/lib/signals/replay";
import s from "./replay.module.css";

const COLOUR: Partial<Record<MeshPart, string>> = { oval: "#a8f0d4", leftEye: "#b9a7f5", rightEye: "#b9a7f5", leftBrow: "#c6bfee", rightBrow: "#c6bfee", lipsOuter: "#ffc9a8", lipsInner: "#ffc9a8" };

/** Draws one frame of points into the canvas, fitted to `box` (the clip's face area) and mirrored. */
export function drawMesh(ctx: CanvasRenderingContext2D, p: readonly number[] | null, box: { x: number; y: number; size: number }, w: number, h: number, mirror = true) {
  ctx.clearRect(0, 0, w, h);
  if (!p) {
    ctx.fillStyle = "#c6bfee";
    ctx.font = "600 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No face in view", w / 2, h / 2);
    return;
  }
  const fit = (x: number, y: number): [number, number] => {
    const u = (x - box.x) / box.size;
    const v = (y - box.y) / box.size;
    return [(mirror ? 1 - u : u) * w, v * h];
  };
  ctx.lineWidth = Math.max(1.5, w / 160);
  ctx.lineJoin = "round";
  for (const part of Object.keys(MESH) as MeshPart[]) {
    const pts = partPoints(p, part).map(([x, y]) => fit(x, y));
    if (part === "irises") {
      ctx.fillStyle = "#ffe38a";
      for (const [x, y] of pts) {
        ctx.beginPath();
        ctx.arc(x, y, w / 70, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    ctx.strokeStyle = COLOUR[part] ?? "#ffffff";
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (CLOSED.includes(part)) ctx.closePath();
    ctx.stroke();
  }
}

/** The square around the face across the clip, with a margin, in 0–1 coordinates. */
function clipBox(clip: ReplayClip) {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const f of clip.frames) {
    if (!f.p) continue;
    for (const [x, y] of partPoints(f.p, "oval")) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  const size = Math.max(maxX - minX, maxY - minY, 0.05) * 1.25;
  return { x: (minX + maxX) / 2 - size / 2, y: (minY + maxY) / 2 - size / 2, size };
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "Asia/Singapore" });

export function FaceReplay({ replay }: { replay: NoteReplay }) {
  const [clipIx, setClipIx] = useState(0);
  const [frame, setFrame] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const clip = replay.clips[Math.min(clipIx, replay.clips.length - 1)];
  const box = useMemo(() => clipBox(clip), [clip]);

  // Plays the clip at its recorded pace, pausing a moment between loops.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      setFrame(i);
      const next = clip.frames[i + 1];
      const wait = next ? next.t - clip.frames[i].t : 900;
      i = next ? i + 1 : 0;
      timer = setTimeout(step, Math.max(120, wait));
    };
    step();
    return () => clearTimeout(timer);
  }, [clip]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = c.clientWidth || 280;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawMesh(ctx, clip.frames[Math.min(frame, clip.frames.length - 1)]?.p ?? null, box, size, size);
  }, [clip, frame, box]);

  return (
    <div className={s.box}>
      <div className={s.row} role="group" aria-label="Moments in this note">
        {replay.clips.map((c, i) => (
          <button
            key={c.at}
            type="button"
            className={s.tab}
            aria-pressed={i === clipIx}
            onClick={() => {
              setClipIx(i);
              setFrame(0);
            }}
          >
            {CLIP_LABEL[c.kind]} · {time(c.at)}
          </button>
        ))}
      </div>
      <div className={s.stage}>
        <canvas ref={canvas} role="img" aria-label={`Line drawing of the face during: ${CLIP_LABEL[clip.kind]}`} />
      </div>
      <input
        className={s.scrub}
        type="range"
        min={0}
        max={clip.frames.length - 1}
        value={Math.min(frame, clip.frames.length - 1)}
        onChange={(e) => setFrame(Number(e.target.value))}
        aria-label="Step through the moment"
      />
      <p className={s.muted}>Face-mesh points only, kept on this device for a week. No picture was ever taken or sent.</p>
    </div>
  );
}
