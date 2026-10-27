// Home (Junior, Terrarium), ported from docs/design/boards/Home.dc.html: scripts/port-board.ts, then by hand.
// Static port with the board's fixture data. Day 3 reads the profile, today's quest, Pip and the squadron from data.
import type { CSSProperties } from "react";
import Link from "next/link";
import { Greeting } from "@/components/scene/Greeting";
import { KixHero } from "@/components/scene/KixHero";
import { TerrariumScene } from "@/components/scene/rooms/TerrariumScene";
import { Art } from "@/components/ui/Art";
import { Button, ButtonLink } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { KixBubble } from "@/components/ui/KixBubble";
import { ROUTES } from "../routes";
import "./homeScreen.css";

const SPARKLE = "M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z";

const TABS: { label: string; icon: string; href: string | null }[] = [
  { label: "Home", icon: "M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z", href: ROUTES.home },
  { label: "Learn", icon: "M4 5h7a2 2 0 0 1 2 2v13a3 3 0 0 0-3-3H4zm16 0h-5a2 2 0 0 0-2 2v13a3 3 0 0 1 3-3h4z", href: ROUTES.quest },
  { label: "Treasure", icon: "M3 9l2-4h14l2 4v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm2.3 0h13.4l-1-2H6.3zM5 11v8h14v-8h-5v2h-4v-2z", href: ROUTES.treasure },
  // Day 5: Vibe Zone gets its route.
  { label: "Vibe Zone", icon: SPARKLE, href: null },
];

const TAB: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  border: 0,
  borderRadius: "var(--radius-pill)",
  font: "800 13px/16px var(--font-text)",
  textDecoration: "none",
  background: "transparent",
  color: "var(--ink)",
};
const TAB_ON: CSSProperties = { ...TAB, background: "var(--accent)", color: "var(--on-accent)" };

/** Frog life cycle, one frame of the sprite sheet each: spawn done, tadpole now, froglet next, frog later. */
const LIFE_CYCLE: { frame: string; style: CSSProperties }[] = [
  { frame: "hm-s0", style: { opacity: 0.8 } },
  { frame: "hm-s1", style: { boxShadow: "0 0 0 3px var(--reward), var(--shadow-glow)" } },
  { frame: "hm-s2", style: { boxShadow: "inset 0 0 0 2px var(--border-control)" } },
  { frame: "hm-s3", style: { opacity: 0.5, filter: "saturate(0.5)" } },
];

const JETS = [
  { art: "/art/jets/dragonfly", alt: "Dragonfly jet, earned", earned: true },
  { art: "/art/jets/bumblebee", alt: "Bumblebee jet, earned", earned: true },
  { art: "/art/jets/firefly", alt: "Firefly jet, locked", earned: false },
  { art: "/art/jets/rhino-beetle", alt: "Rhino Beetle jet, locked", earned: false },
];

const CARD: CSSProperties = { minHeight: 340, boxSizing: "border-box", padding: 20, display: "flex", flexDirection: "column", gap: 10 };
const CARD_TITLE: CSSProperties = { margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, lineHeight: "28px" };
const CAPTION: CSSProperties = { fontWeight: 700, color: "var(--ink-muted)" };

export function HomeScreen({ nickname = "Ari" }: { nickname?: string }) {
  return (
    <div
      className="hm-root"
      data-theme="terrarium"
      data-band="junior"
      style={{ position: "relative", width: "100%", minHeight: "100vh", boxSizing: "border-box", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}
    >
      <div className="hm-wrap">
        <header className="hm-header">
          <GlassPanel as="span" className="hm-chip" ring="none" radius="pill" blur={14} style={{ display: "flex", alignItems: "center", height: 56 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/wordmark-on-light.svg" alt="myKx" style={{ height: 24, width: "auto" }} />
          </GlassPanel>
          <span
            className="hm-chip"
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, height: 56, borderRadius: "var(--radius-pill)", background: "var(--reward)", color: "var(--on-reward)", fontSize: 18, fontWeight: 800, whiteSpace: "nowrap", boxShadow: "var(--shadow-glow)" }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 22, height: 22, flex: "none" }}>
              <path fill="currentColor" d={SPARKLE} />
            </svg>
            91 stars
          </span>
          <Link
            href="/doors"
            aria-label={`Switch profile, ${nickname}`}
            style={{ display: "grid", placeItems: "center", width: 56, height: 56, flex: "none", borderRadius: "var(--radius-pill)", background: "var(--accent)", color: "var(--on-accent)", font: "800 22px/1 var(--font-display)", textDecoration: "none" }}
          >
            {nickname.slice(0, 1).toUpperCase()}
          </Link>
        </header>

        <div className="hm-main">
          <section className="hm-greet">
            <h1 className="hm-h1" style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, textShadow: "0 2px 18px rgba(255, 255, 255, 0.9)" }}>
              <Greeting name={nickname} />
            </h1>
            <KixHero
              pack="terrarium"
              base="/art/kix/terrarium"
              className="hm-kix hm-hero"
              alt="Kix the explorer"
              sizes="(max-width: 599px) 180px, (max-width: 1023px) 240px, (min-width: 1600px) 300px, 260px"
              style={{ height: "auto", aspectRatio: "1 / 1", borderRadius: "50%", objectFit: "cover", alignSelf: "center", boxShadow: "0 0 0 8px var(--surface-raised), 0 0 0 11px var(--accent), var(--shadow-raised)" }}
            />
            <KixBubble raised style={{ padding: "16px 20px", fontSize: 20, lineHeight: "28px", fontWeight: 700 }}>
              Pip is ready to grow legs! Solve two fresh questions on your own and Pip becomes a froglet.
            </KixBubble>
          </section>

          <GlassPanel as="article" className="hm-quest" ring="accent" raised radius="xl" blur={18} style={{ minHeight: 216 }}>
            <div className="hm-quest-text" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              <span style={{ alignSelf: "flex-start", padding: "2px 12px", borderRadius: "var(--radius-pill)", background: "var(--accent-2)", color: "var(--on-accent-2)", fontSize: 14, lineHeight: "22px", fontWeight: 800 }}>
                Today&apos;s quest
              </span>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 34, lineHeight: "38px" }}>Shadows</h2>
              <span style={{ fontSize: 16, lineHeight: "22px", fontWeight: 700, color: "var(--ink-muted)" }}>3 questions · about 8 minutes · limited evidence so far</span>
            </div>
            <ButtonLink href={ROUTES.quest} className="hm-quest-cta">
              Start today&apos;s quest
            </ButtonLink>
            <div className="hm-quest-ring" style={{ display: "grid", placeItems: "center", borderRadius: "var(--radius-lg)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
              <div className="hm-ring" style={{ borderRadius: "50%", display: "grid", placeItems: "center", background: "conic-gradient(var(--accent) 57%, var(--line) 0)" }}>
                <span className="hm-ring-core" style={{ borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--surface-raised)", fontFamily: "var(--font-display)", fontWeight: 800 }}>
                  57
                </span>
              </div>
            </div>
          </GlassPanel>

          <div className="hm-cards">
            <GlassPanel as="article" className="hm-card" style={CARD}>
              <h2 style={CARD_TITLE}>Pip the tadpole</h2>
              <div role="img" aria-label="Frog life cycle: spawn done, tadpole now, froglet next, frog later" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
                {LIFE_CYCLE.map(({ frame, style }) => (
                  <span key={frame} className={`hm-sheet ${frame}`} style={{ height: 60, borderRadius: "var(--radius-sm)", ...style }} />
                ))}
              </div>
              <span className="hm-cap" style={CAPTION}>Now a tadpole. Next: froglet.</span>
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ height: 10, borderRadius: "var(--radius-pill)", background: "var(--line)", overflow: "hidden" }}>
                  <div style={{ width: "50%", height: 10, background: "var(--accent)" }} />
                </div>
                <span style={{ fontSize: 14, lineHeight: "20px", fontWeight: 700 }}>1 of 2 fresh questions</span>
              </div>
            </GlassPanel>

            <GlassPanel as="article" className="hm-card" style={CARD}>
              <h2 style={CARD_TITLE}>Sky Squadron</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                {JETS.map((jet) => (
                  <Art
                    key={jet.art}
                    base={jet.art}
                    alt={jet.alt}
                    sizes="(max-width: 599px) 40vw, 160px"
                    style={{ width: "100%", height: 62, objectFit: "cover", borderRadius: "var(--radius-sm)", display: "block", ...(jet.earned ? null : { filter: "grayscale(1) brightness(0.55)" }) }}
                  />
                ))}
              </div>
              <span className="hm-cap" style={CAPTION}>2 of 4 jets. Firefly is 3 fresh questions away.</span>
              {/* Day 4: Sky Squadron gets its route. */}
              <Button variant="secondary" style={{ marginTop: "auto", width: "100%" }}>See the squadron</Button>
            </GlassPanel>

            <GlassPanel as="article" className="hm-card" style={CARD}>
              <h2 style={CARD_TITLE}>Vibe Zone</h2>
              <div aria-hidden="true" style={{ position: "relative", height: 128, borderRadius: "var(--radius-md)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)", overflow: "hidden" }}>
                <span style={{ position: "absolute", left: 22, top: 22, width: 92, height: 64, borderRadius: 10, background: "var(--accent-2)", transform: "rotate(-8deg)", boxShadow: "var(--shadow-raised)" }} />
                <span style={{ position: "absolute", left: 66, top: 34, width: 92, height: 64, borderRadius: 10, background: "var(--surface)", transform: "rotate(5deg)", boxShadow: "inset 0 0 0 2px var(--accent), var(--shadow-raised)" }} />
                <svg viewBox="0 0 24 24" style={{ position: "absolute", right: 18, top: 16, width: 30, height: 30, color: "var(--reward)" }}>
                  <path fill="currentColor" stroke="#1D3324" strokeWidth="1" d={SPARKLE} />
                </svg>
              </div>
              <span className="hm-cap" style={CAPTION}>Make flashcards or a planner with Kix.</span>
              {/* Day 5: Vibe Zone gets its route. */}
              <Button variant="secondary" style={{ marginTop: "auto", width: "100%" }}>Make something</Button>
            </GlassPanel>
          </div>

          <GlassPanel
            as="nav"
            className="hm-nav"
            aria-label="Main"
            raised
            style={{ boxSizing: "border-box", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}
          >
            {TABS.map((tab) => {
              const current = tab.href === ROUTES.home;
              const inner = (
                <>
                  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 22, height: 22 }}>
                    <path fill="currentColor" d={tab.icon} />
                  </svg>
                  <span>{tab.label}</span>
                </>
              );
              return tab.href ? (
                <Link key={tab.label} href={tab.href} className="hm-tab" aria-current={current ? "page" : undefined} style={current ? TAB_ON : TAB}>
                  {inner}
                </Link>
              ) : (
                <button key={tab.label} type="button" className="hm-tab" style={TAB}>
                  {inner}
                </button>
              );
            })}
          </GlassPanel>
        </div>
      </div>
      <TerrariumScene className="hm-scene" />
    </div>
  );
}
