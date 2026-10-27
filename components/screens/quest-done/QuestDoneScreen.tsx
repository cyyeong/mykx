// Quest complete (Junior, Dreamlight): the quest has an ending (K-27). Server
// component: every number comes from the learner record, computed in the page.
// This is the reward moment: the living background, the earned card revealed,
// Pip's stage, then the buttons. It says "Quest complete" only when every stop
// is mastered; otherwise the session is done and the quest continues.
import { Critters } from "@/components/scene/Critters";
import { LivingArt } from "@/components/scene/LivingArt";
import { Art } from "@/components/ui/Art";
import { ButtonLink } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { KixBubble } from "@/components/ui/KixBubble";
import type { LivingArtData } from "@/lib/scene/livingArt";
import questMapLiving from "@/public/art/living/quest-map.json";

export interface DoneLine {
  label: string;
  before: string;
  after: string;
}

export interface DoneCard {
  title: string;
  note: string;
}

export interface QuestDoneProps {
  questTitle: string;
  questSlug: string;
  /** Every stop mastered, not just today's session done. */
  complete: boolean;
  attempted: number;
  total: number;
  correct: number;
  hints: number;
  starsToday: number;
  capReached: boolean;
  /** The card this session earned, if any. */
  card: DoneCard | null;
  lines: DoneLine[];
  pipLine: string;
  evidenceLabel: string;
}

export function QuestDoneScreen({ questTitle, questSlug, complete, attempted, total, correct, hints, starsToday, capReached, card, lines, pipLine, evidenceLabel }: QuestDoneProps) {
  return (
    <div
      data-theme="dreamlight"
      data-band="junior"
      style={{ width: "100%", minHeight: "100vh", boxSizing: "border-box", position: "relative", overflow: "clip", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}
    >
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <LivingArt data={questMapLiving as LivingArtData} />
      </div>
      <div style={{ position: "relative", maxWidth: 720, margin: "0 auto", padding: "32px 20px calc(32px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Art
            base="/art/kix/dreamlight"
            alt="Kix cheering"
            sizes="72px"
            style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", flex: "none", boxShadow: "0 0 0 3px var(--accent)" }}
          />
          <KixBubble tail="start" style={{ padding: "12px 16px", fontSize: 20, lineHeight: "28px", fontWeight: 700 }}>
            {complete ? "Quest complete!" : "Session done!"} {correct} of {attempted} fresh questions right on your own.
          </KixBubble>
        </div>

        <GlassPanel as="section" aria-label="Quest summary" raised radius="xl" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 24 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 32, lineHeight: "38px" }}>
            {questTitle} — {complete ? "done" : "session done"}
          </h1>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 17, lineHeight: "24px", fontWeight: 600 }}>
            <li>
              Questions: {attempted} of {total}
            </li>
            <li>Hints opened: {hints}</li>
            <li>
              Stars today: {starsToday} of 15{capReached ? " — you've earned today's stars; your learning still counts." : ""}
            </li>
          </ul>
        </GlassPanel>

        {card && (
          <GlassPanel as="section" aria-label="Card earned" radius="xl" style={{ display: "flex", gap: 16, padding: 20, background: "var(--surface-raised)", boxShadow: "inset 0 0 0 3px var(--reward), var(--shadow-glow)" }}>
            <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 56, height: 56, flex: "none", color: "var(--reward)" }}>
              <path fill="currentColor" d="M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z" />
            </svg>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ alignSelf: "flex-start", padding: "2px 10px", borderRadius: "var(--radius-pill)", background: "var(--reward)", color: "var(--on-reward)", fontSize: 13, lineHeight: "20px", fontWeight: 800 }}>
                New card
              </span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 24, lineHeight: "28px" }}>{card.title}</span>
              <span style={{ fontSize: 15, lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>{card.note}</span>
            </div>
          </GlassPanel>
        )}

        <GlassPanel as="section" aria-label="Pip's progress" radius="xl" style={{ padding: 20 }}>
          <p style={{ margin: 0, fontSize: 17, lineHeight: "24px", fontWeight: 700 }}>{pipLine}</p>
        </GlassPanel>

        <GlassPanel as="section" aria-label="Mastery changes" radius="xl" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 24 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, lineHeight: "30px" }}>What changed</h2>
          {lines.length ? (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 16, lineHeight: "24px", fontWeight: 600 }}>
              {lines.map((line) => (
                <li key={line.label}>
                  {line.label}: {line.before} → {line.after}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: 16, lineHeight: "24px", fontWeight: 600, color: "var(--ink-muted)" }}>No new evidence this time — retries are practice.</p>
          )}
          <p style={{ margin: 0, fontSize: 14, lineHeight: "20px", fontWeight: 600, color: "var(--ink-muted)" }}>{evidenceLabel}</p>
        </GlassPanel>

        <nav aria-label="After the quest" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ButtonLink href={`/learn/${questSlug}`} style={{ width: "100%" }}>
            Back to the map
          </ButtonLink>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <ButtonLink href="/treasure" variant="secondary" style={{ flex: "1 1 auto" }}>
              See my Treasure
            </ButtonLink>
            <ButtonLink href="/home" variant="secondary" style={{ flex: "1 1 auto" }}>
              Home
            </ButtonLink>
          </div>
        </nav>
      </div>
      <Critters pack="dreamlight" kind="spark" count={8} />
    </div>
  );
}
