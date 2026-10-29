// On the guest site only (lib/guest.ts): every change to the shared sample family is refused here, before any route
// runs, except the few writes the walkthrough needs (sign-in, answers, games, sample asks). Admin and Your family
// stay fully viewable and read-only. On the real site this passes everything straight through.
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_REFUSAL, guestMayWrite, isGuest } from "./lib/guest";

export function proxy(request: NextRequest) {
  if (!isGuest() || guestMayWrite(request.method, request.nextUrl.pathname)) return NextResponse.next();
  return NextResponse.json(GUEST_REFUSAL, { status: 403 });
}

export const config = { matcher: "/api/:path*" };
