// "Forgot password?": sends a reset email that lands on /signin. Always { ok: true }, so the reply never
// says whether the address has an account. Demo mode sends nothing. The /signin URL must be in the
// Supabase project's redirect allow list (Authentication → URL Configuration).
import { withAuth } from "@/lib/auth/context";
import { clientIp, fail, ok, readBody } from "@/lib/auth/http";
import { takeToken } from "@/lib/auth/lockout";
import { resetBody } from "@/lib/auth/schemas";

export async function POST(request: Request) {
  return withAuth(request, async ({ store }) => {
    const limited = takeToken("password-reset", clientIp(request), 5);
    if (!limited.ok) return fail(429, "slow-down", { retryAfterSec: limited.retryAfterSec });
    const body = await readBody(request, resetBody);
    if (!body) return fail(400, "invalid");
    await store.sendPasswordReset(body.email, new URL("/signin", request.url).toString());
    return ok({});
  });
}
