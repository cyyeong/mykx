"use client";

// Sky Squadron (design board SkySquadron): four original display jets, each inspired by an insect that flies
// alongside. Earned jets flip to show an insect fact and a flight idea; locked ones say how many fresh questions
// are left. Unlocks come from the ledger (lib/domain/squadron.ts): never random, never bought (rule 5). Display
// flying only: no weapons, insignia or real aircraft (design skill §5).
import { useState } from "react";
import { useSound } from "@/components/sound/SoundProvider";
import { Art } from "@/components/ui/Art";
import "./squadron.css";

export interface JetCard {
  id: string;
  name: string;
  art: string;
  fact: string;
  flight: string;
  earned: boolean;
  /** "Earned 28 Oct", or how to unlock it. */
  note: string;
}

function Jet({ jet }: { jet: JetCard }) {
  const [flipped, setFlipped] = useState(false);
  const { play } = useSound();
  if (!jet.earned) {
    return (
      <article className="sq-card is-locked" aria-label={`${jet.name}, locked. ${jet.note}`}>
        <Art base={jet.art} alt="" sizes="(max-width: 599px) 45vw, 260px" className="sq-art" />
        <div className="sq-meta">
          <h2 className="sq-name">{jet.name}</h2>
          <p className="sq-note">{jet.note}</p>
        </div>
      </article>
    );
  }
  return (
    <button
      type="button"
      className="sq-card sq-flip"
      data-flipped={flipped}
      aria-pressed={flipped}
      aria-label={flipped ? `${jet.name}: ${jet.fact} ${jet.flight}` : `${jet.name}, earned. Tap to flip for its secret.`}
      onClick={() => {
        setFlipped((f) => !f);
        play("flip");
      }}
    >
      <span className="sq-inner">
        <span className="sq-front">
          <Art base={jet.art} alt="" sizes="(max-width: 599px) 45vw, 260px" className="sq-art" />
          <span className="sq-meta">
            <span className="sq-name">{jet.name}</span>
            <span className="sq-earned">Earned</span>
            <span className="sq-note">Tap to flip for its secret</span>
          </span>
        </span>
        <span className="sq-back">
          <span className="sq-name">{jet.name}</span>
          <span className="sq-label">Insect fact</span>
          <span className="sq-text">{jet.fact}</span>
          <span className="sq-label">Flight idea</span>
          <span className="sq-text">{jet.flight}</span>
          <span className="sq-note">{jet.note}</span>
        </span>
      </span>
    </button>
  );
}

export function SkySquadron({ jets, banner, left }: { jets: JetCard[]; banner: boolean; left: number }) {
  const earned = jets.filter((j) => j.earned).length;
  return (
    <main className="sq-page" data-theme="anime-sky" data-band="junior">
      <header className="sq-head">
        <h1 className="sq-h1">Sky Squadron</h1>
        <p className="sq-lede">Four original jets, each inspired by an insect that flies alongside. Solve four fresh questions on your own to earn the next one.</p>
        <span className="sq-count">
          {earned} of {jets.length} jets
        </span>
      </header>
      <div className="sq-grid">
        {jets.map((j) => (
          <Jet key={j.id} jet={j} />
        ))}
      </div>
      <section className="sq-banner" aria-label="Pilot Kix">
        <Art base="/art/jets/squadron-banner" alt="" sizes="(max-width: 599px) 90vw, 420px" className={banner ? "sq-banner-art" : "sq-banner-art is-locked"} />
        <div>
          <h2 className="sq-name">Pilot Kix</h2>
          <p className="sq-text">{banner ? "The whole squadron! Kix has a flight suit now." : "Finish the squadron and Kix gets a flight suit."}</p>
          <p className="sq-note">{banner ? "Every jet came from questions you solved." : `${left} ${left === 1 ? "jet" : "jets"} to go. Nothing here is random: every jet comes from questions you solved.`}</p>
        </div>
      </section>
    </main>
  );
}
