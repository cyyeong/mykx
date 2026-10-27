// Dates on the account screens, in the viewer's own time zone: "today 7:42 pm", "yesterday", "Tue 9:12 am", "3 Oct".
const TIME = new Intl.DateTimeFormat("en-SG", { hour: "numeric", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short" });
const DAY_YEAR = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric" });
const WEEKDAY = new Intl.DateTimeFormat("en-SG", { weekday: "short" });

function daysAgo(d: Date, now: Date): number {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A moment: "today 7:42 pm", "yesterday 8:05 pm", "Mon 9:12 am" (this week), "3 Oct", "3 Oct 2025". */
export function whenLabel(iso: string | null | undefined, now = new Date()): string | null {
  const d = parse(iso);
  if (!d) return null;
  const ago = daysAgo(d, now);
  if (ago === 0) return `today ${TIME.format(d)}`;
  if (ago === 1) return `yesterday ${TIME.format(d)}`;
  if (ago > 1 && ago < 7) return `${WEEKDAY.format(d)} ${TIME.format(d)}`;
  return d.getFullYear() === now.getFullYear() ? DAY.format(d) : DAY_YEAR.format(d);
}

/** A day only: "today", "yesterday", "3 Oct". */
export function dayLabel(iso: string | null | undefined, now = new Date()): string | null {
  const d = parse(iso);
  if (!d) return null;
  const ago = daysAgo(d, now);
  if (ago === 0) return "today";
  if (ago === 1) return "yesterday";
  return d.getFullYear() === now.getFullYear() ? DAY.format(d) : DAY_YEAR.format(d);
}

/** Capitalised for the start of a table cell or a fact. */
export const upperFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
