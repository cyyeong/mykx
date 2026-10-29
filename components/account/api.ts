// JSON calls for the account screens (Your family, Me, admin People). Every failure body is
// `{ ok: false, reason }` (lib/auth/schemas.ts); status 0 means the network call itself failed.
// Nothing here logs: request bodies can hold passwords and codes.
import type { FailReason } from "@/lib/auth/schemas";

export type ApiResult<T> = {
  status: number;
  ok: boolean;
  data: T | null;
  reason: FailReason | null;
  /** Plain words from the server for a failure, when it sent some. */
  note?: string | null;
};

export async function api<T>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      cache: "no-store",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as (T & { ok?: boolean; reason?: FailReason; note?: string }) | null;
    const ok = res.ok && json?.ok !== false;
    return { status: res.status, ok, data: ok ? json : null, reason: ok ? null : (json?.reason ?? null), note: ok ? null : (json?.note ?? null) };
  } catch {
    return { status: 0, ok: false, data: null, reason: null };
  }
}

/** 401 or 403 from a list or profile read: not signed in, or not allowed here. */
export const isAuthFailure = (status: number) => status === 401 || status === 403;
