// Cookies and JSON replies for the auth routes, on plain Request/Response so the routes can be tested
// without a Next request scope. Cookies set during a request are queued and written to the reply.
import { parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { z } from "zod";
import type { Fail, FailReason } from "./schemas.ts";

export interface CookieOptions {
  httpOnly?: boolean;
  sameSite?: "lax" | "strict" | "none" | boolean;
  secure?: boolean;
  path?: string;
  maxAge?: number;
  expires?: Date;
  domain?: string;
}

/** What the session code reads and writes cookies through. */
export interface CookieJar {
  get(name: string): string | undefined;
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options: CookieOptions): void;
  delete(name: string, options?: CookieOptions): void;
  /** Extra response headers (Supabase asks for no-cache headers when it writes auth cookies). */
  setHeaders(headers: Record<string, string>): void;
}

/** A jar over the request's Cookie header; `apply` writes queued cookies onto the reply. */
export class RequestCookieJar implements CookieJar {
  private readonly current = new Map<string, string>();
  private readonly outgoing = new Map<string, string>();
  private readonly headers: Record<string, string> = {};

  constructor(request: Request) {
    for (const { name, value } of parseCookieHeader(request.headers.get("cookie") ?? "")) this.current.set(name, value ?? "");
  }

  get(name: string) {
    return this.current.get(name);
  }

  getAll() {
    return [...this.current].map(([name, value]) => ({ name, value }));
  }

  set(name: string, value: string, options: CookieOptions) {
    if (options.maxAge === 0 || value === "") this.current.delete(name);
    else this.current.set(name, value);
    this.outgoing.set(name, serializeCookieHeader(name, value, { path: "/", ...options }));
  }

  delete(name: string, options: CookieOptions = {}) {
    this.set(name, "", { path: "/", ...options, maxAge: 0 });
  }

  setHeaders(headers: Record<string, string>) {
    Object.assign(this.headers, headers);
  }

  apply(response: Response): Response {
    for (const cookie of this.outgoing.values()) response.headers.append("set-cookie", cookie);
    for (const [key, value] of Object.entries(this.headers)) response.headers.set(key, value);
    response.headers.set("cache-control", "private, no-store");
    return response;
  }
}

export function ok<T extends object>(body: T, status = 200): Response {
  return Response.json({ ok: true, ...body }, { status });
}

export function fail(status: number, reason: FailReason, extra: Omit<Fail, "ok" | "reason"> = {}): Response {
  return Response.json({ ok: false, reason, ...extra } satisfies Fail, { status });
}

/** Parses a JSON body with a zod schema; null on bad JSON or a failed check. */
export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S> | null> {
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > 16_384) return null;
    raw = text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** The caller's IP for rate limiting (first X-Forwarded-For hop on Vercel), or "local". */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}
