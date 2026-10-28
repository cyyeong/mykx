"use client";

// "See what Kix sees" (parent side): the camera on this device, live, with the face-mesh lines Kix reads and the
// three readings it counts (eyes, mouth, head). Nothing is recorded or sent; it stops by itself after 2 minutes.
import { useEffect, useRef, useState } from "react";
import { CAMERA, largestFaceIndex, readFace, type FaceReading } from "@/lib/signals/camera";
import { quantize } from "@/lib/signals/replay";
import { drawMesh } from "./FaceReplay";
import { loadFaceLandmarker } from "./mediapipe";
import s from "./replay.module.css";

const LIMIT_MS = 120_000;

export function LiveCheck({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [reading, setReading] = useState<FaceReading | null>(null);
  const [state, setState] = useState<"starting" | "on" | "failed">("starting");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    (async () => {
      try {
        const landmarker = await loadFaceLandmarker();
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } });
        if (stopped || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play().catch(() => undefined);
        setState("on");
        const tick = () => {
          if (stopped || !video.current || !canvas.current) return;
          if (Date.now() - started > LIMIT_MS) return onClose();
          if (video.current.readyState >= 2) {
            let result;
            try {
              result = landmarker.detectForVideo(video.current, performance.now());
            } catch {
              for (const t of stream?.getTracks() ?? []) t.stop();
              return setState("failed");
            }
            const r = readFace(result);
            setReading(r);
            const i = largestFaceIndex(result.faceLandmarks);
            const p = i >= 0 ? quantize(result.faceLandmarks[i]) : null;
            const c = canvas.current;
            const size = c.clientWidth || 280;
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            if (c.width !== size * dpr) {
              c.width = size * dpr;
              c.height = size * dpr;
            }
            const ctx = c.getContext("2d");
            if (ctx) {
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
              // The video fills the square (object-fit: cover on 4:3), so map the frame's middle square.
              const vw = video.current.videoWidth || 4;
              const vh = video.current.videoHeight || 3;
              const side = Math.min(vw, vh);
              drawMesh(ctx, p, { x: (vw - side) / 2 / vw, y: (vh - side) / 2 / vh, size: side / Math.max(vw, vh) }, size, size);
            }
          }
          timer = setTimeout(tick, 200);
        };
        tick();
      } catch {
        for (const t of stream?.getTracks() ?? []) t.stop();
        if (!stopped) setState("failed");
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      for (const t of stream?.getTracks() ?? []) t.stop();
    };
  }, [onClose]);

  const eyesShut = !!reading && reading.eyesClosed > CAMERA.eyesClosedScore;
  const mouthOpen = !!reading && reading.jawOpen > CAMERA.jawOpenScore;
  const turned = !!reading && (Math.abs(reading.yaw) > CAMERA.yawDeg || Math.abs(reading.pitch) > CAMERA.pitchDeg);
  return (
    <div className={s.box}>
      <div className={s.row} style={{ justifyContent: "space-between" }}>
        <span className={s.live}>Live on this device · nothing is recorded</span>
        <button type="button" className={s.tab} onClick={onClose}>
          Stop
        </button>
      </div>
      <div className={s.stage}>
        <video ref={video} muted playsInline aria-hidden="true" />
        <canvas ref={canvas} role="img" aria-label="The face-mesh lines Kix reads, live" />
      </div>
      {state === "failed" ? (
        <p className={s.muted}>Kix couldn&apos;t read the camera on this device. Check the camera permission, or try a recent Chrome, Edge or Safari.</p>
      ) : (
        <div className={s.reads}>
          <div className={s.read} data-hit={eyesShut}>
            <strong>{reading ? (eyesShut ? "Shut" : "Open") : "—"}</strong>eyes
          </div>
          <div className={s.read} data-hit={mouthOpen}>
            <strong>{reading ? (mouthOpen ? "Wide open" : "Closed") : "—"}</strong>mouth (yawn)
          </div>
          <div className={s.read} data-hit={turned}>
            <strong>{reading ? (turned ? "Turned away" : "Ahead") : "—"}</strong>head
          </div>
        </div>
      )}
      <p className={s.muted}>Try closing your eyes for a second, a big yawn, or looking away: the box lights up when Kix would count it.</p>
    </div>
  );
}
