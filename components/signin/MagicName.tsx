"use client";

// Kids' magic name (founder, 29 Oct; canvas board KidMagicName). On the grown-ups' card, Kix asks: "Kids: tell me your
// magic name, and I shall bring your magical door". The name brings the kid's own door: it flies in while their world
// spreads over the city, alive with their world's pieces, and lands where the door screen's door stands; then the
// overlay lifts and the door asks for the picture code or password. No grown-up is needed on this device: the
// lookup sets a ten-minute door ticket and the sign-in opens a solo kid session (app/api/auth/kid/door).
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Art } from "@/components/ui/Art";
import type { PackId } from "@/components/theme/packs";
import { useSound } from "@/components/sound/SoundProvider";
import { isGuest } from "@/lib/guest";
import { LOOKS, lookFor } from "./looks";
import { SignInScreen } from "./SignInScreen";
import "./magicName.css";

type Door = { nickname: string; pack: PackId; band: "junior" | "teen"; secretKind: "pictures" | "password" };

/** Each world's art and the pieces that fly about while the door comes. */
const WORLDS: Record<PackId, { art: string; piece: "leaf" | "confetti" | "petal" | "star" | "bubble"; tints: [string, string] }> = {
  terrarium: { art: "/art/scenes/terrarium", piece: "leaf", tints: ["#FFF6B8", "#9BE3B0"] },
  "idol-stage": { art: "/art/scenes/idol-stage-hero", piece: "confetti", tints: ["#FF8FE0", "#8CFFF5"] },
  "anime-sky": { art: "/art/scenes/anime-sky-hero", piece: "petal", tints: ["#FFFFFF", "#F7B6CF"] },
  dreamlight: { art: "/art/scenes/treasure-vault", piece: "star", tints: ["#FFE38A", "#C9B8FF"] },
  "toon-pop": { art: "/art/scenes/vibe-studio", piece: "bubble", tints: ["#FFD23F", "#FF7EB6"] },
};

const PIECES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${(i * 53) % 90}%`,
  delay: `${-((i * 0.37) % 3).toFixed(2)}s`,
  dur: `${(3 + ((i * 7) % 5) * 0.6).toFixed(1)}s`,
  size: 8 + ((i * 11) % 14),
  spin: `${(i * 47) % 360}deg`,
}));
const MOTES = Array.from({ length: 16 }, (_, i) => ({ left: `${(i * 29 + 7) % 100}%`, delay: `${-((i * 0.53) % 3.4).toFixed(2)}s`, dur: `${(2.8 + (i % 4) * 0.5).toFixed(1)}s` }));

/** The sign-in page: the grown-ups' card, and the magic-name door for kids. */
export function SignInFlow() {
  const [asking, setAsking] = useState(false);
  const [door, setDoor] = useState<Door | null>(null);
  const [summoning, setSummoning] = useState(false);
  const back = () => {
    setDoor(null);
    setSummoning(false);
    setAsking(true);
  };
  return (
    <>
      {door ? (
        <SignInScreen
          key={`${door.nickname}-${door.pack}`}
          variant={door.secretKind === "pictures" ? "junior" : "teen"}
          pack={door.pack}
          kid={{ id: "door", nickname: door.nickname }}
          world={WORLDS[door.pack].art}
          solo={{ onBack: back }}
        />
      ) : (
        <SignInScreen variant="default" onMagicName={() => setAsking(true)} />
      )}
      {asking && !door && (
        <MagicNameDialog
          onClose={() => setAsking(false)}
          onDoor={(d) => {
            setAsking(false);
            setSummoning(true);
            setDoor(d);
          }}
        />
      )}
      {summoning && door && <DoorSummon door={door} onDone={() => setSummoning(false)} />}
    </>
  );
}

function MagicNameDialog({ onClose, onDoor }: { onClose: () => void; onDoor: (door: Door) => void }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { play } = useSound();

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const submit = async (e?: FormEvent, typed = name) => {
    e?.preventDefault();
    if (!typed.trim() || busy) return;
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/auth/kid/door", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: typed.trim() }) });
      const data = (await res.json()) as { ok?: boolean; door?: Door; note?: string };
      if (data.ok && data.door) {
        play("tap");
        onDoor(data.door);
        return;
      }
      setNote(res.status === 429 ? "That's a lot of tries. Wait a minute, then try again." : (data.note ?? "I couldn't find that magic name. Check the spelling, or ask your grown-up."));
    } catch {
      setNote("I can't reach the doors right now. Check the connection and try again.");
    }
    setBusy(false);
  };

  return (
    <div className="mn-back" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="mn-bubble" role="dialog" aria-modal="true" aria-labelledby="mn-ask" onSubmit={submit}>
        <button type="button" className="mn-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <div className="mn-who">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/art/login/kix.webp" alt="" />
          <p id="mn-ask">Tell me your magic name, and I shall bring your magical door!</p>
        </div>
        <label htmlFor="mn-name" className="mn-sr">
          Magic name
        </label>
        <input
          id="mn-name"
          className="mn-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNote("");
          }}
          placeholder="your magic name"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={24}
          autoFocus
          aria-describedby="mn-note"
        />
        <button type="submit" className="mn-go" disabled={!name.trim() || busy}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z" />
          </svg>
          {busy ? "Calling your door…" : "Bring my door"}
        </button>
        {isGuest() && (
          <div className="mn-guests" role="group" aria-label="Sample magic names">
            <span>Guest walkthrough: try</span>
            {["jordan", "abby", "leonard"].map((n) => (
              <button
                key={n}
                type="button"
                className="mn-guest"
                disabled={busy}
                onClick={() => {
                  setName(n);
                  void submit(undefined, n);
                }}
              >
                {n}
              </button>
            ))}
          </div>
        )}
        <p id="mn-note" className="mn-note" aria-live="polite">
          {note || (
            <>
              Your grown-up set your magic name. Forgot it? Ask them, or use <Link href="/doors">Kids&apos; doors</Link> on their phone.
            </>
          )}
        </p>
      </form>
    </div>
  );
}

/** The door's flight, over the city that turns into the kid's world. Lifts once the real door screen is under it. */
function DoorSummon({ door, onDone }: { door: Door; onDone: () => void }) {
  const variant = door.secretKind === "pictures" ? "junior" : "teen";
  const look = LOOKS[lookFor(variant, door.pack)];
  const world = WORLDS[door.pack];
  const root = useRef<HTMLDivElement>(null);
  const flier = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<"fly" | "landed" | "lift">("fly");
  const { play } = useSound();
  const calm = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Held in a ref so a parent re-render can't restart the flight.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  // The real door screen mounts underneath at once: place the flying door over its door, before the first paint.
  useLayoutEffect(() => {
    const el = flier.current;
    const r = document.querySelector(".lg-root .lg-door")?.getBoundingClientRect();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const box = r && r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : { left: w / 2 - 130, top: h / 2 - 240, width: 260, height: 480 };
    if (el) Object.assign(el.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    root.current?.style.setProperty("--ds-x", `${box.left + box.width / 2}px`);
    root.current?.style.setProperty("--ds-y", `${box.top + box.height / 2}px`);
    play("transform", door.pack);
    const ms = calm ? 0 : 1250;
    if (el && !calm) {
      el.animate(
        [
          { transform: `translate(${w - box.left}px, ${-box.top - box.height * 0.6}px) scale(.16) rotate(-26deg)`, opacity: 0 },
          { opacity: 1, offset: 0.12 },
          { transform: "translate(-2%, 2%) scale(1.06) rotate(4deg)", offset: 0.72 },
          { transform: "translate(0, 0) scale(.98) rotate(-1.5deg)", offset: 0.86 },
          { transform: "translate(0, 0) scale(1) rotate(0)", opacity: 1 },
        ],
        { duration: ms, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" },
      );
    }
    const t1 = window.setTimeout(() => {
      setStage("landed");
      play("packPick", door.pack);
    }, ms);
    const t2 = window.setTimeout(() => setStage("lift"), ms + (calm ? 60 : 260));
    const t3 = window.setTimeout(() => done.current(), ms + (calm ? 320 : 820));
    return () => [t1, t2, t3].forEach((t) => window.clearTimeout(t));
  }, [calm, door.pack, play]);

  return (
    <div ref={root} className="ds" data-stage={stage} data-calm={calm ? "yes" : "no"} aria-hidden="true">
      <div className="ds-city">
        <Art base={LOOKS.default.city} className="ds-img" alt="" sizes="100vw" />
      </div>
      <div className="ds-world">
        <Art base={world.art} className="ds-img" alt="" sizes="100vw" />
      </div>
      <div className="ds-life">
        {MOTES.map((m, i) => (
          <i key={`m${i}`} className="ds-mote" style={{ left: m.left, animationDelay: m.delay, animationDuration: m.dur, background: world.tints[i % 2] }} />
        ))}
        {PIECES.map((p, i) => (
          <i
            key={`p${i}`}
            className={`ds-piece ds-${world.piece}`}
            style={{ left: p.left, top: p.top, width: p.size, height: world.piece === "confetti" ? p.size / 2 : p.size, animationDelay: p.delay, animationDuration: p.dur, color: world.tints[i % 2], "--spin": p.spin } as CSSProperties}
          />
        ))}
      </div>
      <div ref={flier} className="ds-door">
        <span className="ds-trail" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={look.leafL} alt="" draggable="false" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={look.leafR} alt="" draggable="false" />
      </div>
      <span className="ds-burst" />
      <p className="ds-say">Here it comes, {door.nickname}!</p>
    </div>
  );
}
