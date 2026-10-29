"use client";
/* eslint-disable @next/next/no-img-element -- cut-out food and pet sprites placed in percent of the habitat */

// Critter Lab's pets (founder, 29 Oct): raise a frog, a mealworm beetle, a butterfly or a chicken through its real
// life cycle. Each stage needs its own care: the right food (the wrong one is turned down, with why), a scrub of its
// home, play, warmth and the stage's special job. Bars run down with time and the pet's mood follows them: happy,
// hungry, sad or cross, never sick. When the stage's jobs are done and it's well looked after, it grows; an adult
// lays eggs and the cycle starts again. Talk to it and the Critter Keeper answers as the pet (Muse Spark, or a
// cached reply). The server's care rules decide everything (lib/pets/care.ts); the page runs the same rules to show
// the bars running down, and animates what the server said happened. The habitat is touchable (founder, 30 Oct):
// tap or drag the pet, and tap its plants, water and rocks for a fact; touching never changes the bars.
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent, type PointerEvent } from "react";
import { useSound } from "@/components/sound/SoundProvider";
import { Art } from "@/components/ui/Art";
import { TalkButton } from "@/components/voice/TalkButton";
import { FlagButton, type SignedFlag } from "@/components/synapse/FlagButton";
import { useKixVoice } from "@/components/voice/useKixVoice";
import { CRITTERS } from "@/lib/critters/catalog";
import { barsNow, jobsLeft, moodOf, readyToGrow, stageOf, type Mood, type PetRecord, type Reaction } from "@/lib/pets/care";
import { FOODS, PET_IDS, PETS, type Bar, type FoodId, type Job, type PetId } from "@/lib/pets/species";
import { DIRT, HABITAT_ART, foodArt, spriteOf, type Spot } from "./habitats";
import { HabitatSpots } from "./HabitatSpots";
import { PetActor, zoneFor, type PetHandle } from "./PetActor";
import { DROP_LINES, GENTLY, POKE_SOUND, SPOT_SOUND, TOUCH_HINT, markTouched, pokeLines, useTouched, zoneLine } from "./touch";
import "./pets.css";

type Line = { from: "kid" | "pet" | "kix"; text: string; helplines?: { name: string; number: string }[]; flag?: SignedFlag | null };
type Reply = { ok?: boolean; pet?: PetRecord; now?: string; outcome?: { ok: boolean; reaction: Reaction; say: string } | null; reply?: string; feeling?: string; source?: string; flag?: SignedFlag | null; care?: { reply: string; helplines: { name: string; number: string }[] } };

const BAR_LABEL: Record<Bar, string> = { food: "Food", clean: "Clean", love: "Love", warm: "Warm" };
const MOOD_LABEL: Record<Mood, string> = { happy: "Happy", okay: "Content", hungry: "Hungry", sad: "Sad", angry: "Cross" };
const JOB_LABEL: Record<Exclude<Job, "special">, string> = { feed: "Meals", clean: "Clean home", play: "Play", warm: "Warm-up" };
const ICON: Record<Bar | "play" | "special", string> = {
  food: "M4 11h16a8 8 0 0 1-16 0zM9 7c0-1.5 1-2 1-3.5M13 7c0-1.5 1-2 1-3.5",
  clean: "M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z",
  love: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  warm: "M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z",
  play: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z",
  special: "M5 19 19 5M14 5h5v5M5 14v5h5",
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="pt-icon">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A deterministic scatter of dirt spots over the pet's part of the habitat. */
function dirtSpots(species: PetId, stage: number, n: number) {
  const z = zoneFor(species, stage);
  const box = z.anchor === "top" ? { x0: 24, x1: 76, y0: 74, y1: 90 } : z;
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 0.618 + 0.13) % 1;
    const b = (i * 0.381 + 0.47) % 1;
    return { id: i, x: box.x0 - 4 + a * (box.x1 - box.x0 + 8), y: Math.max(box.y0, Math.min(98, box.y0 + 2 + b * (box.y1 - box.y0 + 6))), r: 2.6 + ((i * 7) % 5) * 0.5 };
  });
}

/** The server's clock minus this device's, so the bars run down by the server's time. */
const skewFrom = (iso: string) => Date.parse(iso) - Date.now();
const clockNow = (skew: number) => new Date(Date.now() + skew).toISOString();
const REDUCED = "(prefers-reduced-motion: reduce)";
const onMotionChange = (fn: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
};

/** The whole life cycle, always in view (founder, 29 Oct): every stage in order, where the pet is now, what this stage
 *  is like and what changes next, and the loop back to eggs. Notes and facts come from the Critter Lab catalogue. */
function LifeCycle({ species, stage, name, adopted, grew }: { species: PetId; stage: number; name: string; adopted: boolean; grew: boolean }) {
  const sp = PETS[species];
  const cat = CRITTERS.find((c) => c.id === species);
  const now = sp.stages[stage];
  return (
    <section className="pt-cycle" aria-label={`The ${sp.kind.toLowerCase()} life cycle`}>
      <div className="pt-cycle-head">
        <h3>The {sp.kind.toLowerCase()} life cycle</h3>
        {cat && <span className="pt-muted">{cat.cycle}</span>}
      </div>
      <ol className="pt-cycle-track">
        {sp.stages.map((st, i) => (
          <li key={st.label} className={`pt-step${i < stage ? " is-past" : i === stage && adopted ? " is-now" : ""}${i === stage && grew ? " is-new" : ""}`} aria-current={i === stage && adopted ? "step" : undefined}>
            <span className="pt-step-art">
              <img src={spriteOf(species, i)} alt="" />
            </span>
            <span className="pt-step-label">
              {i + 1}. {st.label}
            </span>
            {i === stage && adopted && <span className="pt-step-here">{name} is here</span>}
          </li>
        ))}
        <li className="pt-step-loop" aria-label="The adult lays eggs and the cycle starts again">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Starts again</span>
        </li>
      </ol>
      <div className="pt-cycle-notes">
        <p>
          <b>{now.label}:</b> {cat?.stages[stage]?.note ?? ""}
        </p>
        <p>
          <b>{stage < 3 ? `Next, a ${sp.stages[stage + 1].label.toLowerCase()}:` : "Next:"}</b> {now.change}
        </p>
        {cat?.facts.length ? <p className="pt-cycle-fact">{cat.facts[stage % cat.facts.length]}</p> : null}
      </div>
    </section>
  );
}

export function PetsScreen({ initial, serverNow, band, voice }: { initial: PetRecord[]; serverNow: string; band: "junior" | "teen"; voice: boolean }) {
  const { play, prop } = useSound();
  const touched = useTouched();
  const pokes = useRef(0);
  const { speak } = useKixVoice(band);
  const skew = useRef(0);
  const [now, setNow] = useState(serverNow);
  const [pets, setPets] = useState<PetRecord[]>(initial);
  const [sel, setSel] = useState<PetId>(PET_IDS.find((id) => initial.some((p) => p.species === id)) ?? "frog");
  const [busy, setBusy] = useState(false);
  const [tray, setTray] = useState(false);
  const [mode, setMode] = useState<null | "clean" | "play">(null);
  const [scrubbed, setScrubbed] = useState<number[]>([]);
  const [food, setFood] = useState<{ id: FoodId; x: number; y: number; state: "drop" | "eat" | "no" } | null>(null);
  const [fx, setFx] = useState<null | "warm" | "sparkle" | "grow" | "rest" | "mist" | "turn" | "rock" | "eggs">(null);
  const [say, setSay] = useState<string>("");
  const [lines, setLines] = useState<Record<string, Line[]>>({});
  const [text, setText] = useState("");
  const [talking, setTalking] = useState(false);
  const [grewAt, setGrewAt] = useState<string | null>(null);
  /** The growth moment: what it grew into and what that stage can do (or the eggs that start the cycle again). */
  const [party, setParty] = useState<{ title: string; note: string; art: string } | null>(null);
  const calm = useSyncExternalStore(onMotionChange, () => window.matchMedia(REDUCED).matches, () => false);
  const actor = useRef<PetHandle>(null);
  /** The pet on screen now, so a reply that arrives after switching pets doesn't speak over the wrong one. */
  const shown = useRef<PetId>(sel);
  useEffect(() => {
    shown.current = sel;
  }, [sel]);
  const stage = useRef<HTMLDivElement>(null);

  // The bars run down on screen: the clock moves on every 15 seconds.
  useEffect(() => {
    skew.current = skewFrom(serverNow);
    const t = window.setInterval(() => setNow(clockNow(skew.current)), 15_000);
    return () => window.clearInterval(t);
  }, [serverNow]);

  const spec = PETS[sel];
  const pet = pets.find((p) => p.species === sel) ?? null;
  const s = pet ? stageOf(pet) : spec.stages[0];
  const bars = pet ? barsNow(pet, now) : null;
  const mood: Mood = pet ? moodOf(pet, now) : "okay";
  const jobs = pet ? jobsLeft(pet) : [];
  const dirtCount = bars && s.bars.includes("clean") ? Math.max(0, Math.min(8, Math.round((100 - bars.clean) / 11))) : 0;
  const spots = dirtSpots(sel, pet?.stage ?? 0, dirtCount);
  const name = spec.name;

  const put = (p: PetRecord) => {
    setPets((all) => [...all.filter((x) => x.species !== p.species), p]);
    setNow(clockNow(skew.current));
  };
  const wait = (ms: number) => new Promise((r) => window.setTimeout(r, calm ? Math.min(ms, 250) : ms));

  async function post(body: Record<string, unknown>): Promise<Reply | null> {
    try {
      const res = await fetch("/api/pets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const r = (await res.json()) as Reply;
      if (r.now) skew.current = skewFrom(r.now);
      return res.ok ? r : null;
    } catch {
      return null;
    }
  }

  /** What a care result looks like: the pet reacts, says its line, and grows or lays eggs on screen. */
  async function show(r: Reply | null) {
    if (!r?.outcome || !r.pet) {
      setSay("That didn't work. Try again in a moment.");
      return;
    }
    const { reaction, say: line } = r.outcome;
    setSay(line);
    if (reaction === "grew" || reaction === "eggs") {
      const grown = r.pet;
      const next = PETS[grown.species].stages[grown.stage];
      const note = CRITTERS.find((c) => c.id === grown.species)?.stages[grown.stage]?.note ?? "";
      play(reaction === "eggs" ? "transform" : "reward");
      setFx(reaction === "eggs" ? "eggs" : "grow");
      await wait(900);
      put(grown);
      setGrewAt(grown.species);
      setParty({
        title: reaction === "eggs" ? `A new generation of ${name}!` : `${name} grew into a ${next.label.toLowerCase()}!`,
        note: reaction === "eggs" ? line : `${next.label}: ${note}`,
        art: spriteOf(grown.species, grown.stage),
      });
      window.setTimeout(() => setGrewAt(null), 4000);
      await wait(1200);
      setFx(null);
      await wait(2600);
      setParty(null);
      return;
    }
    put(r.pet);
    if (reaction === "no" || reaction === "wait") {
      play("hint");
      await actor.current?.refuse();
    } else if (reaction === "full") {
      actor.current?.emote("happy");
    } else {
      play("correct");
      await actor.current?.cheer();
    }
  }

  async function adopt() {
    setBusy(true);
    const r = await post({ action: "adopt", species: sel });
    if (r?.pet) {
      put(r.pet);
      play("packPick");
      setSay(`Hello! I'm ${name}. ${PETS[sel].notEating[0] ?? ""}`.trim());
    }
    setBusy(false);
  }

  async function feed(id: FoodId) {
    if (!pet || busy) return;
    setBusy(true);
    setTray(false);
    play("tap");
    const at = actor.current?.near() ?? { x: 50, y: 70 };
    setFood({ id, ...at, state: "drop" });
    const reply = post({ action: "feed", species: sel, food: id });
    await wait(500);
    await Promise.race([actor.current?.goTo(at.x, at.y), wait(4000)]);
    const r = await reply;
    if (r?.outcome?.ok) {
      setFood((f) => f && { ...f, state: "eat" });
      await actor.current?.eat();
    } else {
      setFood((f) => f && { ...f, state: "no" });
    }
    await show(r);
    setFood(null);
    setBusy(false);
  }

  async function act(action: "clean" | "warm" | "special" | "play") {
    if (!pet || busy) return;
    setBusy(true);
    play("tap");
    const special = s.special?.id;
    const fxFor = action === "warm" ? "warm" : action === "clean" ? "sparkle" : special === "rest" || special === "wait" ? "rest" : special === "leaf" ? "mist" : special === "turn" ? "turn" : special === "rock" ? "rock" : null;
    if (fxFor && action !== "special") setFx(fxFor);
    if (action === "special" && fxFor && special !== "eggs") setFx(fxFor);
    if (fxFor) await wait(fxFor === "rest" ? 1800 : 1100);
    const r = await post({ action, species: sel });
    if (fxFor !== "rock") setFx(null);
    await show(r);
    if (fxFor === "rock") window.setTimeout(() => setFx((f) => (f === "rock" ? null : f)), 2500);
    setBusy(false);
  }

  function startClean() {
    if (!pet || busy) return;
    if (!dirtCount) return void act("clean");
    setScrubbed([]);
    setMode("clean");
    setSay("Rub the dirty spots away!");
  }

  function scrub(e: PointerEvent<HTMLDivElement>) {
    if (mode === "play" && stage.current) {
      const b = stage.current.getBoundingClientRect();
      actor.current?.follow({ x: ((e.clientX - b.left) / b.width) * 100, y: ((e.clientY - b.top) / b.height) * 100 });
      return;
    }
    if (mode !== "clean" || !stage.current || (e.pointerType === "mouse" && e.buttons === 0)) return;
    const b = stage.current.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * 100;
    const y = ((e.clientY - b.top) / b.height) * 100;
    const hit = spots.filter((p) => !scrubbed.includes(p.id) && Math.hypot((p.x - x) * 1.6, p.y - y) < p.r * 2.6).map((p) => p.id);
    if (!hit.length) return;
    play("tap");
    const next = [...scrubbed, ...hit];
    setScrubbed(next);
    if (next.length >= spots.length) {
      setMode(null);
      void act("clean");
    }
  }

  async function startPlay() {
    if (!pet || busy) return;
    setMode("play");
    setSay(s.eats.length ? "Move your finger around the habitat. I'll follow it!" : "Stay with me a moment. I like it when you're here.");
    // No pointer? It chases a sparkle that loops by itself.
    const z = zoneFor(sel, pet.stage);
    for (let i = 0; i < 6; i++) {
      await wait(650);
      actor.current?.follow({ x: z.x0 + ((i % 3) / 2) * (z.x1 - z.x0), y: (z.y0 + z.y1) / 2 + (i % 2 ? 3 : -3) });
    }
    actor.current?.follow(null);
    setMode(null);
    await act("play");
  }

  async function send(e?: FormEvent, spoken?: string) {
    e?.preventDefault();
    const t = (spoken ?? text).trim();
    if (!t || !pet || talking) return;
    const asked = sel;
    setText("");
    setTalking(true);
    const add = (l: Line) => setLines((all) => ({ ...all, [asked]: [...(all[asked] ?? []), l].slice(-8) }));
    add({ from: "kid", text: t });
    try {
      const res = await fetch("/api/pets/talk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ species: asked, text: t }) });
      const r = (await res.json()) as Reply;
      if (r.care) add({ from: "kix", text: r.care.reply, helplines: r.care.helplines });
      else if (r.reply) {
        add({ from: "pet", text: r.reply, flag: r.flag ?? null });
        if (r.pet) put(r.pet);
        if (shown.current !== asked) return setTalking(false);
        setSay(r.reply);
        actor.current?.emote(r.feeling === "love" ? "love" : r.feeling === "hungry" ? "hungry" : r.feeling === "sad" ? "sad" : r.feeling === "angry" ? "angry" : "happy");
      } else add({ from: "pet", text: "…" });
    } catch {
      add({ from: "pet", text: "I didn't catch that. Say it again?" });
    }
    setTalking(false);
  }

  /** Touching the pet: its own line each time, "gently" after too many quick taps. Never changes the bars. */
  function poked(rough: boolean) {
    if (!touched.pet) markTouched((t) => ({ ...t, pet: true }));
    if (rough) return setSay(GENTLY);
    prop(POKE_SOUND[s.move]);
    const said = pet ? pokeLines(sel, pet.stage, s.move) : [];
    if (!said.length) return;
    setSay(said[pokes.current++ % said.length]);
  }

  function dropped(outside: boolean) {
    if (!touched.pet) markTouched((t) => ({ ...t, pet: true }));
    prop("tink");
    setSay(outside && pet ? zoneLine(sel, pet.stage, s.zone) : DROP_LINES[pokes.current++ % DROP_LINES.length]);
  }

  function touchSpot(spot: Spot, at: { x: number; y: number }) {
    prop(SPOT_SOUND[spot.kind]);
    setSay(spot.fact);
    actor.current?.notice(at.x, at.y);
  }

  const growing = pet ? readyToGrow(pet, now) : false;
  const still = mode === null && !busy && !party;
  const showTouchHint = Boolean(pet) && still && !touched.unknown && (!touched.pet || !touched.spots[sel]?.length);
  const chat = lines[sel] ?? [];
  const lastPet = [...chat].reverse().find((l) => l.from === "pet");

  return (
    <div className="pt" data-mood={mood}>
      <div className="pt-pick" role="radiogroup" aria-label="Your critters">
        {PET_IDS.map((id) => {
          const p = pets.find((x) => x.species === id);
          return (
            <button key={id} type="button" role="radio" aria-checked={sel === id} className="pt-pick-btn" onClick={() => { setSel(id); setSay(""); setTray(false); setMode(null); play("tap"); }}>
              <span className="pt-pick-art">
                <img src={spriteOf(id, p?.stage ?? 0)} alt="" className={p ? "" : "is-ghost"} />
              </span>
              <span className="pt-pick-text">
                <b>{PETS[id].name}</b>
                <span>{p ? `${PETS[id].stages[p.stage].label}${p.generation > 1 ? ` · gen ${p.generation}` : ""}` : `Adopt a ${PETS[id].kind.toLowerCase()}`}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="pt-grid">
        <section className="pt-habitat-card" aria-label={`${name}'s ${spec.habitat.toLowerCase()}`}>
          <div ref={stage} className={`pt-habitat${mode ? ` is-${mode}` : ""}`} data-fx={fx ?? ""} onPointerMove={scrub} onPointerDown={scrub}>
            <Art base={HABITAT_ART[sel]} className="pt-hab-img" alt="" sizes="(max-width: 1023px) 100vw, 66vw" />
            {spots.map((p) => (
              <span
                key={p.id}
                className={scrubbed.includes(p.id) ? "pt-dirt is-gone" : "pt-dirt"}
                style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.r * 2}%`, background: `radial-gradient(closest-side, ${DIRT[sel][p.id % 2]}, transparent)` } as CSSProperties}
              />
            ))}
            {fx === "rock" && <span className="pt-rock" />}
            {food && (
              <img src={foodArt(food.id)} alt="" className={`pt-food is-${food.state}`} style={{ left: `${food.x}%`, top: `${food.y}%` }} />
            )}
            {pet && <HabitatSpots species={sel} art={HABITAT_ART[sel]} off={!still} onTouch={touchSpot} />}
            {pet ? (
              <PetActor key={`${sel}-${pet.stage}-${pet.generation}`} ref={actor} species={sel} stage={pet.stage} mood={mood} calm={calm} touchable={still} beckon={!touched.pet} onPoke={poked} onDrop={dropped} />
            ) : (
              <div className="pt-adopt">
                <img src={spriteOf(sel, 0)} alt="" className="pt-adopt-art" />
                <p>
                  {name} the {spec.kind.toLowerCase()} starts as {spec.stages[0].label.toLowerCase()}. Look after each stage and watch it grow.
                </p>
                <button type="button" className="mk-btn mk-btn--primary" onClick={adopt} disabled={busy}>
                  Adopt {name}
                </button>
              </div>
            )}
            <span className="pt-fx" aria-hidden="true" />
            {party && (
              <div className="pt-party" role="status">
                <span className="pt-confetti" aria-hidden="true" />
                <img src={party.art} alt="" className="pt-party-art" />
                <b>{party.title}</b>
                <span>{party.note}</span>
              </div>
            )}
            {mode === "clean" && <span className="pt-hint">Rub the spots to scrub them away</span>}
            {showTouchHint && (
              <span className="pt-hint pt-hint--touch">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 11V5a1.5 1.5 0 0 1 3 0v5.5M12 10V4a1.5 1.5 0 0 1 3 0v6.5M15 10.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.6a6 6 0 0 1-4.7-2.3L4 13.9a1.6 1.6 0 0 1 2.4-2.1L9 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  Tap or drag {name}
                  <span className="pt-hint-more">. Touch {TOUCH_HINT[sel]} too!</span>
                </span>
              </span>
            )}
            {say && (
              <p className="pt-say" role="status">
                <b>{name}:</b> {say}
              </p>
            )}
          </div>
          {pet && tray && (
            <div className="pt-tray" role="group" aria-label={`Food for ${name}`}>
              {spec.tray.map((f) => (
                <button key={f} type="button" className="pt-food-btn" onClick={() => feed(f)} disabled={busy}>
                  <img src={foodArt(f)} alt="" />
                  <span>{FOODS[f].name}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <LifeCycle species={sel} stage={pet?.stage ?? 0} name={name} adopted={Boolean(pet)} grew={grewAt === sel} />

        <aside className="pt-care" aria-label={`Look after ${name}`}>
          <header className="pt-care-head">
            <h2>
              {name} <span>the {pet ? s.label.toLowerCase() : spec.kind.toLowerCase()}</span>
            </h2>
            {pet && <span className={`pt-mood pt-mood--${mood}`}>{MOOD_LABEL[mood]}</span>}
          </header>
          {pet && bars ? (
            <>
              <ul className="pt-bars">
                {s.bars.map((k) => (
                  <li key={k} className={`pt-bar pt-bar--${k}${bars[k] < 35 ? " is-low" : ""}`}>
                    <Icon d={ICON[k]} />
                    <span className="pt-bar-name">{BAR_LABEL[k]}</span>
                    <span className="pt-bar-track" role="meter" aria-label={BAR_LABEL[k]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={bars[k]}>
                      <span style={{ width: `${bars[k]}%` }} />
                    </span>
                  </li>
                ))}
              </ul>

              <div className="pt-actions">
                <button type="button" className="pt-act" aria-expanded={tray} onClick={() => setTray(!tray)} disabled={busy}>
                  <Icon d={ICON.food} /> Feed
                </button>
                {s.bars.includes("clean") && (
                  <button type="button" className="pt-act" onClick={mode === "clean" ? () => { setMode(null); void act("clean"); } : startClean} disabled={busy}>
                    <Icon d={ICON.clean} /> {mode === "clean" ? "Scrub it all" : "Clean"}
                  </button>
                )}
                <button type="button" className="pt-act" onClick={startPlay} disabled={busy || mode !== null}>
                  <Icon d={ICON.play} /> {s.eats.length ? "Play" : "Keep it company"}
                </button>
                {(s.bars.includes("warm") || s.jobs.warm) && (
                  <button type="button" className="pt-act" onClick={() => act("warm")} disabled={busy}>
                    <Icon d={ICON.warm} /> Warm
                  </button>
                )}
                {s.special && (
                  <button type="button" className={`pt-act pt-act--special${growing && pet.stage === 3 ? " is-ready" : ""}`} onClick={() => act("special")} disabled={busy}>
                    <Icon d={ICON.special} /> {s.special.label}
                  </button>
                )}
              </div>

              <div className="pt-grow">
                <h3>{pet.stage < 3 ? `To grow into a ${spec.stages[pet.stage + 1].label.toLowerCase()}` : "To lay eggs and start again"}</h3>
                <ul>
                  {jobs.map((j) => (
                    <li key={j.job} className={j.left === 0 ? "is-done" : ""}>
                      <span>{j.job === "special" ? s.special?.label : JOB_LABEL[j.job]}</span>
                      <span>
                        {j.of - j.left} of {j.of}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="pt-muted">{growing ? "Ready! One more bit of care and watch." : "Keep every bar above halfway too. A pet never gets sick, and a stage once reached stays."}</p>
              </div>
            </>
          ) : (
            <p className="pt-muted">{spec.stages.map((x) => x.label).join(" → ")}</p>
          )}
        </aside>
      </div>

      {pet && (
        <section className="pt-talk" aria-label={`Talk to ${name}`}>
          <div className="pt-talk-head">
            <h2>Talk to {name}</h2>
            <span className="pt-muted">The Critter Keeper answers as your {s.label.toLowerCase()}. Chats aren&apos;t saved.</span>
          </div>
          <ol className="pt-lines" aria-live="polite">
            {chat.length === 0 && <li className="pt-line pt-line--pet">Ask me what I eat, how I breathe, or what I need to grow!</li>}
            {chat.map((l, i) => (
              <li key={i} className={`pt-line pt-line--${l.from}`}>
                {l.from === "kix" && <b>Kix: </b>}
                {l.text}
                {l.from === "pet" && l.flag && <FlagButton surface="critter" band={band} flag={l.flag} what={`what ${name} said`} className="pt-flag" />}
                {l.helplines && (
                  <span className="pt-help">
                    {l.helplines.map((h) => (
                      <span key={h.number}>
                        {h.name}: {h.number}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ol>
          <form className="pt-talk-form" onSubmit={send}>
            <label htmlFor="pt-say" className="pt-sr">
              Say something to {name}
            </label>
            <input id="pt-say" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder={`Say something to ${name}…`} autoComplete="off" />
            {voice && <TalkButton onTranscript={(t) => void send(undefined, t)} />}
            <button type="submit" className="mk-btn mk-btn--primary" disabled={talking || !text.trim()}>
              {talking ? "…" : "Send"}
            </button>
            {lastPet && (
              <button type="button" className="mk-btn mk-btn--secondary" onClick={() => speak(lastPet.text)} aria-label={`Hear ${name}'s last reply`}>
                Hear it
              </button>
            )}
          </form>
          <p className="pt-muted pt-small">Your critter speaks with your device&apos;s voice.</p>
        </section>
      )}
    </div>
  );
}
