// After a session (the quest's done page calls this), the Memory Keeper: one Muse Spark call (Standard) reads only
// the kid's own words to Kix since the last reading, with the session's numbers and the current Notebook pages. It
// returns a mood reading for the grown-up (a possibility with the words behind it, rule 12) and short Notebook
// patches, applied in code that refuses any label or diagnosis (rule 11). Family messages never come here. Never
// touches mastery or rewards (rule 5). Without a key, or if the model fails, the deterministic word reading stands
// in and the Notebook is left alone. Its instructions are the published version (editable in Under the hood),
// with fixed guardrails (lib/agents).
import { instructionsFor } from "@/lib/agents/runtime";
import { currentKid, currentParent, withAuth } from "@/lib/auth/context";
import { fail, ok } from "@/lib/auth/http";
import type { StoredSessionRead } from "@/lib/auth/store";
import { toMs } from "@/lib/domain/time";
import { moodFromWords } from "@/lib/guardian/words";
import { hasMetaApiKey } from "@/lib/meta/client";
import { sparkStructured } from "@/lib/meta/spark";
import { applyPatches, PAGES, type PageSlug } from "@/lib/notebook/notebook";
import { memoryKeeperVars, sessionClosePrompt, sessionReadSchema } from "@/lib/notebook/session-close";
import { logRunsFor } from "@/lib/runs/log";

const WINDOW_MS = 3 * 3_600_000;

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    const kid = await currentKid(store, jar, parent);
    if (!kid) return fail(401, "no-kid");
    const h = kid.householdId;
    logRunsFor("memory-keeper", h, kid.id);
    const now = new Date().toISOString();
    const windowStart = new Date(toMs(now) - WINDOW_MS).toISOString();
    const reads = await store.notebook.reads(h, kid.id, windowStart);
    const last = reads[reads.length - 1] ?? null;
    const since = last && last.sessionEnd > windowStart ? last.sessionEnd : windowStart;
    const words = (await store.guardian.messages(h, kid.id, since)).filter((m) => m.at > since && !m.synthetic);
    if (!words.length) return ok({ read: last, notebook: 0, source: "none" });

    const sessionStart = words[0].at;
    const attempts = (await store.learn.attempts(h, kid.id)).filter((a) => a.at >= sessionStart);
    const stats = [
      `Questions answered: ${attempts.length}; right first time: ${attempts.filter((a) => a.firstTry && a.marks === a.maxMarks).length}; hints opened: ${attempts.reduce((n, a) => n + a.hintsBeforeSubmit, 0)}.`,
      `Words to Kix: ${words.length}; distress words matched by the safety check: ${words.some((w) => w.distress) ? "yes" : "no"}.`,
    ].join("\n");
    const fallback = (): StoredSessionRead => {
      const m = moodFromWords(words.map((w) => w.text));
      return { sessionStart, sessionEnd: now, mood: m?.mood ?? "calm", confidence: "low", evidence: m?.evidence.slice(0, 3) ?? [], concern: words.some((w) => w.distress || w.selfTalk) };
    };

    if (!hasMetaApiKey()) {
      const read = fallback();
      await store.notebook.saveRead(h, kid.id, read);
      return ok({ read, notebook: 0, source: "words" });
    }
    try {
      const pages = Object.fromEntries((await store.notebook.pages(h, kid.id)).map((p) => [p.slug, p.body])) as Partial<Record<PageSlug, string>>;
      const who = { nickname: kid.nickname, level: kid.level, band: kid.band };
      const head = await instructionsFor("memory-keeper", memoryKeeperVars(who), { store });
      const { data } = await sparkStructured(
        {
          messages: [
            { role: "system", content: sessionClosePrompt({ ...who, stats, pages }, head) },
            { role: "user", content: words.map((w) => `- ${w.text}`).join("\n") },
          ],
          schema: sessionReadSchema,
          schemaName: "memory_keeper",
          reasoningEffort: "low",
        },
        { timeoutMs: 30_000, signal: request.signal },
      );
      // The deterministic safety check outranks the model: a distress word is always a concern.
      const read: StoredSessionRead = { sessionStart, sessionEnd: now, mood: data.mood, confidence: data.confidence, evidence: data.evidence, concern: data.concern || words.some((w) => w.distress) };
      await store.notebook.saveRead(h, kid.id, read);
      const { changed, refusedPatches } = applyPatches(pages, data.patches, now.slice(0, 10));
      for (const slug of PAGES) {
        const body = changed[slug];
        if (body === undefined) continue;
        const reason = data.patches.filter((p) => p.page === slug && !refusedPatches.includes(p)).map((p) => p.reason).join("; ").slice(0, 200) || null;
        await store.notebook.write(h, kid.id, slug, body, "memory-keeper", reason);
      }
      return ok({ read, notebook: Object.keys(changed).length, refused: refusedPatches.length, source: "spark" });
    } catch {
      const read = fallback();
      await store.notebook.saveRead(h, kid.id, read);
      return ok({ read, notebook: 0, source: "words" });
    }
  });
}
