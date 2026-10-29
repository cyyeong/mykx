"use client";

// The admin shell (USER_STORIES A-02): one sidebar to every admin area, rendered once by app/(admin)/layout.tsx and
// kept while an admin moves between areas, so only the content panel changes (founder, 29 Oct). The current area
// comes from the URL. Layout classes come from people.css (ap-) and admin.css (ad-); every admin screen shares them.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import "@/components/admin/people/people.css";
import "./admin.css";

export const ADMIN_NAV = [
  { href: "/admin/skills", label: "Skills", icon: "M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15zM4 20.5A2.5 2.5 0 0 0 6.5 23H20M8 7h8M8 11h6" },
  { href: "/admin/knowledge", label: "Add knowledge", icon: "M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" },
  { href: "/admin/people", label: "People", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" },
  { href: "/admin/under-the-hood", label: "Under the hood", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
  { href: "/admin/synapse", label: "Kix Synapse", icon: "M12 2c.6 4.8 4.2 8.4 9 9-4.8.6-8.4 4.2-9 9-.6-4.8-4.2-8.4-9-9 4.8-.6 8.4-4.2 9-9z", fill: true },
] as const;

const Icon = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="ad-navicon">
    <path d={d} fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The area an admin path belongs to: the longest nav href it starts with. */
export function currentArea(path: string): string | null {
  return ADMIN_NAV.map((n) => n.href).filter((h) => path === h || path.startsWith(`${h}/`)).sort((a, b) => b.length - a.length)[0] ?? null;
}

export function AdminShell({ who, children }: { who: string | null; children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const current = currentArea(path);
  return (
    <div className="ap-root ad-root" data-theme="anime-sky" data-band="teen">
      <div className="ap-shell">
        <nav className="ap-nav ad-nav" aria-label="Admin">
          <div className="ap-brand ad-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/wordmark-on-light.svg" alt="myKx" style={{ height: 24, width: "auto" }} />
            <span className="ad-tag">Admin</span>
          </div>
          <div className="ap-navlist">
            {ADMIN_NAV.map((n) => (
              <Link key={n.href} href={n.href} className="ap-navi ad-navi" aria-current={n.href === current ? "page" : undefined}>
                <Icon d={n.icon} fill={"fill" in n && n.fill} />
                {n.label}
              </Link>
            ))}
          </div>
          <div className="ad-foot">
            {who && (
              <p className="ad-who">
                Signed in as <strong>{who}</strong>
              </p>
            )}
            <Link href="/parent" className="ap-navi ad-navi ad-quiet">
              <Icon d="M15 18l-6-6 6-6" />
              Back to my family
            </Link>
            <button
              type="button"
              className="ap-navi ad-navi ad-quiet"
              disabled={leaving}
              onClick={async () => {
                setLeaving(true);
                await fetch("/api/auth/signout", { method: "POST" }).catch(() => null);
                router.replace("/signin");
              }}
            >
              <Icon d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              Sign out
            </button>
          </div>
        </nav>
        <main className="ap-main ad-main">{children}</main>
      </div>
    </div>
  );
}
