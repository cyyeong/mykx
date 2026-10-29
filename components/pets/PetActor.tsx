"use client";
/* eslint-disable @next/next/no-img-element -- cut-out sprites drawn in parts, sized by the habitat */

// A pet that really moves (founder, 29 Oct): it wanders its zone of the habitat the way its stage moves (a tadpole
// swims with a wiggling tail, a froglet and a frog hop, larvae and caterpillars crawl, a beetle scuttles, a butterfly
// flaps and flies, chicks and hens walk and peck; eggs, pupae and a chrysalis rest, wobble or sway). Mood changes the
// pace and posture: happy is quick and bouncy, sad slow and droopy, cross jittery. One animation frame loop moves
// it by writing styles straight to the DOM (no re-render per frame); CSS draws the body's own motion. The page drives
// it through the handle: go to a food, eat, turn it down, follow a finger, cheer. Decorative: the page says in words
// what happened.
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { Mood } from "@/lib/pets/care";
import type { Move, PetId } from "@/lib/pets/species";
import { PETS } from "@/lib/pets/species";
import { FACING, SPAWN_ZONE, ZONES, spriteOf, type Rect } from "./habitats";

export type Emote = "hungry" | "sad" | "angry" | "happy" | "love" | "sleepy" | "no" | "yum";

export interface PetHandle {
  /** Walks, swims or flies to a point (percent of the habitat); resolves on arrival (at once for a pet that stays put). */
  goTo(x: number, y: number): Promise<void>;
  eat(): Promise<void>;
  refuse(): Promise<void>;
  cheer(): Promise<void>;
  /** Follow a point (a finger) until null. */
  follow(p: { x: number; y: number } | null): void;
  emote(e: Emote, ms?: number): void;
  /** Where it is now, in percent. */
  where(): { x: number; y: number };
  /** A point near it inside its zone, for dropping food. */
  near(): { x: number; y: number };
}

/** Percent of the habitat per second, by how the stage moves; 0 stays put. */
const SPEED: Record<Move, number> = { swim: 7, hop: 0, crawl: 2.4, scuttle: 15, walk: 5.5, flutter: 10, wobble: 0, rest: 0, hang: 0 };
const PACE: Record<Mood, number> = { happy: 1.25, okay: 1, hungry: 0.8, sad: 0.5, angry: 1.35 };
const STILL = new Set<Move>(["wobble", "rest", "hang"]);
const MOOD_EMOTE: Record<Mood, Emote | null> = { happy: "happy", okay: null, hungry: "hungry", sad: "sad", angry: "angry" };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clampTo = (z: Rect, p: { x: number; y: number }) => ({ x: Math.min(z.x1, Math.max(z.x0, p.x)), y: Math.min(z.y1, Math.max(z.y0, p.y)) });

export function zoneFor(species: PetId, stage: number): Rect {
  if (species === "frog" && stage === 0) return SPAWN_ZONE;
  const z = PETS[species].stages[stage].zone;
  return ZONES[species][z] ?? { x0: 30, x1: 70, y0: 70, y1: 85, anchor: "feet" };
}

export function PetActor({ species, stage, mood, calm, ref }: { species: PetId; stage: number; mood: Mood; calm: boolean; ref?: Ref<PetHandle> }) {
  const s = PETS[species].stages[stage];
  const move = s.move;
  const zone = zoneFor(species, stage);
  const key = `${species}-${stage}`;
  const facing = FACING[key] ?? 1;
  const root = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  // Motion state lives in a ref: the loop reads and writes it every frame.
  const st = useRef({
    x: (zone.x0 + zone.x1) / 2,
    y: (zone.y0 + zone.y1) / 2,
    dir: 1,
    target: null as { x: number; y: number } | null,
    wait: 0.4,
    follow: null as { x: number; y: number } | null,
    arrive: null as (() => void) | null,
    busy: false,
    hop: null as { from: { x: number; y: number }; to: { x: number; y: number }; t: number } | null,
    mood,
    lastEmote: 0,
  });
  useEffect(() => {
    st.current.mood = mood;
  }, [mood]);

  const flash = (cls: string, ms: number) =>
    new Promise<void>((done) => {
      const el = body.current;
      if (!el) return done();
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
      window.setTimeout(() => {
        el.classList.remove(cls);
        done();
      }, calm ? Math.min(ms, 300) : ms);
    });

  const showEmote = (e: Emote, ms = 1800) => {
    const b = bubble.current;
    if (!b) return;
    b.dataset.e = e;
    b.classList.remove("is-on");
    void b.offsetWidth;
    b.classList.add("is-on");
    st.current.lastEmote = performance.now();
    window.setTimeout(() => b.classList.remove("is-on"), ms);
  };

  useImperativeHandle(ref, () => ({
    goTo: (x, y) =>
      new Promise<void>((done) => {
        const m = st.current;
        if (STILL.has(move)) return done();
        m.target = clampTo(zone, { x, y });
        m.busy = true;
        m.arrive = () => {
          m.busy = false;
          done();
        };
      }),
    eat: () => flash("is-eat", 1300),
    refuse: async () => {
      showEmote("no", 1400);
      await flash("is-no", 900);
    },
    cheer: async () => {
      showEmote("love", 1600);
      await flash("is-joy", 900);
    },
    follow: (p) => {
      st.current.follow = p ? clampTo(zone, p) : null;
    },
    emote: showEmote,
    where: () => ({ x: st.current.x, y: st.current.y }),
    near: () => {
      const m = st.current;
      if (STILL.has(move)) return { x: Math.min(zone.x1 + 6, m.x + 7), y: zone.anchor === "top" ? 84 : Math.max(zone.y0, m.y) };
      return clampTo(zone, { x: m.x + (m.x > (zone.x0 + zone.x1) / 2 ? -1 : 1) * rand(8, 16), y: m.y + rand(-4, 4) });
    },
  }));

  useEffect(() => {
    const m = st.current;
    m.x = rand(zone.x0, zone.x1);
    m.y = rand(zone.y0, zone.y1);
    m.target = null;
    m.hop = null;
    let last = performance.now();
    let raf = 0;
    const speed = SPEED[move];

    const place = (tilt = 0, lift = 0) => {
      const r = root.current;
      const f = face.current;
      if (!r || !f) return;
      r.style.left = `${m.x}%`;
      r.style.top = `${m.y}%`;
      const flip = facing === 0 ? 1 : m.dir * facing;
      f.style.transform = `translateY(${-lift}%) scaleX(${flip}) rotate(${tilt}deg)`;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const pace = PACE[m.mood] * (calm ? 0.5 : 1);
      let moving = false;
      let tilt = 0;
      let lift = 0;

      if (m.follow) m.target = m.follow;
      if (!STILL.has(move)) {
        if (!m.target && !m.hop) {
          m.wait -= dt;
          if (m.wait <= 0) {
            m.target = { x: rand(zone.x0, zone.x1), y: rand(zone.y0, zone.y1) };
            m.wait = move === "scuttle" ? rand(0.6, 1.8) : move === "hop" ? rand(1.2, 3) : rand(0.8, 3.2) / pace;
          }
        }
        if (move === "hop") {
          // A hop: crouch, an arc through the air, land. Hops chain until the target is reached.
          if (!m.hop && m.target) {
            const dx = m.target.x - m.x;
            const dy = m.target.y - m.y;
            const d = Math.hypot(dx, dy);
            if (d < 1.5) {
              m.target = null;
              m.arrive?.();
              m.arrive = null;
            } else {
              const step = Math.min(d, s.size * 1.1);
              m.dir = dx < 0 ? -1 : 1;
              m.hop = { from: { x: m.x, y: m.y }, to: { x: m.x + (dx / d) * step, y: m.y + (dy / d) * step }, t: 0 };
              body.current?.classList.add("is-air");
            }
          }
          if (m.hop) {
            m.hop.t += dt / (0.55 / pace);
            const t = Math.min(1, m.hop.t);
            m.x = m.hop.from.x + (m.hop.to.x - m.hop.from.x) * t;
            m.y = m.hop.from.y + (m.hop.to.y - m.hop.from.y) * t;
            lift = Math.sin(Math.PI * t) * 55;
            tilt = (t - 0.5) * -18;
            moving = true;
            if (t >= 1) {
              m.hop = null;
              body.current?.classList.remove("is-air");
              void body.current?.offsetWidth;
              body.current?.classList.add("is-land");
              window.setTimeout(() => body.current?.classList.remove("is-land"), 260);
            }
          }
        } else if (m.target) {
          const dx = m.target.x - m.x;
          const dy = m.target.y - m.y;
          const d = Math.hypot(dx, dy);
          const v = speed * pace * (m.follow ? 1.6 : 1) * (move === "scuttle" ? (0.6 + 0.4 * Math.abs(Math.sin(now / 90))) : 1);
          if (d < 0.6) {
            m.target = m.follow ? m.target : null;
            if (!m.follow) {
              m.arrive?.();
              m.arrive = null;
            }
          } else {
            const step = Math.min(d, v * dt);
            m.x += (dx / d) * step;
            m.y += (dy / d) * step;
            if (Math.abs(dx) > 0.3) m.dir = dx < 0 ? -1 : 1;
            moving = true;
            if (move === "swim") tilt = Math.max(-14, Math.min(14, (dy / d) * 22)) * m.dir * (facing || 1);
            if (move === "flutter") {
              lift = Math.sin(now / 260) * 6;
              tilt = Math.max(-10, Math.min(10, dx * 0.8));
            }
          }
        }
        if (move === "swim" && !moving) lift = Math.sin(now / 700) * 4;
        if (move === "flutter" && !moving) lift = Math.sin(now / 300) * 8;
      }
      if (m.mood === "sad" && !moving) tilt += 4 * m.dir;
      body.current?.classList.toggle("is-moving", moving);
      place(tilt, lift);

      // Every so often the pet shows how it feels.
      const e = MOOD_EMOTE[m.mood];
      if (e && now - m.lastEmote > 7000) {
        const b = bubble.current;
        if (b) {
          b.dataset.e = s.eats.length ? e : e === "happy" ? "sleepy" : e;
          b.classList.remove("is-on");
          void b.offsetWidth;
          b.classList.add("is-on");
          m.lastEmote = now;
          window.setTimeout(() => b.classList.remove("is-on"), 2200);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", vis);
    };
    // A new stage restarts the pet in its new zone.
  }, [key, move, calm, facing, s.size, s.eats.length, zone.x0, zone.x1, zone.y0, zone.y1]);

  const src = spriteOf(species, stage);
  const split = move === "swim" ? "tail" : move === "flutter" ? "wings" : null;
  return (
    <div ref={root} className="pa" data-anchor={zone.anchor} style={{ width: `${s.size}%` }} aria-hidden="true">
      <div ref={face} className="pa-face">
        <div ref={body} className={`pa-body pa-${move}`} data-mood={mood}>
          {split === "tail" ? (
            <>
              {/* The tail half sways from the body; the sprite faces left, so the tail is its right part. */}
              <img className="pa-part pa-tail" src={src} alt="" draggable={false} />
              <img className="pa-part pa-head" src={src} alt="" draggable={false} />
            </>
          ) : split === "wings" ? (
            <>
              <img className="pa-part pa-wing-l" src={src} alt="" draggable={false} />
              <img className="pa-part pa-wing-r" src={src} alt="" draggable={false} />
            </>
          ) : (
            <img className="pa-img" src={src} alt="" draggable={false} />
          )}
        </div>
      </div>
      {zone.anchor === "feet" && <span className="pa-shadow" />}
      <span ref={bubble} className="pa-emote" />
    </div>
  );
}
