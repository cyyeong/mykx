// Sign out the grown-up (here, or on every device) and any kid signed in on this device.
import { withAuth } from "@/lib/auth/context";
import { fail, ok, readBody } from "@/lib/auth/http";
import { KID_COOKIE } from "@/lib/auth/kid-session";
import { signOutBody } from "@/lib/auth/schemas";

export async function POST(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const body = await readBody(request, signOutBody);
    if (!body) return fail(400, "invalid");
    jar.delete(KID_COOKIE);
    await store.signOutParent(jar, body.everywhere === true);
    return ok({});
  });
}
