// One kid navigation shell for every kid browsing page (docs/prd/USER_STORIES.md §8.4 fix 1).
// Pure helpers live here so Vitest can cover them without a browser; KidNav.tsx renders them.
// Founder decision 28 Oct (§8.5): tabs are Home, Learn, Play (Arcade), Treasure, Vibe;
// Me and Switch profile stay in the avatar menu (components/nav/KidAvatarMenu.tsx).

export type KidTabId = "home" | "learn" | "ask" | "play" | "treasure" | "vibe";

export type KidTab = { id: KidTabId; label: string; href: string; soon?: true };

export const KID_TABS: readonly KidTab[] = [
  { id: "home", label: "Home", href: "/home" },
  // The Learn hub: the kid's own subjects (their level's packs); P3 Science keeps the frog quest map inside it.
  { id: "learn", label: "Learn", href: "/learn" },
  // Homework help (founder, 28 Oct): a typed question or a photo, explained the way the syllabus teaches it.
  { id: "ask", label: "Ask Kix", href: "/ask" },
  { id: "play", label: "Play", href: "/arcade" },
  { id: "treasure", label: "Treasure", href: "/treasure" },
  { id: "vibe", label: "Vibe", href: "/vibe" },
];

/** Strips one trailing slash so "/home/" and "/home" match the same tab. */
function clean(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/** Which tab the path belongs to, or null on pages without a tab (Me, Studio, Talk, questions). */
export function kidNavCurrent(pathname: string): KidTabId | null {
  const path = clean(pathname);
  if (path === "/home" || path.startsWith("/home/")) return "home";
  if (path === "/learn" || path.startsWith("/learn/")) return "learn";
  if (path === "/ask" || path.startsWith("/ask/")) return "ask";
  if (path === "/arcade" || path.startsWith("/arcade/")) return "play";
  if (path === "/treasure" || path.startsWith("/treasure/")) return "treasure";
  if (path === "/vibe" || path.startsWith("/vibe/")) return "vibe";
  return null;
}

/**
 * Task screens hide the bar (USER_STORIES §2.2): inside a question, on the
 * quest-complete page, and during an Arcade round. The Arcade hub and the
 * typing path keep it; the Studio transform is a same-route overlay, so the
 * bar stays there (its own ✕ exits, task 5).
 */
export function isKidNavHidden(pathname: string): boolean {
  const path = clean(pathname);
  if (path === "/question" || path.startsWith("/question/")) return true;
  if (/^\/learn\/[^/]+\/done(\/|$)/.test(`${path}/`)) return true;
  if (path === "/arcade/path" || path.startsWith("/arcade/path/")) return false;
  if (path.startsWith("/arcade/")) return true;
  return false;
}
