"use client";

// The admin pages' frame (USER_STORIES A-02): the sidebar to every admin area, the current one marked, and the
// page beside it. Layout classes come from people.css (ap-), shared by every admin screen.
import Link from "next/link";
import type { ReactNode } from "react";
import "@/components/admin/people/people.css";
import "./admin.css";

export const ADMIN_NAV = [
  { href: "/admin/skills", label: "Skills" },
  { href: "/admin/knowledge", label: "Add knowledge" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/under-the-hood", label: "Under the hood" },
] as const;

export function AdminFrame({ current, children }: { current: (typeof ADMIN_NAV)[number]["href"]; children: ReactNode }) {
  return (
    <div className="ap-root" data-theme="anime-sky" data-band="teen" style={{ width: "100%", minHeight: "100dvh", boxSizing: "border-box", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--font-text)" }}>
      <div className="ap-shell">
        <nav className="ap-nav" aria-label="Admin" style={{ flex: "none", boxSizing: "border-box", display: "flex", background: "var(--surface-raised)" }}>
          <div className="ap-brand ad-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/wordmark-on-light.svg" alt="myKx" style={{ height: 24, width: "auto" }} />
            <span className="ad-tag">Admin</span>
          </div>
          <div className="ap-navlist">
            {ADMIN_NAV.map((n) => (
              <Link key={n.href} href={n.href} className="ap-navi" aria-current={n.href === current ? "page" : undefined} style={{ display: "block", padding: 12, borderRadius: "var(--radius-sm)", fontSize: 16, lineHeight: "20px", fontWeight: 600, ...(n.href === current ? { background: "var(--surface)", color: "var(--ink)" } : { color: "var(--ink-muted)" }) }}>
                {n.label}
              </Link>
            ))}
          </div>
          <Link href="/parent" className="ap-navi ad-back">
            Back to my family
          </Link>
        </nav>
        <main className="ap-main ad-main">{children}</main>
      </div>
    </div>
  );
}
