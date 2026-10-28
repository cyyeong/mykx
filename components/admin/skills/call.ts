// JSON calls for the skill and knowledge admin screens. Unlike components/account/api.ts it keeps a refusal's
// `note`, `problems` (file, line, message) and `blockers`, which these screens show inline.
export interface Problem {
  path: string;
  message: string;
  line?: number;
}

export interface CallResult<T> {
  status: number;
  ok: boolean;
  data: T | null;
  reason: string | null;
  note: string | null;
  problems: Problem[];
  blockers: string[];
}

export async function call<T>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown): Promise<CallResult<T>> {
  try {
    const form = typeof FormData !== "undefined" && body instanceof FormData;
    const res = await fetch(url, {
      method,
      cache: "no-store",
      headers: body === undefined || form ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : form ? (body as FormData) : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as (T & { ok?: boolean; reason?: string; note?: string; problems?: Problem[]; blockers?: string[] }) | null;
    const ok = res.ok && json?.ok !== false;
    return { status: res.status, ok, data: ok ? json : null, reason: json?.reason ?? null, note: json?.note ?? null, problems: json?.problems ?? [], blockers: json?.blockers ?? [] };
  } catch {
    return { status: 0, ok: false, data: null, reason: null, note: "The network call failed. Try again.", problems: [], blockers: [] };
  }
}

/** Plain words for a refusal without a note. */
export function failWords(r: CallResult<unknown>, fallback: string): string {
  if (r.note) return r.note;
  if (r.status === 401 || r.status === 403) return "Admins only. Sign in as an admin (and unlock with the parent PIN if a kid is on this device).";
  if (r.status === 503) return "This server isn't set up for that yet.";
  return fallback;
}

export const SPARKLE = "M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z";
export const LOCK = "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3";
