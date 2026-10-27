// Living art over a background: the art's own leaves, grass, clouds, water and neon move by their kind
// (lib/scene/livingArt.ts; layers from scripts/living-art.ts). Place it right after the <Art> it belongs to,
// inside the same box, with the same object-position.
import type { CSSProperties } from "react";
import { type LivingArtData, livingBox, livingPieces } from "@/lib/scene/livingArt";
import "./livingArt.css";

type Props = { data: LivingArtData; ox?: string; oy?: string };

const s = (style: Record<string, string>) => style as CSSProperties;

export function LivingArt({ data, ox, oy }: Props) {
  return (
    <div className="la" aria-hidden="true">
      <div className="la-box" style={s(livingBox(data, ox, oy))}>
        {livingPieces(data).map((p) => {
          // Layers are small pre-made WebPs placed in percent of the art; next/image would add nothing.
          // eslint-disable-next-line @next/next/no-img-element
          if (p.kind === "img") return <img key={p.key} className={p.className} src={p.src} alt="" style={s(p.style)} />;
          if (p.kind === "mask") {
            const { "-webkit-mask-image": webkitMask, "mask-image": mask, ...rest } = p.style;
            return <i key={p.key} className={p.className} style={{ ...s(rest), WebkitMaskImage: webkitMask, maskImage: mask }} />;
          }
          return (
            <span key={p.key} className="la-splash" style={s(p.style)}>
              {p.puffs.map((st, i) => (
                <i key={`p${i}`} className="la-puff" style={s(st)} />
              ))}
              {p.drops.map((st, i) => (
                <i key={`d${i}`} className="la-drop" style={s(st)} />
              ))}
            </span>
          );
        })}
      </div>
    </div>
  );
}
