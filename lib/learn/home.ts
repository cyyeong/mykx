// Server only: Home's numbers from the learner record (stars, today's quest, Pip, the squadron) and the
// guardian's next step. Deterministic code only; nothing here is a model's guess (rule 5).
// Today's quest is the frog life cycle for a kid whose subjects include P3 Science (its featured quest); any other
// junior gets their first subject's next session, so Home never offers another level's work.
import { subskillKey } from "../domain/attempts.ts";
import { companion, milestonesFrom, STAGES } from "../domain/companion.ts";
import { recompute } from "../domain/mastery.ts";
import { freshSuccesses, JETS, squadron } from "../domain/squadron.ts";
import { sgDate } from "../domain/time.ts";
import { loadKidStatus } from "../guardian/load.ts";
import type { HomeData } from "../../components/screens/home/HomeScreen.tsx";
import { FROG_QUEST, questEvidence, questStops, sessionPicks } from "./frog-quest.ts";
import { questData, type LearnContext } from "./server.ts";
import { subjectsFor } from "./subjects.ts";
import { subjectView } from "./views.ts";

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
  const seed = `${ctx.kidId}:${today}`;
  const subjects = subjectsFor(ctx.level);
  let quest: HomeData["quest"];
  if (subjects.some((s) => s.id === FROG_QUEST.skill)) {
    const picks = sessionPicks(items, attempts, now, seed);
    const stops = questStops(
      FROG_QUEST.stops.map((s) => s.itemId),
      attempts,
      picks.map((p) => p.items[0]?.id).filter((id): id is string => Boolean(id)),
    );
    quest = {
      title: FROG_QUEST.title,
      href: `/learn/${FROG_QUEST.slug}`,
      mastered: stops.filter((s) => s.state === "mastered").length,
      total: stops.length,
      questions: Math.max(1, picks.length),
      minutes: Math.max(1, picks.length) * 3,
      evidence: questEvidence(attempts).label,
      started: attempts.length > 0,
    };
  } else {
    const view = subjects[0] ? subjectView(subjects[0], attempts, now, seed, ctx.pack) : null;
    quest = {
      title: view ? view.label : "Learn",
      href: view ? `/learn/${view.id}` : "/learn",
      mastered: view?.started ?? 0,
      total: view?.topics.length ?? 0,
      questions: Math.max(1, view?.next?.count ?? 1),
      minutes: view?.next?.minutes ?? 3,
      evidence: view?.evidence ?? "No subjects yet.",
      started: attempts.length > 0,
    };
  }
  // Pip grows from learning in any subject: every skill the kid has evidence in.
  const subs = [...new Set(attempts.map((a) => subskillKey(a)))];
  const mastery = subs.map((sub) => recompute(attempts.filter((a) => subskillKey(a) === sub), now));
  const pip = companion({ species: "frog", ledger, milestones: milestonesFrom(attempts, mastery), now });
  const sq = squadron({ successes: freshSuccesses(attempts), ledger, now });
  const kid = await ctx.store.kid(ctx.householdId, ctx.kidId);
  const status = kid ? await loadKidStatus(ctx.store, ctx.householdId, kid, now).catch(() => null) : null;
  const message = await newestMessage(ctx).catch(() => null);
  return {
    nickname: ctx.nickname,
    stars: ledger.filter((e) => e.kind === "stars").reduce((n, e) => n + e.amount, 0),
    quest,
    pip: { stage: pip.stage, name: STAGES.frog[pip.stage], next: pip.next ? { name: pip.next.name, needs: pip.next.needs } : null },
    squadron: { unlocked: sq.unlocked, all: [...JETS], next: sq.next },
    message,
    next: status
      ? { kind: status.next.kind, line: status.next.line, why: status.next.why, href: status.next.href, cta: status.next.cta }
      : { kind: "learn", line: `Ready for ${quest.title}?`, why: "Today's learning comes first.", href: quest.href, cta: "Start today's quest" },
  };
}
