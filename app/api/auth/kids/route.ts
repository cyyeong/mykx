// "Who's learning?": a door per kid in the household signed in on this device.
// Signed out: { ok: true, signedIn: false, grownUp: null, kids: [] }.
import { withAuth } from "@/lib/auth/context";
import { doorsFor } from "@/lib/auth/flows";
import { ok } from "@/lib/auth/http";

export async function GET(request: Request) {
  return withAuth(request, async ({ store, jar }) => {
    const { signedIn, grownUp, kids } = await doorsFor(store, jar);
    return ok({ signedIn, grownUp, kids });
  });
}
