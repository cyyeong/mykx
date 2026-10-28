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

/** The newest unread message from a grown-up, for Home's chip (the family thread itself is on /messages). */
async function newestMessage(ctx: LearnContext): Promise<HomeData["message"]> {
  const unread = await ctx.store.family.unread(ctx.householdId, ctx.kidId);
  const last = unread[unread.length - 1];
  if (!last) return null;
  const from = (await ctx.store.family.grownUps(ctx.householdId)).find((g) => g.id === last.from)?.nickname || "your grown-up";
  return { from, preview: last.body, sticker: last.sticker, count: unread.length };
}

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
  const message = await newestMessage(ctx).catch(() => null);
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
    message,
    next: status
      ? { kind: status.next.kind, line: status.next.line, why: status.next.why, href: status.next.href, cta: status.next.cta }
      : { kind: "learn", line: `Ready for ${FROG_QUEST.title}?`, why: "Today's learning comes first.", href: `/learn/${FROG_QUEST.slug}`, cta: "Start today's quest" },
  };
}
