"use client";

// Critter Lab, the Critters tab (founder, 29 Oct): My pets to raise (components/pets/PetsScreen.tsx) and the
// life-cycle explorer with its two quick games (components/critters/CritterLab.tsx).
import { useState } from "react";
import { CritterLab } from "@/components/critters/CritterLab";
import { useSound } from "@/components/sound/SoundProvider";
import type { PetRecord } from "@/lib/pets/care";
import { PetsScreen } from "./PetsScreen";
import "./pets.css";

export function CritterHub(props: { pets: PetRecord[]; now: string; band: "junior" | "teen"; voice: boolean; pipStage: number; pipNext: string | null }) {
  const [tab, setTab] = useState<"pets" | "cycles">("pets");
  const { play } = useSound();
  return (
    <main className="ch">
      <header className="ch-head">
        <div>
          <h1 className="ch-h1">Critter Lab</h1>
          <p className="pt-muted">{tab === "pets" ? "Raise a critter through its real life cycle. Every stage needs different care." : "Life cycles you can watch. Pip grows every time you learn something new."}</p>
        </div>
        <div className="ch-tabs" role="tablist" aria-label="Critter Lab">
          {(
            [
              ["pets", "My pets"],
              ["cycles", "Life cycles"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className="ch-tab"
              onClick={() => {
                setTab(id);
                play("tap");
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {tab === "pets" ? <PetsScreen initial={props.pets} serverNow={props.now} band={props.band} voice={props.voice} /> : <CritterLab pipStage={props.pipStage} pipNext={props.pipNext} embedded />}
    </main>
  );
}
