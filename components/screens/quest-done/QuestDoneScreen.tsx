// Quest complete (Junior, Dreamlight): the quest has an ending (K-27). Server
// component: every number comes from the learner record, computed in the page.
import { Art } from "@/components/ui/Art";
import { ButtonLink } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { KixBubble } from "@/components/ui/KixBubble";

export interface DoneLine {
  label: string;
  before: string;
  after: string;
}

export interface QuestDoneProps {
  questTitle: string;
  questSlug: string;
  attempted: number;
  total: number;
  correct: number;
  hints: number;
  starsToday: number;
  capReached: boolean;
  lines: DoneLine[];
  pipLine: string;
  evidenceLabel: string;
}

export function QuestDoneScreen({ questTitle, questSlug, attempted, total, correct, hints, starsToday, capReached, lines, pipLine, evidenceLabel }: QuestDoneProps) {
  return (
    <div
      data-theme="dreamlight"
      data-band="junior"
      style={{ width: "100%", minHeight: "100vh", boxSizing: "border-box", position: "relative", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px calc(32px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Art
            base="/art/kix/dreamlight"
            alt="Kix cheering"
            sizes="72px"
            style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", flex: "none", boxShadow: "0 0 0 3px var(--accent)" }}
          />
          <KixBubble tail="start" style={{ padding: "12px 16px", fontSize: 20, lineHeight: "28px", fontWeight: 700 }}>
            Quest complete! {correct} of {attempted} fresh questions right on your own.
          </KixBubble>
        </div>

        <GlassPanel as="section" aria-label="Quest summary" raised radius="xl" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 24 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 32, lineHeight: "38px" }}>{questTitle} — done</h1>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8, fontSize: 17, lineHeight: "24px", fontWeight: 600 }}>
            <li>
              Questions: {attempted} of {total}
            </li>
            <li>Hints opened: {hints}</li>
            <li>
              Stars today: {starsToday} of 15{capReached ? " — you've earned today's stars; your learning still counts." : ""}
            </li>
            <li>{pipLine}</li>
          </ul>
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
    </div>
  );
}
