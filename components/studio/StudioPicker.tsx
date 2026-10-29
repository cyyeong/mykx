"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Art } from "@/components/ui/Art";
import { useSound } from "@/components/sound/SoundProvider";
import { useTheme } from "@/components/theme/ThemeRoot";
import { PACKS, getPack, wordmarkFor } from "@/components/theme/packs";
import { INTERESTS, MAX_INTERESTS } from "@/lib/kix/interests";
import s from "./studio.module.css";
import { TransformReveal } from "./TransformReveal";

const SPARKLES = [
  { className: s.sparkle1, size: 40, delay: "0s" },
  { className: s.sparkle2, size: 28, delay: "1.1s" },
  { className: s.sparkle3, size: 22, delay: "2s" },
  { className: s.sparkle4, size: 18, delay: "0.6s" },
];

function SparkleIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="currentColor" d="M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z" />
    </svg>
  );
}

export function StudioPicker() {
  const { pack: packId, setPack } = useTheme();
  const { play } = useSound();
  const pack = getPack(packId);
  const [likes, setLikes] = useState<string[]>(["Bugs and critters", "Jets"]);
  // What the kid already loves (their profile): the first two start picked; the rest are kept on save unless picked.
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    fetch("/api/me")
      .then((r) => r.json() as Promise<{ kid?: { interests?: string[] } }>)
      .then((d) => {
        const mine = d.kid?.interests ?? [];
        if (!live || !mine.length) return;
        setSaved(mine);
        setLikes(mine.slice(0, 2));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  const [transforming, setTransforming] = useState(false);
  // The kept Kix per world stays on this device (it's a picture, not a record); the world itself is saved to
  // the kid's profile when they adopt Pip and head home.
  const [kept, setKept] = useState<Partial<Record<string, string>>>({});
  const [adopting, setAdopting] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const keptKix = kept[pack.id];

  async function adoptAndGo() {
    setSaving(true);
    await fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ pack: pack.id, interests: [...new Set([...likes, ...saved.slice(2)])].slice(0, MAX_INTERESTS) }) }).catch(() => null);
    try {
      if (keptKix) localStorage.setItem(`mykx-kix-${pack.id}`, keptKix);
    } catch {
      // Private mode or full storage: the kept Kix just isn't remembered on this device.
    }
    play("pipGrows");
    router.push("/home");
  }

  function toggle(label: string) {
    play("tap");
    setLikes((cur) => (cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label].slice(-2)));
  }

  return (
    <main className={s.studio}>
      <div aria-hidden="true" className={s.glowA} />
      <div aria-hidden="true" className={s.glowB} />

      <div className={s.stage}>
        <div className={s.kix}>
          {keptKix ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={keptKix} alt={`Your Kix in the ${pack.name} style`} className={`${s.kixImg} ${s.kixKept}`} />
          ) : (
            <Art base={pack.kix} alt={`Kix in the ${pack.name} style`} sizes="400px" className={s.kixImg} />
          )}
          {SPARKLES.map((sp) => (
            <SparkleIcon
              key={sp.className}
              className={`${s.sparkle} ${sp.className}`}
              width={sp.size}
              height={sp.size}
              style={{ animationDelay: sp.delay }}
            />
          ))}
        </div>
        <div className={s.nameplate}>
          <span className={s.nameplateTitle}>Kix, {pack.name}</span>
          <span className={s.nameplateMood}>{pack.mood}</span>
        </div>
      </div>

      <section className={s.panel} aria-labelledby="studio-title">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wordmarkFor(pack)} alt="myKx" className={s.wordmark} />
        <div className={s.intro}>
          <h1 id="studio-title" className={s.title}>Make Kix yours</h1>
          <p className={s.lede}>Pick a world. Kix changes to match it, and so does your whole app.</p>
        </div>

        <div className={s.group}>
          <h2 className={s.groupTitle}>Your world</h2>
          <div className={s.tiles}>
            {PACKS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={s.tile}
                data-theme={p.id}
                aria-pressed={p.id === pack.id}
                onClick={(e) => {
                  setPack(p.id, e.currentTarget);
                  play("packPick", p.id);
                }}
              >
                <Art base={p.kix} alt="" sizes="64px" className={s.tileImg} />
                <span className={s.tileName}>{p.name}</span>
                <span aria-hidden="true" className={s.swatches}>
                  <span style={{ background: "var(--accent)" }} />
                  <span style={{ background: "var(--accent-2)" }} />
                  <span style={{ background: "var(--reward)" }} />
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className={s.group}>
          <h2 className={s.groupTitle}>Two things you love</h2>
          <div className={s.chips}>
            {INTERESTS.map((label) => (
              <button
                key={label}
                type="button"
                className={s.chip}
                aria-pressed={likes.includes(label)}
                onClick={() => toggle(label)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={s.cta}>
          <button className="mk-btn mk-btn--reward" type="button" disabled={likes.length < 2} onClick={() => {
            play("transform");
            setTransforming(true);
          }}>
            <SparkleIcon />
            Transform Kix
          </button>
          <span className={s.ctaNote}>Muse Image draws your Kix in about 20 seconds.</span>
        </div>
      </section>
      {transforming && (
        <TransformReveal
          pack={pack.id}
          interests={likes}
          onKeep={(image) => {
            setKept((k) => ({ ...k, [pack.id]: image }));
            setTransforming(false);
            setAdopting(true);
          }}
          onClose={() => setTransforming(false)}
        />
      )}
      {adopting && (
        <div className={s.adopt} role="dialog" aria-modal="true" aria-labelledby="adopt-title">
          <div className={s.adoptCard}>
            <span className={s.adoptKicker}>One more friend</span>
            <h2 id="adopt-title" className={s.adoptTitle}>Meet Pip!</h2>
            <div className={s.adoptPip} role="img" aria-label="Pip the frog's life cycle: frogspawn, tadpole, froglet, frog" />
            <p className={s.adoptText}>Pip starts as frogspawn. Every question you answer on your own helps Pip grow, all the way to a frog.</p>
            <button type="button" className="mk-btn mk-btn--reward" disabled={saving} onClick={() => void adoptAndGo()}>
              {saving ? "Getting ready…" : "Adopt Pip and go home"}
            </button>
            <button type="button" className={s.adoptLater} onClick={() => setAdopting(false)}>
              Stay in the Studio
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
