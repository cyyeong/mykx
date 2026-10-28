// A Kix sticker (family messages): our own Kix art in a round die-cut frame, moving its own way, with a small
// effect on top (confetti, stars, hearts, zzz, sparkles or thinking dots). CSS only, so no outside GIF service, no
// tracking and nothing unsafe. Reduced motion keeps it still.
import type { CSSProperties } from "react";
import { STICKER_INFO, type Sticker } from "@/lib/family/messages";
import { Art } from "@/components/ui/Art";
import styles from "./sticker.module.css";

const HEART = "M12 21s-7.5-4.6-9.4-9.3C1.2 8.1 3.4 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 5.8 3.6 4.4 7.2C19.5 16.4 12 21 12 21z";
const SPARK = "M12 1.5Q13.2 10.8 22.5 12Q13.2 13.2 12 22.5Q10.8 13.2 1.5 12Q10.8 10.8 12 1.5Z";
const CONFETTI = ["var(--accent)", "var(--accent-2)", "var(--reward)", "var(--success)", "var(--accent)", "var(--reward)", "var(--accent-2)", "var(--success)"];

function Fx({ fx }: { fx: NonNullable<(typeof STICKER_INFO)[Sticker]["fx"]> }) {
  if (fx === "confetti")
    return (
      <span className={styles.fx} aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <i key={i} className={styles.confetti} style={{ "--c": c, "--a": `${i * 45 + 10}deg`, "--d": `${(i % 4) * 0.18}s` } as CSSProperties} />
        ))}
      </span>
    );
  if (fx === "zzz")
    return (
      <span className={styles.fx} aria-hidden="true">
        {["z", "z", "Z"].map((z, i) => (
          <b key={i} className={styles.zzz} style={{ "--d": `${i * 0.7}s`, "--x": `${62 + i * 9}%` } as CSSProperties}>
            {z}
          </b>
        ))}
      </span>
    );
  if (fx === "dots")
    return (
      <span className={`${styles.fx} ${styles.bubble}`} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <i key={i} className={styles.dot} style={{ "--d": `${i * 0.18}s` } as CSSProperties} />
        ))}
      </span>
    );
  const d = fx === "hearts" ? HEART : SPARK;
  const spots = fx === "hearts" ? [[14, 20], [78, 12], [84, 58]] : fx === "stars" ? [[10, 16], [82, 10], [88, 62], [6, 64]] : [[16, 10], [84, 22], [76, 74]];
  return (
    <span className={styles.fx} aria-hidden="true">
      {spots.map(([x, y], i) => (
        <svg key={i} viewBox="0 0 24 24" className={fx === "hearts" ? styles.heart : styles.spark} style={{ left: `${x}%`, top: `${y}%`, "--d": `${i * 0.5}s` } as CSSProperties}>
          <path d={d} />
        </svg>
      ))}
    </span>
  );
}

export function KixSticker({ sticker, size = 120, still = false, label = true }: { sticker: Sticker; size?: number; still?: boolean; label?: boolean }) {
  const info = STICKER_INFO[sticker];
  return (
    <span className={styles.sticker} style={{ "--s": `${size}px` } as CSSProperties} data-still={still || undefined} role="img" aria-label={`Kix sticker: ${info.label}`}>
      <span className={`${styles.disc} ${styles[info.motion]}`}>
        <Art base={info.art} alt="" sizes={`${size * 2}px`} className={styles.art} />
      </span>
      {info.fx && !still && <Fx fx={info.fx} />}
      {label && <span className={styles.label}>{info.label}</span>}
    </span>
  );
}
