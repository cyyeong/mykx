// A finished typing round (GAMES.md §3): the server checks the level is open, scores it with the deterministic
// rules (lib/games/typing/score.ts: ★ finish, ★★ 90 % right, ★★★ 96 %, teens also need the speed) and saves the
// kid's progress. Game stars are not the reward ledger and never mastery evidence (rule 5).
import { z } from "zod";
import { currentKid, currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { applyRound, emptyProgress, isOpen } from "@/lib/games/progress";
import { GAMES } from "@/lib/games/registry";
import { startingStage } from "@/lib/games/typing/curriculum";
import { PLAYABLE_STAGES } from "@/lib/games/typing/levels";

const tally = z.strictObject({ hits: z.number().int().min(0).max(2000), misses: z.number().int().min(0).max(2000), instead: z.record(z.string().max(1), z.number().int().min(0).max(2000)) });
const body = z.strictObject({
  game: z.string().max(40),
  stage: z.number().int().min(1).max(9),
  level: z.number().int().min(1).max(5),
  hits: z.number().int().min(0).max(5000),
  misses: z.number().int().min(0).max(5000),
  correctChars: z.number().int().min(0).max(5000),
  ms: z.number().int().min(0).max(3_600_000),
  finished: z.boolean(),
  keys: z.record(z.string().max(1), tally),
});

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    const kid = await currentKid(store, jar, parent);
    if (!kid) return fail(401, "no-kid");
    const r = await readBody(request, body);
    if (!r) return fail(400, "invalid");
    if (!GAMES.some((g) => g.id === r.game && g.status === "ready" && g.subject === "typing")) return fail(404, "not-found");
    const band = kid.band === "teen" ? "teen" : "junior";
    const now = new Date().toISOString();
    const prev = (await store.games.progress(kid.householdId, kid.id)).find((p) => p.game === r.game) ?? emptyProgress(r.game, startingStage(band), now);
    if (!isOpen(prev, r.stage, r.level) || r.stage > PLAYABLE_STAGES) return fail(409, "invalid");
    const out = applyRound(prev, r, band, PLAYABLE_STAGES, now);
    await store.games.save(kid.householdId, kid.id, out.progress);
    return ok({ stars: out.stars, accuracy: out.accuracy, wpm: out.wpm, unlocked: out.unlocked, next: { stage: out.progress.stage, level: out.progress.level } });
  });
}
