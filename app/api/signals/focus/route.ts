// The focus camera's counts and notes (docs/prd/PARENT_INSIGHTS.md §1, AGENTS.md rule 12).
//   POST:   the signed-in kid's per-minute counts, plus the browser's "possibly losing focus" reading when it has
//           one. Strict schema: anything that isn't counts is refused. The server checks a reading against the
//           counts it holds with the same pure rule (lib/signals/focus.ts) and keeps its own words, never the
//           browser's. Refused when the grown-up has the camera off, so switching it off stops the camera too.
//   GET:    the grown-up's notes from the last 7 days, for Your family.
//   DELETE: a grown-up removes a note (PARENT_INSIGHTS §4.5).
// Images, video and landmarks never arrive here: the browser keeps them. Signals never touch mastery or rewards.
import { currentParent, withAuth } from "@/lib/auth/context";
import { requireFamily } from "@/lib/auth/guard";
import { fail, ok, readBody } from "@/lib/auth/http";
import type { AuthStore } from "@/lib/auth/store";
import { DIP_MINUTES, MINUTE_MS, canNudge, detectFocusDip, focusBaseline, type FocusMinute } from "@/lib/signals/focus";
import { focusDeleteBody, focusPostBody, type FocusNotesResult, type FocusPostResult } from "@/lib/signals/schemas";
import type { z } from "zod";

const DAY_MS = 86_400_000;
/** The baseline reads the kid's last two weeks of minutes (PARENT_INSIGHTS §1). */
const BASELINE_DAYS = 14;
const NOTES_DAYS = 7;
/** Minutes older than this, or from the future (beyond clock skew), are refused: a stale or made-up batch. */
const MAX_AGE_MS = 6 * 3_600_000;
const SKEW_MS = 2 * MINUTE_MS;
/** The browser sends about one call a minute per kid; this leaves room for retries and a second device. */
const PER_MINUTE = 12;

type Reading = NonNullable<z.infer<typeof focusPostBody>["signal"]>;

/** Stores a note only if the server's own counts show the same dip, at least 10 minutes after the last note. */
async function noteIfConfirmed(store: AuthStore, householdId: string, kidId: string, history: FocusMinute[], reading: Reading): Promise<boolean> {
  const from = Date.parse(reading.from);
  const to = Date.parse(reading.to);
  if (to - from !== DIP_MINUTES * MINUTE_MS) return false;
  const run = history.filter((m) => Date.parse(m.minute) < to);
  const found = detectFocusDip(run, focusBaseline(history, reading.from), { after: reading.from });
  if (!found || Date.parse(found.from) !== from) return false;
  const latest = await store.signals.latestFocusNote(householdId, kidId);
  if (latest && !canNudge(Date.parse(latest.from), from)) return false;
  const saved = await store.signals.saveFocusNote(householdId, kidId, { from: found.from, to: found.to, evidence: found.evidence, confidence: found.confidence });
  return saved !== null;
}

export async function POST(request: Request) {
  return withAuth(request, async ({ store }) => {
    const family = await requireFamily(request, "focus", PER_MINUTE);
    if (family.refused) return family.refused;
    const kid = family.kid;
    if (!kid) return fail(401, "no-kid");
    if (!kid.cameraEnabled) return fail(403, "not-allowed");
    const body = await readBody(request, focusPostBody);
    if (!body) return fail(400, "invalid");
    const now = Date.now();
    const outOfRange = (iso: string) => {
      const t = Date.parse(iso);
      return t < now - MAX_AGE_MS || t > now + SKEW_MS;
    };
    if (body.minutes.some((m) => outOfRange(m.minute)) || (body.signal && outOfRange(body.signal.from))) return fail(400, "invalid");

    await store.signals.saveFocusMinutes(family.householdId, kid.id, body.minutes);
    const history = await store.signals.focusMinutes(family.householdId, kid.id, new Date(now - BASELINE_DAYS * DAY_MS).toISOString());
    const noted = body.signal ? await noteIfConfirmed(store, family.householdId, kid.id, history, body.signal) : false;
    return ok({ saved: body.minutes.length, noted, baseline: focusBaseline(history) } satisfies FocusPostResult);
  });
}

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const notes = await store.signals.focusNotes(parent.householdId, new Date(Date.now() - NOTES_DAYS * DAY_MS).toISOString());
    return ok({ notes } satisfies FocusNotesResult);
  });
}

export async function DELETE(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const parent = await currentParent(store, jar);
    if (!parent) return fail(401, "no-parent");
    const body = await readBody(request, focusDeleteBody);
    if (!body) return fail(400, "invalid");
    const kidId = await store.signals.removeFocusNote(parent.householdId, body.id);
    if (!kidId) return fail(404, "not-found");
    await store.audit({ actor: parent.profile.id, actorRole: "parent", action: "signal.remove", target: kidId, householdId: parent.householdId, detail: { kind: "focus-watch" } });
    return ok({});
  });
}
