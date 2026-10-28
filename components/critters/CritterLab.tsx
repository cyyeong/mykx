"use client";

// Critter Lab (design board CritterLab): every living thing's life cycle as four living tiles. Each stage moves its
// own way (eggs jiggle, tadpoles swim, butterflies flutter) and the eyes blink with a lid in the critter's own
// colour (positions from SAM 3.1, public/art/living/critters.json). Pip the frog grows with the kid's learning
// (lib/domain/companion.ts); the rest are to explore. Two quick games: put a life cycle in order, and find the
// insects. Play only: no stars, nothing random, nothing lost (rule 5).
import { useMemo, useState, type CSSProperties } from "react";
import { useSound } from "@/components/sound/SoundProvider";
import { CRITTERS, GROUP_LABEL, INSECT_QUIZ, shuffledStages, type Critter } from "@/lib/critters/catalog";
import { stageCrop as crop } from "@/lib/critters/crop";
import eyes from "@/public/art/living/critters.json";
import "./critterLab.css";

type Eye = { stage: number; x: number; y: number; w: number; h: number; lid: string };
const EYES = eyes as Record<string, Eye[]>;
function Tile({ critter, i, dim, glow, onClick, label }: { critter: Critter; i: number; dim?: boolean; glow?: boolean; onClick?: () => void; label?: string }) {
  const stage = critter.stages[i];
  const f = crop(critter, i);
  const style = { "--sheet": `url(${critter.art}-800.webp)`, backgroundSize: `${f.size}% auto`, backgroundPosition: `${f.pos}% 50%` } as CSSProperties;
  const lids = (EYES[critter.id] ?? []).filter((e) => e.stage === i);
  const body = (
    <span className={`cl-critter cl-m-${stage.motion}`} style={style}>
      {lids.map((e, k) => (
        <span key={k} className="cl-lid" style={{ left: `${f.x(e.x)}%`, top: `${f.y(e.y)}%`, width: `${e.w * f.scale}%`, height: `${e.h * f.scale}%`, "--lid": e.lid, "--bdl": `${(i * 1.3 + k * 0.05) % 4}s` } as CSSProperties} />
      ))}
    </span>
  );
  return onClick ? (
    <button type="button" className={`cl-tile${dim ? " is-dim" : ""}${glow ? " is-glow" : ""}`} onClick={onClick} aria-label={label ?? stage.label}>
      {body}
    </button>
  ) : (
    <span className={`cl-tile${dim ? " is-dim" : ""}${glow ? " is-glow" : ""}`} role="img" aria-label={label ?? stage.label}>
      {body}
    </span>
  );
}

function OrderGame({ critter, seed }: { critter: Critter; seed: number }) {
  const { play } = useSound();
  const order = useMemo(() => shuffledStages(seed + critter.id.length * 7), [seed, critter.id]);
  const [picked, setPicked] = useState<number[]>([]);
  const [miss, setMiss] = useState<number | null>(null);
  const done = picked.length === 4;
  const tap = (stage: number) => {
    if (done || picked.includes(stage)) return;
    if (stage === picked.length) {
      setPicked([...picked, stage]);
      setMiss(null);
      play(picked.length === 3 ? "correct" : "tap");
    } else setMiss(stage);
  };
  return (
    <section className="cl-card cl-game" aria-label="Put the life cycle in order">
      <h3 className="cl-h3">Put the {critter.name.toLowerCase()} life cycle in order</h3>
      <p className="cl-muted">{done ? "That's it! " + critter.cycle + "." : miss !== null ? `Not yet: what comes before the ${critter.stages[miss].label.toLowerCase()}?` : "Tap the stages from first to last."}</p>
      <div className="cl-order">
        {order.map((stage) => (
          <span key={stage} className="cl-order-slot">
            <Tile critter={critter} i={stage} dim={picked.includes(stage)} onClick={() => tap(stage)} label={`${critter.stages[stage].label}${picked.includes(stage) ? `, number ${picked.indexOf(stage) + 1}` : ""}`} />
            {picked.includes(stage) && <span className="cl-order-n">{picked.indexOf(stage) + 1}</span>}
          </span>
        ))}
      </div>
      {done && (
        <button type="button" className="mk-btn mk-btn--secondary" onClick={() => setPicked([])}>
          Play again
        </button>
      )}
    </section>
  );
}

function InsectGame() {
  const { play } = useSound();
  const [chosen, setChosen] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);
  const right = INSECT_QUIZ.every((c) => c.insect === chosen.includes(c.id));
  const adult = (id: string) => CRITTERS.find((c) => c.id === id)!;
  return (
    <section className="cl-card cl-game" aria-label="Which are insects?">
      <h3 className="cl-h3">Which are insects?</h3>
      <p className="cl-muted">
        {checked ? (right ? "All found! Insects have 6 legs and 3 body parts (head, thorax, abdomen)." : "Look again: count the legs. Insects have 6.") : "Tap every insect, then check."}
      </p>
      <div className="cl-insects">
        {INSECT_QUIZ.map((c) => {
          const on = chosen.includes(c.id);
          return (
            <span key={c.id} className={`cl-insect${on ? " is-on" : ""}${checked ? (c.insect === on ? " is-right" : " is-wrong") : ""}`}>
              <Tile
                critter={adult(c.id)}
                i={3}
                onClick={() => {
                  setChecked(false);
                  setChosen(on ? chosen.filter((x) => x !== c.id) : [...chosen, c.id]);
                  play("tap");
                }}
                label={`${c.name}${on ? ", picked" : ""}`}
              />
              <span className="cl-insect-name">{c.name}</span>
            </span>
          );
        })}
      </div>
      <button
        type="button"
        className="mk-btn mk-btn--primary"
        onClick={() => {
          setChecked(true);
          if (right) play("correct");
        }}
      >
        Check
      </button>
    </section>
  );
}

export function CritterLab({ pipStage, pipNext }: { pipStage: number; pipNext: string | null }) {
  const { play } = useSound();
  const [id, setId] = useState("frog");
  const [game, setGame] = useState<"order" | "insects">("order");
  const critter = CRITTERS.find((c) => c.id === id) ?? CRITTERS[0];
  const isPip = critter.id === "frog";
  return (
    <main className="cl-page" data-theme="terrarium" data-band="junior">
      <header className="cl-head">
        <div>
          <h1 className="cl-h1">Critter Lab</h1>
          <p className="cl-muted">Life cycles you can watch. Pip grows every time you learn something new.</p>
        </div>
      </header>
      <nav className="cl-tabs" aria-label="Living things">
        {CRITTERS.map((c) => (
          <button
            key={c.id}
            type="button"
            className="cl-tab"
            aria-pressed={c.id === critter.id}
            onClick={() => {
              setId(c.id);
              play("tap");
            }}
          >
            {c.id === "frog" ? "Pip the frog" : c.name}
          </button>
        ))}
      </nav>

      <section className="cl-card cl-main" aria-label={`${critter.name} life cycle`}>
        <div className="cl-main-head">
          <div>
            <h2 className="cl-h2">{isPip ? `Pip the ${critter.stages[pipStage].label.toLowerCase()}` : critter.name}</h2>
            <p className="cl-muted">{critter.cycle}</p>
          </div>
          <div className="cl-badges">
            <span className="cl-badge">{GROUP_LABEL[critter.group]}</span>
            {critter.youngLookLikeAdult !== null && <span className="cl-badge is-soft">{critter.youngLookLikeAdult ? "Young look like the adult" : "Young look different"}</span>}
          </div>
        </div>
        <ol className="cl-strip">
          {critter.stages.map((s, i) => (
            <li key={s.label} className="cl-stage">
              <Tile critter={critter} i={i} dim={isPip && i > pipStage} glow={isPip && i === pipStage} />
              <span className="cl-stage-label">{s.label}</span>
              <span className="cl-stage-note">{s.note}</span>
            </li>
          ))}
        </ol>
        {isPip ? (
          <p className="cl-pip">{pipNext ? `Next stage: ${critter.stages[Math.min(3, pipStage + 1)].label.toLowerCase()}. To get there: ${pipNext}. Pip never gets sick or sad if you take a break.` : "Pip is all grown up! Every stage reached."}</p>
        ) : (
          <ul className="cl-facts">
            {critter.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="cl-games">
        <div className="cl-switch" role="group" aria-label="Critter quests">
          <button type="button" aria-pressed={game === "order"} onClick={() => setGame("order")}>
            Order the life cycle
          </button>
          <button type="button" aria-pressed={game === "insects"} onClick={() => setGame("insects")}>
            Which are insects?
          </button>
        </div>
        {game === "order" ? <OrderGame key={critter.id} critter={critter} seed={7} /> : <InsectGame />}
      </div>
    </main>
  );
}
