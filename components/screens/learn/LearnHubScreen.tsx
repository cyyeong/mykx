// The Learn hub (Junior, Dreamlight): the kid's own subjects as islands over the quest-map sky. One job: choose a
// subject. Every number comes from the learner record (app/(kid)/learn/page.tsx, lib/learn/views.ts); a subject
// the kid's level has no pack for yet is named honestly at the foot.
import Link from "next/link";
import { LivingArt } from "@/components/scene/LivingArt";
import { Art } from "@/components/ui/Art";
import { ButtonLink } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { KixBubble } from "@/components/ui/KixBubble";
import type { SubjectView } from "@/lib/learn/views";
import type { LivingArtData } from "@/lib/scene/livingArt";
import questMapLiving from "@/public/art/living/quest-map.json";
import { SubjectEmblem } from "./SubjectEmblem";
import "./learn.css";

export interface LearnHubProps {
  nickname: string;
  level: string;
  pack: string;
  subjects: SubjectView[];
  /** School subjects with no pack at this level yet. */
  missing: string[];
  /** Kix's suggestion, from the numbers. */
  kixLine: string;
}

export function LearnHubScreen({ nickname, level, pack, subjects, missing, kixLine }: LearnHubProps) {
  return (
    <div className="ln-root" data-theme="dreamlight" data-band="junior">
      <div className="ln-bg" aria-hidden="true">
        <Art base="/art/scenes/quest-map" alt="" className="ln-bg-img" fetchPriority="high" />
        <LivingArt data={questMapLiving as LivingArtData} />
      </div>
      <div className="ln-wrap">
        <GlassPanel as="header" className="ln-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/wordmark-on-dark.svg" alt="myKx" style={{ height: 24, width: "auto", alignSelf: "flex-start" }} />
          <h1 className="ln-h1">Where shall we learn today, {nickname}?</h1>
          <p className="ln-sub">
            {level} · {subjects.length} {subjects.length === 1 ? "subject" : "subjects"}
          </p>
        </GlassPanel>

        <div className="ln-kix">
          <Art base={`/art/kix/${pack}`} alt="Kix" sizes="72px" className="ln-kix-img" />
          <KixBubble tail="start" className="ln-kix-bubble">
            {kixLine}
          </KixBubble>
        </div>

        <ul className="lh-grid" aria-label="Your subjects">
          {subjects.map((s) => {
            const pct = s.topics.length ? Math.round((s.started / s.topics.length) * 100) : 0;
            return (
              <li key={s.id}>
                <GlassPanel raised radius="xl" className="lh-tile">
                  <div className="lh-tile-top">
                    <SubjectEmblem subject={s.subject} size={64} />
                    <div className="lh-tile-name">
                      <h2>{s.name}</h2>
                      <span>{s.title}</span>
                    </div>
                  </div>
                  <div className="lh-progress">
                    <div className="lh-progress-row">
                      <span>
                        {s.started} of {s.topics.length} topics started
                      </span>
                    </div>
                    <div className="lh-bar" role="img" aria-label={`${s.started} of ${s.topics.length} topics started`}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <p className="lh-evidence">{s.evidence}</p>
                  </div>
                  <p className="lh-next">
                    {s.next ? (
                      <>
                        Next: <strong>{s.next.topic ?? s.name}</strong> · {s.next.count} {s.next.count === 1 ? "question" : "questions"}
                      </>
                    ) : (
                      s.empty
                    )}
                  </p>
                  {s.featured && (
                    <Link href={s.featured.href} className="lh-featured">
                      <Art base="/art/cards/gecko-and-frog" alt="" sizes="56px" className="lh-featured-art" />
                      <span>
                        <strong>{s.featured.title}</strong>
                        <span>
                          Quest map · {s.featured.mastered} of {s.featured.total} stops
                        </span>
                      </span>
                    </Link>
                  )}
                  <ButtonLink href={`/learn/${s.id}`} className="lh-open">
                    Open {s.name}
                  </ButtonLink>
                </GlassPanel>
              </li>
            );
          })}
        </ul>
        {missing.length > 0 && (
          <p className="ln-gap">
            {level} {missing.join(" and ")} {missing.length === 1 ? "is" : "are"} on the way.
          </p>
        )}
      </div>
    </div>
  );
}
