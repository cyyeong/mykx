// Home watch alerts (docs/prd/GUARDIAN.md §2.2): deterministic rules over the Home Reader's readings, tested. The
// model's own "concern" is one input; these rules decide. Each "not right" from the parent for a kind of alert on a
// camera, in the last 14 days, makes that rule need one more matching check (the same pattern as the focus camera).
import type { HomeAlert, HomeStatus, RoomReading } from "./home-watch.ts";

export type AlertDraft = Pick<HomeAlert, "level" | "kind" | "reason" | "confidence">;

const URGENT_HAZARDS = new Set(["child near an open window or ledge", "fire or smoke", "child lying still on the floor"]);
const WATCH_HAZARDS = new Set(["child near a lit stove"]);
const REPEAT_MINUTES = 10;

/**
 * The alert this reading raises, if any. `recent` is the same camera's statuses from the last 10 minutes, newest
 * first, not including this one; `burst` is true when the frame came in a burst of three; `softened` holds the alert
 * kinds the parent marked "not right" on this camera lately; `lastAlerts` are this camera's recent alerts (no repeat
 * of the same kind within 10 minutes).
 */
export function alertFor(o: { at: string; reading: RoomReading; recent: readonly HomeStatus[]; burst: boolean; softened: ReadonlySet<string>; lastAlerts: readonly Pick<HomeAlert, "kind" | "at">[] }): AlertDraft | null {
  const { reading: r } = o;
  const repeat = (kind: string) => o.lastAlerts.some((a) => a.kind === kind && Date.parse(o.at) - Date.parse(a.at) < REPEAT_MINUTES * 60_000);
  const raise = (d: AlertDraft) => (repeat(d.kind) ? null : d);
  const extra = (kind: string) => (o.softened.has(kind) ? 1 : 0);

  if (URGENT_HAZARDS.has(r.hazard)) return raise({ level: "urgent", kind: "hazard", reason: r.reason, confidence: r.confidence });
  if (WATCH_HAZARDS.has(r.hazard)) return raise({ level: "watch", kind: "hazard", reason: r.reason, confidence: r.confidence });

  const lastThree = [r, ...o.recent.slice(0, 2).map((s) => s.reading)];
  const conflicts = lastThree.filter((x) => x.activity === "physical conflict").length;
  if (r.activity === "physical conflict") {
    if (conflicts >= 2 + extra("conflict") || (o.burst && !o.softened.has("conflict"))) return raise({ level: "urgent", kind: "conflict", reason: r.reason, confidence: r.confidence });
    if (conflicts >= 1 + extra("conflict") || o.burst) return raise({ level: "watch", kind: "conflict", reason: r.reason, confidence: r.confidence });
  }

  const within = (min: number) => o.recent.filter((s) => Date.parse(o.at) - Date.parse(s.at) <= min * 60_000).map((s) => s.reading);
  if (r.activity === "arguing" && within(10).filter((x) => x.activity === "arguing").length + 1 >= 3 + extra("arguing")) return raise({ level: "watch", kind: "arguing", reason: r.reason, confidence: r.confidence });

  const crying = (x: RoomReading) => x.people.some((p) => p.who === "child" && p.cue === "crying");
  if (crying(r)) {
    const earlier = o.recent.filter((s) => crying(s.reading) && Date.parse(o.at) - Date.parse(s.at) >= 5 * 60_000);
    if (earlier.length + 1 >= 2 + extra("crying")) return raise({ level: "watch", kind: "crying", reason: r.reason, confidence: r.confidence });
  }

  // Muse's own sense that something needs a look still reaches the parent, but only as "watch".
  if (r.concern === "urgent" && r.confidence >= 0.6 && !o.softened.has("muse")) return raise({ level: "watch", kind: "muse", reason: r.reason, confidence: r.confidence });
  return null;
}
