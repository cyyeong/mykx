"use client";

// The parts of a habitat a kid can touch (founder, 30 Oct): plants, water, rocks, bran, straw, the lamp. Each is a
// button over its part of the art. A tap lifts that patch of the picture and moves it (a plant sways, a rock rocks, a
// lamp glows), adds ripples, puffs or petals where the finger landed, and hands the page a one-line fact. Until a part
// has been touched on this device, a sparkle visits it now and then, one at a time.
import { Fragment, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import type { PetId } from "@/lib/pets/species";
import { SPOTS, type Spot } from "./habitats";
import { markTouched, useTouched } from "./touch";

const pct = (n: number) => `${n}%`;

export function HabitatSpots({ species, art, off, onTouch }: { species: PetId; art: string; off: boolean; onTouch: (spot: Spot, at: { x: number; y: number }) => void }) {
  const spots = SPOTS[species];
  const touched = useTouched();
  const seen = touched.spots[species] ?? [];
  const fresh = touched.unknown ? [] : spots.filter((s) => !seen.includes(s.id));
  const [tick, setTick] = useState(0);
  const [hits, setHits] = useState<{ key: number; spot: Spot; x: number; y: number }[]>([]);
  const n = useRef(0);

  useEffect(() => {
    if (!fresh.length || off) return;
    const t = window.setInterval(() => setTick((i) => i + 1), 1800);
    return () => window.clearInterval(t);
  }, [fresh.length, off]);
  const spark = fresh.length && !off ? fresh[tick % fresh.length].id : null;

  function tap(s: Spot, e: MouseEvent<HTMLButtonElement>) {
    const box = e.currentTarget.parentElement?.getBoundingClientRect();
    // A keyboard press has no point: use the middle of the part.
    const at = box && e.detail > 0 ? { x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 } : { x: s.x + s.w / 2, y: s.y + s.h / 2 };
    const key = ++n.current;
    setHits((h) => [...h.filter((x) => x.spot.id !== s.id), { key, spot: s, ...at }]);
    window.setTimeout(() => setHits((h) => h.filter((x) => x.key !== key)), 1600);
    if (!seen.includes(s.id)) markTouched((t) => ({ ...t, spots: { ...t.spots, [species]: [...(t.spots[species] ?? []), s.id] } }));
    onTouch(s, at);
  }

  return (
    <div className={`pt-spots${off ? " is-off" : ""}`} style={{ "--hab": `url(${art}.webp)` } as CSSProperties}>
      {hits.map(({ key, spot: s, x, y }) => (
        <Fragment key={key}>
          {/* The same patch of the picture, lifted and moved. */}
          <span className={`pt-spot-art is-${s.kind}`} style={{ left: pct(s.x), top: pct(s.y), width: pct(s.w), height: pct(s.h) }} aria-hidden="true">
            <i style={{ left: pct((-s.x / s.w) * 100), top: pct((-s.y / s.h) * 100), width: pct(10000 / s.w), height: pct(10000 / s.h) }} />
          </span>
          <span className={`pt-spot-fx is-${s.kind}`} style={{ left: pct(x), top: pct(y) }} aria-hidden="true" />
        </Fragment>
      ))}
      {spots.map((s) => (
        <button
          key={s.id}
          type="button"
          className="pt-spot"
          style={{ left: pct(s.x + s.w / 2), top: pct(s.y + s.h / 2), width: pct(s.w), height: pct(s.h) }}
          aria-label={`Touch ${s.label}`}
          tabIndex={off ? -1 : 0}
          onClick={(e) => tap(s, e)}
        >
          {spark === s.id && <span key={tick} className="pt-spark" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
