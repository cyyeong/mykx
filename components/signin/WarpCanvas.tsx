"use client";

// The time tunnel as one canvas at screen size (founder, 29 Oct: the CSS tunnel flickered; it animated layers up to
// 320 vmax square with gradients and masks, which the browser re-rasterised every frame). One requestAnimationFrame
// loop draws a dark well, the vortex art turning and rushing closer, rings and streaks flying out of the door, and
// a warm flash into the arrival. The art is decoded and masked once, before the tunnel starts.
import { useEffect, useRef } from "react";

const VORTEX = "/art/scenes/transform-vortex-800.webp";
const STREAK_COUNT = 22;

type Sprite = HTMLCanvasElement | null;

/** The vortex art cut to a soft circle, drawn once into an offscreen canvas. */
async function loadSprite(): Promise<Sprite> {
  const img = new Image();
  img.src = VORTEX;
  try {
    await img.decode();
  } catch {
    return null;
  }
  const size = 800;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (!g) return null;
  const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  g.globalCompositeOperation = "destination-in";
  const mask = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  mask.addColorStop(0.52, "rgba(0,0,0,1)");
  mask.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = mask;
  g.fillRect(0, 0, size, size);
  return c;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp = (t: number) => Math.min(1, Math.max(0, t));

export function WarpCanvas({ active, duration = 1400 }: { active: boolean; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sprite = useRef<Sprite>(null);

  // Decode the art as soon as the page is up, so the tunnel's first frame never waits for it.
  useEffect(() => {
    let alive = true;
    void loadSprite().then((s) => {
      if (alive) sprite.current = s;
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const canvas = ref.current;
    const g = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !g) return;
    // The door's glow colours come from the sign-in's own variables (default, junior or teen).
    const css = getComputedStyle(canvas);
    const glow = css.getPropertyValue("--lg-glow").trim() || "255,227,138";
    const glow2 = css.getPropertyValue("--lg-glow-2").trim() || "185,167,245";
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Centred on the door, where the leaves just opened.
    const door = document.querySelector(".lg-door")?.getBoundingClientRect();
    const cx = door ? door.left + door.width / 2 : w / 2;
    const cy = door ? door.top + door.height / 2 : h / 2;
    const vmax = Math.max(w, h);
    const reach = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    const streaks = Array.from({ length: STREAK_COUNT }, (_, i) => ({
      angle: ((i * 360) / STREAK_COUNT + (i % 3) * 7) * (Math.PI / 180),
      offset: ((i * 0.29) % 0.95) * 950,
      len: 0.09 + ((i * 37) % 110) / 1000,
      tint: i % 3 === 0 ? glow : i % 3 === 1 ? "255,255,255" : glow2,
    }));
    const start = performance.now();
    let frame = 0;

    const draw = (now: number) => {
      const ms = now - start;
      const t = clamp(ms / duration);
      const into = clamp(ms / 240);
      g.clearRect(0, 0, w, h);

      // The well
      g.globalAlpha = into;
      const well = g.createRadialGradient(cx, cy, 0, cx, cy, reach);
      well.addColorStop(0, "#221C5C");
      well.addColorStop(0.45, "#0E0B2E");
      well.addColorStop(1, "#06051A");
      g.fillStyle = well;
      g.fillRect(0, 0, w, h);

      // The door's light carries on into the tunnel, then gives way (a bright-to-dark jump reads as a flicker)
      const light = 1 - clamp(ms / 650);
      if (light > 0) {
        const core = g.createRadialGradient(cx, cy, 0, cx, cy, reach * (0.35 + 0.65 * light));
        core.addColorStop(0, `rgba(255,252,238,${(0.95 * light).toFixed(3)})`);
        core.addColorStop(0.35, `rgba(${glow},${(0.6 * light).toFixed(3)})`);
        core.addColorStop(1, `rgba(${glow},0)`);
        g.globalAlpha = 1;
        g.fillStyle = core;
        g.fillRect(0, 0, w, h);
      }

      // The vortex, turning and rushing closer
      if (sprite.current) {
        const d = vmax * 1.9 * (0.16 + 0.99 * ease(t));
        g.save();
        g.translate(cx, cy);
        g.rotate((now / 2600) * Math.PI * 2);
        g.globalAlpha = into * (0.5 + 0.5 * t);
        g.drawImage(sprite.current, -d / 2, -d / 2, d, d);
        g.restore();
      }

      // Rings flying out
      g.globalCompositeOperation = "lighter";
      for (let k = 0; k < 3; k++) {
        const p = ((ms / 1300 + k / 3) % 1 + 1) % 1;
        const r = vmax * (0.12 + 1.38 * p);
        const a = (p < 0.25 ? p / 0.25 : (1 - p) / 0.75) * 0.8 * into;
        g.strokeStyle = `rgba(${glow},${(a * 0.35).toFixed(3)})`;
        g.lineWidth = 14;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = `rgba(${glow},${a.toFixed(3)})`;
        g.lineWidth = 3;
        g.stroke();
      }

      // Streaks
      g.lineCap = "round";
      g.lineWidth = 2.2;
      for (const s of streaks) {
        const p = ((ms + s.offset) % 950) / 950;
        const q = p * p;
        const inner = vmax * (0.03 + 0.75 * q);
        const len = vmax * s.len * (0.2 + 1.6 * q);
        const a = (p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75) * into;
        const x1 = cx + Math.cos(s.angle) * inner;
        const y1 = cy + Math.sin(s.angle) * inner;
        const x2 = cx + Math.cos(s.angle) * (inner + len);
        const y2 = cy + Math.sin(s.angle) * (inner + len);
        const line = g.createLinearGradient(x1, y1, x2, y2);
        line.addColorStop(0, `rgba(${s.tint},0)`);
        line.addColorStop(1, `rgba(${s.tint},${a.toFixed(3)})`);
        g.strokeStyle = line;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
      }
      g.globalCompositeOperation = "source-over";

      // The flash into the arrival (its veil starts warm white, so the hand-over is seamless)
      if (t > 0.7) {
        const f = (t - 0.7) / 0.3;
        g.globalAlpha = f;
        const flash = g.createRadialGradient(cx, cy, 0, cx, cy, reach * 1.2);
        flash.addColorStop(0, "#FFFFFF");
        flash.addColorStop(0.32, "rgba(255,248,226,0.96)");
        flash.addColorStop(0.78, `rgba(${glow},${(0.4 * f).toFixed(3)})`);
        flash.addColorStop(1, `rgba(${glow},${(0.2 * f).toFixed(3)})`);
        g.fillStyle = flash;
        g.fillRect(0, 0, w, h);
        if (t >= 1) {
          g.globalAlpha = 1;
          g.fillStyle = "#FFFCF0";
          g.fillRect(0, 0, w, h);
        }
      }
      g.globalAlpha = 1;
      if (t < 1) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, duration]);

  return <canvas ref={ref} className="lg-warpcanvas" aria-hidden="true" data-on={active ? "yes" : "no"} />;
}
