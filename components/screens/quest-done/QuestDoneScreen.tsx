// Quest complete (Junior, Dreamlight): the quest has an ending (K-27). Server
// component: every number comes from the learner record, computed in the page.
// This is the reward moment: the living background, the earned card revealed
// (or a waiting slot when none was earned), Pip on the growth track, each
// stop's before → after, then the buttons. It says "Quest complete" only when
// every stop is mastered; otherwise the session is done and the quest goes on.
import { Critters } from "@/components/scene/Critters";
import { LivingArt } from "@/components/scene/LivingArt";
import { Art } from "@/components/ui/Art";
import { ButtonLink } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { HoloCard } from "@/components/ui/HoloCard";
import { KixBubble } from "@/components/ui/KixBubble";
import type { LivingArtData } from "@/lib/scene/livingArt";
import questMapLiving from "@/public/art/living/quest-map.json";
import "./questDone.css";

/** One stop touched in this quest: mastery out of 100 before today and now (null: no evidence yet). */
export interface DoneStop {
  label: string;
  before: number | null;
  after: number | null;
}

export interface DoneCard {
  title: string;
  note: string;
  art: string;
  alt: string;
  chip: string;
}

export interface QuestDoneProps {
  questTitle: string;
  questSlug: string;
  /** Every stop mastered, not just today's session done. */
  complete: boolean;
  attempted: number;
  total: number;
  /** Stops right on the first try, with no hint. */
  correct: number;
  hints: number;
  starsToday: number;
  capReached: boolean;
  /** The card this session earned, if any. */
  card: DoneCard | null;
  stops: DoneStop[];
  /** Pip's stage index into `stageNames` (frogspawn → frog). */
  stage: number;
  stageNames: readonly string[];
  evidenceLabel: string;
}

const STAR = "M12 2Q13 11 22 12Q13 13 12 22Q11 13 2 12Q11 11 12 2Z";

function kixLine({ complete, correct, card }: Pick<QuestDoneProps, "complete" | "correct" | "card">): string {
  if (complete) return "Quest complete! Every stop glows.";
  if (card) return "Session done! Look what you earned.";
  if (correct > 0) return `Session done! ${correct} right on the first try.`;
  return "Session done! Every try makes it stick.";
}

export function QuestDoneScreen(props: QuestDoneProps) {
  const { questTitle, questSlug, complete, attempted, total, hints, starsToday, capReached, card, stops, stage, stageNames, evidenceLabel } = props;
  const stageName = stageNames[stage] ?? stageNames[0];
  const nextName = stageNames[stage + 1];
  return (
    <div
      data-theme="dreamlight"
      data-band="junior"
      className="qd-root"
      style={{ width: "100%", minHeight: "var(--screen-h, 100vh)", boxSizing: "border-box", position: "relative", overflow: "clip", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}
    >
      {/* The quest map's own sky, dimmed under a twilight veil so the reward panels lead. */}
      <div aria-hidden="true" className="qd-bg">
        <Art base="/art/scenes/quest-map" alt="" className="qd-bg-img" />
        <LivingArt data={questMapLiving as LivingArtData} />
      </div>
      <div className="qd-wrap">
        <div className="qd-kix">
          <Art
            base="/art/kix/dreamlight"
            alt="Kix cheering"
            sizes="72px"
            style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", flex: "none", boxShadow: "0 0 0 3px var(--accent)" }}
          />
          <KixBubble tail="start" style={{ padding: "12px 16px", fontSize: 20, lineHeight: "28px", fontWeight: 700 }}>
            {kixLine(props)}
          </KixBubble>
        </div>

        <section aria-label={card ? "Card earned" : "Card waiting"} className="qd-hero">
          <div className="qd-card">
            {card ? (
              <>
                <span className="qd-ribbon">New card</span>
                <HoloCard className="qd-holo" sizes="(max-width: 599px) 70vw, 260px" art={card.art} alt={card.alt} chip={card.chip} title={card.title} note={card.note} />
              </>
            ) : (
              <GlassPanel className="qd-slot" ring="control" radius="xl" blur={12}>
                <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 56, height: 56, color: "var(--ink-muted)" }}>
                  <path fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" d={STAR} />
                </svg>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 22, lineHeight: "26px" }}>Card waiting</span>
                <span style={{ fontSize: 15, lineHeight: "21px", fontWeight: 600, color: "var(--ink-muted)" }}>
                  {capReached ? "You've earned today's 15 stars. Come back tomorrow for this card." : "Get a stop right first time and say why in your own words to earn it."}
                </span>
              </GlassPanel>
            )}
          </div>

          <GlassPanel raised radius="xl" className="qd-summary">
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(28px, 5vw, 36px)", lineHeight: 1.15 }}>
              {complete ? `${questTitle}: quest complete` : questTitle}
            </h1>
            <ul className="qd-chips" aria-label="This session">
              <li>
                {attempted} of {total} stops tried
              </li>
              <li>
                {hints} {hints === 1 ? "hint" : "hints"}
              </li>
              <li className="qd-chip-stars">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d={STAR} />
                </svg>
                {starsToday} of 15 today
              </li>
            </ul>

            <div className="qd-pip" aria-label={`Pip is a ${stageName}`}>
              <div className="qd-track">
                <Art base="/art/critters/frog-life-cycle" alt="" sizes="(max-width: 599px) 90vw, 420px" style={{ width: "100%", height: "auto", display: "block" }} />
                <div className="qd-track-cols" aria-hidden="true">
                  {stageNames.map((name, i) => (
                    <span key={name} className={i === stage ? "qd-stage is-now" : i < stage ? "qd-stage is-past" : "qd-stage"} />
                  ))}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 17, lineHeight: "24px", fontWeight: 700 }}>
                Pip is a {stageName}.{nextName ? ` Next: ${nextName}.` : " All grown up!"}
              </p>
            </div>
          </GlassPanel>
        </section>

        <GlassPanel as="section" aria-label="Your stops" radius="xl" className="qd-stops">
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, lineHeight: "30px" }}>Your stops</h2>
          {stops.length ? (
            <ul>
              {stops.map((s) => {
                const grew = s.after !== null && (s.before === null || s.after > s.before);
                return (
                  <li key={s.label}>
                    <span className="qd-stop-label">{s.label}</span>
                    <span className="qd-bar" role="img" aria-label={`${s.label}: ${s.before ?? "new"} to ${s.after ?? "not yet"} out of 100`}>
                      {s.before !== null && <span className="qd-bar-before" style={{ width: `${s.before}%` }} />}
                      {s.after !== null && <span className={grew ? "qd-bar-after is-up" : "qd-bar-after"} style={{ width: `${s.after}%` }} />}
                    </span>
                    <span className="qd-stop-num">{s.after ?? "–"}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: 16, lineHeight: "24px", fontWeight: 600, color: "var(--ink-muted)" }}>No new evidence this time: retries are practice.</p>
          )}
          <span className="qd-evidence">{evidenceLabel}</span>
        </GlassPanel>

        <nav aria-label="After the quest" className="qd-nav">
          <ButtonLink href={`/learn/${questSlug}`} className="qd-nav-main">
            Back to the map
          </ButtonLink>
          <div className="qd-nav-more">
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
