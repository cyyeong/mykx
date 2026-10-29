// A subject (Junior, Dreamlight): its real topics as a trail of stops, each glowing with the kid's own mastery
// (never a number without evidence), and one big Start session. Code chose the session (lib/learn/session.ts) and
// Kix says why. A topic opens to its skills and can start a session on that topic alone. P3 Science also shows its
// featured quest, the frog life cycle map. Every number comes from lib/learn/views.ts.
import Link from "next/link";
import { LivingArt } from "@/components/scene/LivingArt";
import { Art } from "@/components/ui/Art";
import { ButtonLink } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { KixBubble } from "@/components/ui/KixBubble";
import { QuestNode, type QuestNodeState } from "@/components/ui/QuestNode";
import type { SubjectView, TopicCard } from "@/lib/learn/views";
import type { LivingArtData } from "@/lib/scene/livingArt";
import questMapLiving from "@/public/art/living/quest-map.json";
import { SubjectEmblem } from "./SubjectEmblem";
import "./learn.css";

/**
 * A topic's stop: gold once it holds (70+ with developing evidence); a ring filled to its mastery once assessed
 * (never a number without evidence); a play stop while it's new; muted when it has no questions yet. Today's topic
 * (the session's first question) is the only one that glows and pulses.
 */
function stateOf(t: TopicCard): QuestNodeState {
  if (t.questions + t.written + t.cards === 0) return "locked";
  if (t.mastery !== null && t.mastery >= 70 && t.families >= 5) return "mastered";
  if (t.mastery !== null) return "current";
  return "next";
}

function readyLine(t: TopicCard): string {
  const parts = [t.questions && `${t.questions} ${t.questions === 1 ? "question" : "questions"}`, t.cards && `${t.cards} word cards`, t.written && `${t.written} written`].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Questions on the way";
}

export function SubjectScreen({ view, pack }: { view: SubjectView; pack: string }) {
  const next = view.next;
  const total = view.counts.questions + view.counts.cards + view.counts.written;
  return (
    <div className="ln-root" data-theme="dreamlight" data-band="junior">
      <div className="ln-bg" aria-hidden="true">
        <Art base="/art/scenes/quest-map" alt="" className="ln-bg-img" fetchPriority="high" />
        <LivingArt data={questMapLiving as LivingArtData} />
      </div>
      <div className="ln-wrap ls-wrap">
        <GlassPanel as="header" className="ln-head ls-head">
          <Link href="/learn" className="ls-back">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All subjects
          </Link>
          <div className="ls-title">
            <SubjectEmblem subject={view.subject} size={56} />
            <div>
              <span className="ls-chip">{view.label}</span>
              <h1 className="ln-h1">{view.name}</h1>
            </div>
          </div>
          <p className="ln-sub">
            {view.started} of {view.topics.length} topics started · {total} {total === 1 ? "question" : "questions"} ready
          </p>
        </GlassPanel>

        <GlassPanel as="section" className="ls-trail" aria-label={`${view.name} topics`} radius="xl">
          <h2 className="ls-h2">Topics</h2>
          <ol className="ls-topics">
            {view.topics.map((t) => {
              const state = stateOf(t);
              const today = t.id === next?.topicId;
              return (
                <li key={t.id} className={`ls-topic ls-topic--${state}${today ? " ls-topic--today" : ""}`}>
                  <QuestNode state={state} mastery={t.mastery} className="ls-node" />
                  <details className="ls-detail">
                    <summary>
                      <span className="ls-topic-title">{t.title}</span>
                      {today && <span className="ls-today">Today&apos;s session starts here</span>}
                      <span className="ls-topic-note">
                        {t.mastery !== null ? `${t.mastery} · ` : ""}
                        {t.evidence} · {readyLine(t)}
                      </span>
                    </summary>
                    <ul className="ls-skills" aria-label={`${t.title} skills`}>
                      {t.subskills.map((s) => (
                        <li key={s.id}>
                          <span>{s.name}</span>
                          <span className="ls-skill-label">{s.label}</span>
                        </li>
                      ))}
                    </ul>
                    {t.startHref ? (
                      <ButtonLink href={t.startHref} variant="secondary" className="ls-topic-go">
                        Practise {t.title}
                      </ButtonLink>
                    ) : (
                      <p className="ls-topic-empty">{t.empty}</p>
                    )}
                  </details>
                </li>
              );
            })}
          </ol>
        </GlassPanel>

        <GlassPanel as="section" className="ls-panel" aria-label="Today's session" raised radius="xl">
          <div className="ls-kix">
            <Art base={`/art/kix/${pack}`} alt="Kix" sizes="72px" className="ln-kix-img" />
            <KixBubble tail="start" className="ln-kix-bubble">
              {next ? next.short : view.empty}
            </KixBubble>
          </div>
          <div>
            <h2 className="ls-h2">Today&apos;s {view.name} session</h2>
            {next && (
              <p className="ln-sub">
                {next.count} {next.count === 1 ? "question" : "questions"}
                {next.written ? " (one written)" : ""} · about {next.minutes} minutes
              </p>
            )}
          </div>
          {next ? (
            <ButtonLink href={next.href} className="ls-start">
              Start session
            </ButtonLink>
          ) : (
            <p className="ls-topic-empty">{view.empty}</p>
          )}
          <p className="lh-evidence">{view.evidence}</p>
          {view.gap && <p className="ln-gap ls-gap">{view.gap}</p>}
          {view.featured && (
            <Link href={view.featured.href} className="lh-featured">
              <Art base="/art/cards/gecko-and-frog" alt="" sizes="56px" className="lh-featured-art" />
              <span>
                <strong>{view.featured.title}</strong>
                <span>
                  Quest map · {view.featured.mastered} of {view.featured.total} stops
                </span>
              </span>
            </Link>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
