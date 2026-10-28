// Server only: Home's numbers from the learner record (stars, today's quest, Pip, the squadron) and the
// guardian's next step. Deterministic code only; nothing here is a model's guess (rule 5).
import { subskillKey } from "../domain/attempts.ts";
import { companion, milestonesFrom, STAGES } from "../domain/companion.ts";
import { recompute } from "../domain/mastery.ts";
import { freshSuccesses, JETS, squadron } from "../domain/squadron.ts";
import { sgDate } from "../domain/time.ts";
import { loadKidStatus } from "../guardian/load.ts";
import type { HomeData } from "../../components/screens/home/HomeScreen.tsx";
import { FROG_QUEST, questEvidence, questStops, sessionPicks } from "./frog-quest.ts";
import { questData, type LearnContext } from "./server.ts";

export async function homeData(ctx: LearnContext): Promise<HomeData> {
  const { items, attempts, ledger } = await questData(ctx);
  const now = new Date().toISOString();
  const today = sgDate(now);
  const picks = sessionPicks(items, attempts, now, `${ctx.kidId}:${today}`);
  const stops = questStops(
    FROG_QUEST.stops.map((s) => s.itemId),
    attempts,
    picks.map((p) => p.items[0]?.id).filter((id): id is string => Boolean(id)),
  );
  const subs = [...new Set(items.map((i) => subskillKey(i)))];
  const mastery = subs.map((sub) => recompute(attempts.filter((a) => subskillKey(a) === sub), now));
  const pip = companion({ species: "frog", ledger, milestones: milestonesFrom(attempts, mastery), now });
  const sq = squadron({ successes: freshSuccesses(attempts), ledger, now });
  const kid = await ctx.store.kid(ctx.householdId, ctx.kidId);
  const status = kid ? await loadKidStatus(ctx.store, ctx.householdId, kid, now).catch(() => null) : null;
  return {
    nickname: ctx.nickname,
    stars: ledger.filter((e) => e.kind === "stars").reduce((n, e) => n + e.amount, 0),
    quest: {
      title: FROG_QUEST.title,
      href: `/learn/${FROG_QUEST.slug}`,
      mastered: stops.filter((s) => s.state === "mastered").length,
      total: stops.length,
      questions: Math.max(1, picks.length),
      minutes: Math.max(1, picks.length) * 3,
      evidence: questEvidence(attempts).label,
      started: attempts.length > 0,
    },
    pip: { stage: pip.stage, name: STAGES.frog[pip.stage], next: pip.next ? { name: pip.next.name, needs: pip.next.needs } : null },
    squadron: { unlocked: sq.unlocked, all: [...JETS], next: sq.next },
    next: status
      ? { kind: status.next.kind, line: status.next.line, why: status.next.why, href: status.next.href, cta: status.next.cta }
      : { kind: "learn", line: `Ready for ${FROG_QUEST.title}?`, why: "Today's learning comes first.", href: `/learn/${FROG_QUEST.slug}`, cta: "Start today's quest" },
  };
}
