// Guest mode (founder, 29 Oct): a public walkthrough of myKx, signed in with one tap and no password. It runs as its
// own deployment (mykx-guest) built with NEXT_PUBLIC_MYKX_GUEST=1 and given no database or Meta keys, so it can't
// reach real data even by mistake: the in-memory sample family is the only store (lib/auth/context.ts), every agent
// answers with its cached sample (lib/meta/client.ts), a child's own words are never kept (lib/auth/store-demo.ts),
// and proxy.ts refuses every change except the few that make the walkthrough work (answers, games, sample asks).
// Judges get a real sign-in on mykx.vercel.app for live AI. Safe to import from client components.

/** True on the guest site. The literal env read is inlined into client bundles at build time. */
export function isGuest(): boolean {
  return process.env.NEXT_PUBLIC_MYKX_GUEST === "1";
}

/** Where the main site's "Explore as a guest" link goes. */
export const GUEST_URL = process.env.NEXT_PUBLIC_MYKX_GUEST_URL || "https://mykx-guest.vercel.app";

/** The one line every guest page shows. */
export const GUEST_NOTE = "Guest walkthrough: the same screens as a real sign-in, but AI is switched off, so every Kix reply is a sample.";

/** The writes a guest may make, by method and path (everything else answers 403). */
const ALLOWED: readonly [string, RegExp][] = [
  ["POST", /^\/api\/auth\/guest$/],
  ["POST", /^\/api\/auth\/kid\/door$/],
  ["DELETE", /^\/api\/auth\/kid$/],
  ["POST", /^\/api\/auth\/signout$/],
  ["DELETE", /^\/api\/auth\/parent$/],
  ["POST", /^\/api\/attempts$/],
  ["POST", /^\/api\/games\/round$/],
  ["POST", /^\/api\/pets(\/talk)?$/],
  ["POST", /^\/api\/kix\/(tutor|reason|spark|homework)$/],
  ["POST", /^\/api\/session\/close$/],
  ["POST", /^\/api\/guardian\/beat$/],
  ["POST", /^\/api\/vibe$/],
  ["POST", /^\/api\/studio\/transform$/],
];

/** Whether a guest may make this request. Reads are always fine; a write must be on the list. */
export function guestMayWrite(method: string, path: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return true;
  return ALLOWED.some(([am, re]) => am === m && re.test(path));
}

export const GUEST_REFUSAL = { ok: false, reason: "guest", note: "This is a guest walkthrough, so changes aren't saved. Ask the founder for a real sign-in." } as const;
