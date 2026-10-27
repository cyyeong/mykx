// Living art pieces from a layer file (public/art/living/<art>.json, made by scripts/living-art.ts): what to draw
// for each cut-out part and its motion settings. Shared by the React <LivingArt> and the canvas board builder, so
// both draw the same scene. Deterministic: a layer's speed, swing and phase come from its place in the list.

export type LivingMotion = "sway" | "waver" | "breeze" | "mist" | "haze" | "bob" | "float" | "orbit" | "flow" | "shimmer" | "glint" | "runway" | "neon" | "flicker" | "pulse" | "sky" | "twinkle" | "aurora" | "stream";

export interface LivingLayer {
  id: string;
  motion: LivingMotion;
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
  mask: boolean;
  /** Turning point for an orbit layer, in percent of the art. */
  ox?: number;
  oy?: number;
}

export interface LivingArtData {
  art: string;
  width: number;
  height: number;
  /** The art with the sky filled in behind parts that move a lot; drawn first, under every layer. */
  plate?: string;
  layers: LivingLayer[];
}

export type Style = Record<string, string>;

export type LivingPiece =
  | { kind: "img"; key: string; className: string; src: string; style: Style }
  | { kind: "mask"; key: string; className: string; src: string; style: Style }
  | { kind: "splash"; key: string; style: Style; puffs: Style[]; drops: Style[] };

/** Paint order: drifting clouds first, then plants, then light. */
const ORDER: LivingMotion[] = ["sky", "haze", "mist", "orbit", "bob", "float", "sway", "waver", "breeze", "shimmer", "glint", "aurora", "stream", "twinkle", "flicker", "pulse", "runway", "flow", "neon"];

const n2 = (v: number) => String(Math.round(v * 100) / 100);

function timing(motion: LivingMotion, i: number): Style {
  const pick = (base: number, step: number, mod: number) => base + (i % mod) * step;
  switch (motion) {
    case "sway": {
      const d = pick(4.2, 0.8, 4);
      return { "--d": `${n2(d)}s`, "--a": `${n2(pick(1.1, 0.4, 3))}deg`, "--dl": `-${n2((i * 1.7) % d)}s` };
    }
    case "waver": {
      const d = pick(2.6, 0.6, 3);
      return { "--d": `${n2(d)}s`, "--a": `${n2(pick(1.8, 0.8, 2))}deg`, "--dl": `-${n2((i * 1.1) % d)}s` };
    }
    case "mist": {
      const d = pick(14, 3, 4);
      return { "--d": `${n2(d)}s`, "--dx": `${n2(pick(0.8, 0.4, 3))}cqw`, "--dl": `-${n2((i * 4.3) % d)}s` };
    }
    case "haze":
      return { "--d": `${22 + i * 5}s`, "--dx": `${n2(1 + (i % 2) * 0.4)}cqw`, "--dl": `-${n2(i * 6.1)}s` };
    case "bob":
      return { "--d": `${7 + i}s`, "--dl": `-${n2(i * 2.2)}s` };
    case "float": {
      const d = pick(6.5, 1.1, 4);
      return { "--d": `${n2(d)}s`, "--ay": `${n2(pick(0.35, 0.15, 3))}cqh`, "--dl": `-${n2((i * 2.7) % d)}s` };
    }
    case "orbit":
      return { "--d": `${90 + i * 40}s` };
    case "flicker":
      return { "--d": `${n2(pick(2.4, 0.7, 4))}s`, "--dl": `-${n2(i * 0.9)}s` };
    case "pulse":
      return { "--d": "3.4s" };
    case "sky":
      return { "--d": `${90 + i * 30}s` };
    case "twinkle":
      return { "--d": `${n2(pick(1.8, 0.6, 3))}s`, "--dl": `-${n2(i * 0.7)}s` };
    case "aurora":
      return { "--d": `${14 + i * 4}s` };
    case "stream":
      return { "--d": `${n2(2.6 + i * 0.8)}s` };
    case "breeze":
      return { "--d": `${n2(pick(7, 1.5, 3))}s`, "--dl": `-${n2((i * 2.3) % 7)}s` };
    case "flow":
      return { "--d": `${n2(pick(0.9, 0.3, 2))}s` };
    case "shimmer":
      return { "--d": "3.6s", "--dl": `-${n2(i * 1.3)}s` };
    case "glint":
      return { "--d": `${n2(pick(4.5, 1.2, 3))}s`, "--dl": `-${n2(i * 1.9)}s` };
    case "runway":
      return { "--d": "4s" };
    case "neon":
      return { "--d": "2.8s" };
  }
}

/**
 * The pieces to draw for an art's layers. `srcOf` maps a layer file (/art/living/…) to the URL to use (the app
 * uses it as is; the canvas maps it to an uploaded asset).
 */
export function livingPieces(data: LivingArtData, srcOf: (src: string) => string = (s) => s): LivingPiece[] {
  const seen = new Map<LivingMotion, number>();
  const sorted = [...data.layers].sort((a, b) => ORDER.indexOf(a.motion) - ORDER.indexOf(b.motion));
  const pieces: LivingPiece[] = [];
  if (data.plate) pieces.push({ kind: "img", key: "plate", className: "la-l la-plate", src: srcOf(data.plate), style: { "--x": "0%", "--y": "0%", "--w": "100%", "--h": "100%" } });
  for (const l of sorted) {
    const i = seen.get(l.motion) ?? 0;
    seen.set(l.motion, i + 1);
    const box: Style = { "--x": `${l.x}%`, "--y": `${l.y}%`, "--w": `${l.w}%`, "--h": `${l.h}%`, ...timing(l.motion, i) };
    if (l.ox !== undefined && l.oy !== undefined) box["--o"] = `${n2(((l.ox - l.x) / l.w) * 100)}% ${n2(((l.oy - l.y) / l.h) * 100)}%`;
    if (!l.mask) {
      pieces.push({ kind: "img", key: l.id, className: `la-l la-${l.motion}`, src: srcOf(l.src), style: box });
      continue;
    }
    const url = `url(${srcOf(l.src)})`;
    pieces.push({ kind: "mask", key: l.id, className: `la-l la-mask la-${l.motion}`, src: srcOf(l.src), style: { ...box, "-webkit-mask-image": url, "mask-image": url } });
    if (l.motion === "flow") {
      pieces.push({
        kind: "splash",
        key: `${l.id}-splash`,
        style: { "--x": `${n2(l.x + l.w / 2)}%`, "--y": `${n2(l.y + l.h * 0.97)}%`, "--w": `${n2(Math.max(l.w * 1.9, 5))}%` },
        puffs: [0, 1, 2].map((p) => ({ "--d": `${n2(2.2 + p * 0.5)}s`, "--dl": `-${n2(p * 0.8)}s` })),
        drops: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
          "--px": `${28 + ((d * 37) % 46)}%`,
          "--hx": `${(d % 2 ? 1 : -1) * (5 + ((d * 7) % 9))}px`,
          "--hy": `-${16 + ((d * 11) % 18)}px`,
          "--d": `${n2(1.1 + ((d * 3) % 5) * 0.15)}s`,
          "--dl": `-${n2((d * 0.37) % 1.4)}s`,
        })),
      });
    }
  }
  return pieces;
}

/** The cover box for the art: --ar, and where object-position puts it (e.g. "50%", "60%"). */
export function livingBox(data: LivingArtData, ox = "50%", oy = "50%"): Style {
  return { "--ar": `${data.width} / ${data.height}`, "--ox": ox, "--oy": oy };
}

const css = (s: Style) => Object.entries(s).map(([k, v]) => `${k}: ${v}`).join("; ");

/** The same scene as static HTML (for canvas boards). */
export function livingArtHtml(data: LivingArtData, opts: { srcOf?: (src: string) => string; ox?: string; oy?: string; indent?: string } = {}): string {
  const ind = opts.indent ?? "    ";
  const body = livingPieces(data, opts.srcOf).map((p) => {
    if (p.kind === "img") return `${ind}  <img class="${p.className}" src="${p.src}" alt="" style="${css(p.style)}">`;
    if (p.kind === "mask") return `${ind}  <i class="${p.className}" style="${css(p.style)}"></i>`;
    const inner = [...p.puffs.map((s) => `<i class="la-puff" style="${css(s)}"></i>`), ...p.drops.map((s) => `<i class="la-drop" style="${css(s)}"></i>`)].join("");
    return `${ind}  <span class="la-splash" style="${css(p.style)}">${inner}</span>`;
  });
  return `${ind}<div class="la" aria-hidden="true"><div class="la-box" style="${css(livingBox(data, opts.ox, opts.oy))}">\n${body.join("\n")}\n${ind}</div></div>`;
}
