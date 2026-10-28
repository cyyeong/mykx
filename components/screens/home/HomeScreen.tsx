// Home (Junior, Terrarium), ported from docs/design/boards/Home.dc.html: scripts/port-board.ts, then by hand.
// Every number comes from the learner record (app/(kid)/home/page.tsx): stars, today's quest, Pip's stage, the
// squadron, and Kix's next step from the guardian (lib/guardian), which says why.
import Link from "next/link";
import type { CSSProperties } from "react";
import { KixSticker } from "@/components/family/KixSticker";
import { GuardianChips } from "@/components/guardian/GuardianChips";
import { KidAvatarMenu } from "@/components/nav/KidAvatarMenu";
import { Greeting } from "@/components/scene/Greeting";
import { KixHero } from "@/components/scene/KixHero";
import { TerrariumScene } from "@/components/scene/rooms/TerrariumScene";
import { Art } from "@/components/ui/Art";
import { ButtonLink } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { KixBubble } from "@/components/ui/KixBubble";
import type { Sticker } from "@/lib/family/messages";
import { ROUTES } from "../routes";
import "./homeScreen.css";

const SPARKLE = "M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z";

/** Frog life cycle, one frame of the sprite sheet each: past stages soft, today's glowing, later ones faded. */
const FRAMES = ["hm-s0", "hm-s1", "hm-s2", "hm-s3"];
const frameStyle = (i: number, stage: number): CSSProperties =>
  i < stage ? { opacity: 0.8 } : i === stage ? { boxShadow: "0 0 0 3px var(--reward), var(--shadow-glow)" } : i === stage + 1 ? { boxShadow: "inset 0 0 0 2px var(--border-control)" } : { opacity: 0.5, filter: "saturate(0.5)" };

const JET_ART: Record<string, { art: string; name: string }> = {
  dragonfly: { art: "/art/jets/dragonfly", name: "Dragonfly" },
  bumblebee: { art: "/art/jets/bumblebee", name: "Bumblebee" },
  firefly: { art: "/art/jets/firefly", name: "Firefly" },
  rhino_beetle: { art: "/art/jets/rhino-beetle", name: "Rhino Beetle" },
};

/** What grows Pip next, in a few words for the card (the full rule is in lib/domain/companion.ts). */
const GROW = ["Answer your first question", "Get a new question right on your own", "Keep one skill above 70 for two days"];

export interface HomeData {
  nickname: string;
  stars: number;
  quest: { title: string; href: string; mastered: number; total: number; questions: number; minutes: number; evidence: string; started: boolean };
  pip: { stage: number; name: string; next: { name: string; needs: string } | null };
  squadron: { unlocked: string[]; all: string[]; next: { jet: string; have: number; need: number } | null };
  /** Kix's next step (the guardian's recommendation) and why. */
  next: { line: string; why: string; href: string | null; cta: string | null; kind: string };
  /** The newest unread family message (from a grown-up), if any. */
  message?: { from: string; preview: string | null; sticker: Sticker | null; count: number } | null;
}

const SAMPLE: HomeData = {
  nickname: "Jordan",
  stars: 0,
  quest: { title: "The frog life cycle", href: ROUTES.quest, mastered: 0, total: 5, questions: 3, minutes: 9, evidence: "No evidence yet", started: false },
  pip: { stage: 0, name: "frogspawn", next: { name: "tadpole", needs: "answer your first question" } },
  squadron: { unlocked: [], all: ["dragonfly", "bumblebee", "firefly", "rhino_beetle"], next: { jet: "dragonfly", have: 0, need: 4 } },
  next: { kind: "learn", line: "Ready for The frog life cycle?", why: "Today's learning comes first.", href: ROUTES.quest, cta: "Start today's quest" },
};

const CARD: CSSProperties = { minHeight: 340, boxSizing: "border-box", padding: 20, display: "flex", flexDirection: "column", gap: 10 };
const CARD_TITLE: CSSProperties = { margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, lineHeight: "28px" };
const CAPTION: CSSProperties = { fontWeight: 700, color: "var(--ink-muted)" };

export function HomeScreen({ data = SAMPLE }: { data?: HomeData }) {
  const { nickname, quest, pip, squadron, next } = data;
  const pct = quest.total ? Math.round((quest.mastered / quest.total) * 100) : 0;
  const jetName = (j: string) => JET_ART[j]?.name ?? j;
  const stepCta = next.href && next.cta && next.kind !== "learn" ? next : null;
  return (
    <div
      className="hm-root"
      data-theme="terrarium"
      data-band="junior"
      style={{ position: "relative", width: "100%", minHeight: "var(--screen-h, 100vh)", boxSizing: "border-box", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}
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
            {data.stars} {data.stars === 1 ? "star" : "stars"}
          </span>
          {data.message && (
            <Link href="/messages" className="hm-chip hm-msg" aria-label={`${data.message.count === 1 ? "A new message" : `${data.message.count} new messages`} from ${data.message.from}`}>
              <KixSticker sticker={data.message.sticker ?? "love"} size={40} label={false} />
              <span className="hm-msg-text">
                <span className="hm-msg-from">From {data.message.from}</span>
                <span className="hm-msg-preview">{data.message.preview ?? "sent you a sticker"}</span>
              </span>
              {data.message.count > 1 && <span className="hm-msg-count">{data.message.count}</span>}
            </Link>
          )}
          <KidAvatarMenu nickname={nickname} />
        </header>

        {/* Rule 15: while a grown-up has location sharing or the home cameras on, the child sees it here. */}
        <GuardianChips />
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
            <KixBubble raised style={{ padding: "16px 20px", fontSize: 20, lineHeight: "28px", fontWeight: 700, display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ display: "block" }}>{next.line}</span>
              <span style={{ display: "block", fontSize: 15, lineHeight: "21px", fontWeight: 600, color: "var(--ink-muted)" }}>{next.why}</span>
              {stepCta && (
                <ButtonLink href={stepCta.href!} variant="secondary" style={{ alignSelf: "flex-start", marginTop: 4 }}>
                  {stepCta.cta}
                </ButtonLink>
              )}
            </KixBubble>
          </section>

          <GlassPanel as="article" className="hm-quest" ring="accent" raised radius="xl" blur={18} style={{ minHeight: 216 }}>
            <div className="hm-quest-text" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              <span style={{ alignSelf: "flex-start", padding: "2px 12px", borderRadius: "var(--radius-pill)", background: "var(--accent-2)", color: "var(--on-accent-2)", fontSize: 14, lineHeight: "22px", fontWeight: 800 }}>
                Today&apos;s quest
              </span>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 34, lineHeight: "38px" }}>{quest.title}</h2>
              <span style={{ fontSize: 16, lineHeight: "22px", fontWeight: 700, color: "var(--ink-muted)" }}>
                {quest.questions} {quest.questions === 1 ? "question" : "questions"} · about {quest.minutes} minutes · {quest.evidence.replace(/\.$/, "").toLowerCase()}
              </span>
            </div>
            <ButtonLink href={quest.href} className="hm-quest-cta">
              {quest.mastered >= quest.total ? "See the quest" : quest.started ? "Continue the quest" : "Start today's quest"}
            </ButtonLink>
            <div className="hm-quest-ring" style={{ display: "grid", placeItems: "center", borderRadius: "var(--radius-lg)", background: "var(--surface-raised)", boxShadow: "inset 0 0 0 1px var(--line)" }}>
              <div className="hm-ring" role="img" aria-label={`${quest.mastered} of ${quest.total} stops mastered`} style={{ borderRadius: "50%", display: "grid", placeItems: "center", background: `conic-gradient(var(--accent) ${pct}%, var(--line) 0)` }}>
                <span className="hm-ring-core" style={{ borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--surface-raised)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(18px, 2vw, 26px)" }}>
                  {quest.mastered}/{quest.total}
                </span>
              </div>
            </div>
          </GlassPanel>

          <div className="hm-cards">
            <GlassPanel as="article" className="hm-card" style={CARD}>
              <h2 style={CARD_TITLE}>Pip the {pip.name}</h2>
              <div role="img" aria-label={`Frog life cycle: Pip is a ${pip.name}${pip.next ? `, ${pip.next.name} next` : ""}`} style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
                {FRAMES.map((frame, i) => (
                  <span key={frame} className={`hm-sheet ${frame}`} style={{ height: 60, borderRadius: "var(--radius-sm)", ...frameStyle(i, pip.stage) }} />
                ))}
              </div>
              <span className="hm-cap" style={CAPTION}>{pip.next ? `Now a ${pip.name}. Next: ${pip.next.name}.` : "All grown up!"}</span>
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ height: 10, borderRadius: "var(--radius-pill)", background: "var(--line)", overflow: "hidden" }}>
                  <div style={{ width: `${(pip.stage / 3) * 100}%`, height: 10, background: "var(--accent)" }} />
                </div>
                <span style={{ fontSize: 14, lineHeight: "20px", fontWeight: 700 }} title={pip.next?.needs}>
                  {pip.next ? `To grow: ${GROW[pip.stage] ?? pip.next.needs}` : "Every stage reached"}
                </span>
              </div>
              <ButtonLink href="/critters" variant="secondary" style={{ width: "100%" }}>
                Visit Pip
              </ButtonLink>
            </GlassPanel>

            <GlassPanel as="article" className="hm-card" style={CARD}>
              <h2 style={CARD_TITLE}>Sky Squadron</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                {squadron.all.map((jet) => {
                  const earned = squadron.unlocked.includes(jet);
                  return (
                    <Art
                      key={jet}
                      base={JET_ART[jet]?.art ?? "/art/jets/dragonfly"}
                      alt={`${jetName(jet)} jet, ${earned ? "earned" : "locked"}`}
                      sizes="(max-width: 599px) 40vw, 160px"
                      style={{ width: "100%", height: 62, objectFit: "cover", borderRadius: "var(--radius-sm)", display: "block", ...(earned ? null : { filter: "grayscale(1) brightness(0.55)" }) }}
                    />
                  );
                })}
              </div>
              <span className="hm-cap" style={CAPTION}>
                {squadron.unlocked.length} of {squadron.all.length} jets.
                {squadron.next ? ` ${jetName(squadron.next.jet)} is ${squadron.next.need - squadron.next.have} fresh ${squadron.next.need - squadron.next.have === 1 ? "question" : "questions"} away.` : " The whole squadron!"}
              </span>
              <ButtonLink href="/squadron" variant="secondary" style={{ marginTop: "auto", width: "100%" }}>
                See the squadron
              </ButtonLink>
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
              <ButtonLink href="/vibe" variant="secondary" style={{ marginTop: "auto", width: "100%" }}>
                Make something
              </ButtonLink>
            </GlassPanel>
          </div>

          {/* Kid navigation lives in the shared shell (components/nav/KidNav.tsx), mounted in app/(kid)/layout.tsx. */}
        </div>
      </div>
      <TerrariumScene className="hm-scene" />
    </div>
  );
}
